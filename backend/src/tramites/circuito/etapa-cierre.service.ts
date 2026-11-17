import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Etapa, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import type { ObservacionesDto, PadronDto } from './dto/circuito.dto.js';
import type { ConfigTramite } from './config-tramite.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { vistosBuenosRequeridos } from './validaciones/circuito.validaciones.js';

/**
 * Catastro cierra el trámite:
 *   verificacionFinal  completó los datos que faltaban →
 *                        - si el trámite espera el padrón (alta): queda esperándolo (30 a 60 días);
 *                        - si no (cambio de titularidad): con TODOS los vistos buenos, FINALIZA ahí.
 *   registrarPadron    llegó el padrón → con TODOS los vistos buenos, el trámite FINALIZA y surte efecto.
 */
@Injectable()
export class EtapaCierreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly registro: RegistroTramitesService,
  ) {}

  async verificacionFinal(tipo: TipoTramite, expedienteId: string, datos: ObservacionesDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Catastro tiene que tener tomado el expediente, en el cierre.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.CIERRE], usuarioId);
      const config = this.registro.de(tipo);

      //2.- Se valida de nuevo que la carga esté completa (Catastro pudo completar datos en el cierre).
      await config.validarCarga(tx, expediente);

      //3.- Queda la verificación final.
      const verificacion = await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.VERIFICACION_FINAL, resultado: ResultadoActuacion.APTO, usuario, observaciones: datos.observaciones });

      //4.- Con padrón: pasa a la espera (sigue en Catastro). Sin padrón: finaliza ahora.
      if (config.esperaPadron) {
        await this.expedientes.cambiarEtapa(tx, expediente, SIGUIENTE_ETAPA[Etapa.CIERRE]!, usuario);
        return;
      }
      //    El efecto (ej: titulares anteriores y nuevos) queda en los datos de la verificación final.
      verificacion.datos = await this.surtirEfecto(tx, config, expediente, null, usuario);
      await tx.save(verificacion);
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.FINALIZADO, usuario, true);
    });
  }

  async registrarPadron(tipo: TipoTramite, expedienteId: string, datos: PadronDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Catastro tiene que tener tomado el expediente, esperando el padrón.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.ESPERA_PADRON], usuarioId);

      //2.- Finaliza con el padrón (alta: padrón en el inmueble, concesión VIGENTE).
      const resultado = await this.surtirEfecto(tx, this.registro.de(tipo), expediente, datos.padron, usuario);

      //3.- Queda en el historial y el expediente se FINALIZA.
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.PADRON,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: datos.observaciones,
        datos: { padron: datos.padron, ...resultado },
      });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.FINALIZADO, usuario, true);
    });
  }

  /**
   * El trámite surte efecto:
   *   1. Se valida que tenga el visto bueno de TODAS las oficinas.
   *   2. El trámite aplica su efecto (lo define cada ConfigTramite).
   * Devuelve los datos del efecto, para el historial. Quien llama FINALIZA el expediente.
   */
  private async surtirEfecto(tx: EntityManager, config: ConfigTramite, expediente: Expediente, padron: string | null, usuario: Usuario): Promise<Record<string, unknown>> {
    await this.exigirVistosBuenos(tx, expediente, config.pideNumeroConcesion);
    return config.alFinalizar(tx, expediente, padron, usuario);
  }

  /**
   * El trámite solo finaliza con el visto bueno de todas las oficinas. Lo garantiza el orden
   * de las etapas, pero se verifica igual en el historial (defensa en profundidad).
   */
  async exigirVistosBuenos(tx: EntityManager, expediente: Expediente, pideNumeroConcesion = true): Promise<void> {
    const faltan: string[] = [];
    for (const [tipo, resultados, nombre] of vistosBuenosRequeridos(pideNumeroConcesion)) {
      const ultima = await this.expedientes.ultimaActuacion(tx, expediente.id, [tipo]);
      if (!ultima || !resultados.includes(ultima.resultado)) faltan.push(nombre);
    }
    if (faltan.length) throw new ConflictException(`No se puede finalizar: falta el visto bueno de ${faltan.join(', ')}.`);
  }
}
