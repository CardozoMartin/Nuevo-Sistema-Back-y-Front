import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Etapa, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { ObservacionesDto, PadronDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';

/**
 * Los vistos buenos que tiene que tener el expediente para finalizar. Cuenta la ÚLTIMA
 * actuación de cada tipo (si Distrito observó y después aprobó, vale el apto). Si alguna
 * oficina dijo «no apto», el expediente ya está rechazado y no llega hasta acá.
 */
const VISTOS_BUENOS: [TipoActuacion, ResultadoActuacion, string][] = [
  [TipoActuacion.VERIFICACION_DEUDA, ResultadoActuacion.SIN_DEUDA, 'Recaudación (sin deuda)'],
  [TipoActuacion.INFORME_TECNICO, ResultadoActuacion.APTO, 'Distrito (apto)'],
  [TipoActuacion.DICTAMEN_JURIDICO, ResultadoActuacion.APTO, 'Jurídico (apto)'],
  [TipoActuacion.NUMERO_CONCESION, ResultadoActuacion.REGISTRADO, 'Catastro (número de concesión)'],
  [TipoActuacion.RESOLUCION, ResultadoActuacion.REGISTRADO, 'Secretaría General (resolución)'],
  [TipoActuacion.VERIFICACION_FINAL, ResultadoActuacion.APTO, 'Catastro (verificación final)'],
];

/**
 * Catastro cierra el trámite:
 *   verificacionFinal  completó los datos que faltaban → queda esperando el padrón de Rentas (30 a 60 días).
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

      //2.- Se valida de nuevo que la carga esté completa (Catastro pudo completar datos en el cierre).
      await this.registro.de(tipo).validarCarga(tx, expediente);

      //3.- Queda la verificación final y pasa a la espera del padrón (sigue en Catastro).
      await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.VERIFICACION_FINAL, resultado: ResultadoActuacion.APTO, usuario, observaciones: datos.observaciones });
      await this.expedientes.cambiarEtapa(tx, expediente, SIGUIENTE_ETAPA[Etapa.CIERRE]!, usuario);
    });
  }

  async registrarPadron(tipo: TipoTramite, expedienteId: string, datos: PadronDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Catastro tiene que tener tomado el expediente, esperando el padrón.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.ESPERA_PADRON], usuarioId);

      //2.- Se valida que tenga el visto bueno de TODAS las oficinas.
      await this.exigirVistosBuenos(tx, expediente);

      //3.- El trámite surte efecto (alta: padrón en el inmueble, concesión VIGENTE).
      const resultado = await this.registro.de(tipo).alFinalizar(tx, expediente, datos.padron, usuario);

      //4.- Queda en el historial y el expediente se FINALIZA.
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
   * El trámite solo finaliza con el visto bueno de todas las oficinas. Lo garantiza el orden
   * de las etapas, pero se verifica igual en el historial (defensa en profundidad).
   */
  async exigirVistosBuenos(tx: EntityManager, expediente: Expediente): Promise<void> {
    const faltan: string[] = [];
    for (const [tipo, resultado, nombre] of VISTOS_BUENOS) {
      const ultima = await this.expedientes.ultimaActuacion(tx, expediente.id, [tipo]);
      if (ultima?.resultado !== resultado) faltan.push(nombre);
    }
    if (faltan.length) throw new ConflictException(`No se puede finalizar: falta el visto bueno de ${faltan.join(', ')}.`);
  }
}
