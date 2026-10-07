import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dictamen, EstadoExpediente, Etapa, NOMBRE_OFICINA, OFICINA_DE_ETAPA, ResultadoActuacion, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { ObservacionesDto } from './dto/circuito.dto.js';
import { nombrePersona } from '../../personas/entities/persona.entity.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { personasSinVerificar } from './validaciones/circuito.validaciones.js';

/**
 * Catastro pone el expediente en circulación:
 *   enviar    terminó la carga → Recaudación.
 *   reenviar  corrigió lo que observó Distrito o Jurídico → vuelve a ESA oficina. Si al corregir
 *             cambiaron las personas del trámite (ej: un titular nuevo), pasa ANTES por
 *             Recaudación para verificar su deuda, y de ahí vuelve a la oficina que observó.
 */
@Injectable()
export class EtapaEnvioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly registro: RegistroTramitesService,
  ) {}

  async enviar(tipo: TipoTramite, expedienteId: string, datos: ObservacionesDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Catastro tiene que tener tomado el expediente, en la carga.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.CARGA], usuarioId);

      //2.- Se valida que la carga esté completa y sin duplicados (lo define el trámite).
      await this.registro.de(tipo).validarCarga(tx, expediente);

      //3.- Queda asentado que la carga se completó y pasa a Recaudación.
      await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.CARGA_COMPLETA, resultado: ResultadoActuacion.APTO, usuario, observaciones: datos.observaciones });
      await this.expedientes.pasar(tx, expediente, { etapa: Etapa.RECAUDACION, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones });
    });
  }

  async reenviar(tipo: TipoTramite, expedienteId: string, datos: ObservacionesDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Catastro tiene que tener tomado el expediente observado, en corrección.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.CORRECCION], usuarioId, [EstadoExpediente.OBSERVADO]);

      //2.- Se valida de nuevo la carga corregida.
      await this.registro.de(tipo).validarCarga(tx, expediente);

      //3.- ¿Quién lo observó? La última actuación con resultado OBSERVADO.
      const observacion = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.INFORME_TECNICO, TipoActuacion.DICTAMEN_JURIDICO], ResultadoActuacion.OBSERVADO);
      if (!observacion) throw new ConflictException('No se encontró la observación que originó la corrección.');

      //4.- ¿Cambiaron las personas del trámite? Las que Recaudación no verificó todavía.
      const personas = await this.registro.de(tipo).personasAVerificar(tx, expediente);
      const verificacion = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.VERIFICACION_DEUDA], ResultadoActuacion.SIN_DEUDA);
      const nuevas = personasSinVerificar(verificacion?.datos?.personas, personas.map((p) => p.id));
      const nombresNuevas = personas.filter((p) => nuevas.includes(p.id)).map(nombrePersona).join(', ');

      //5.- Queda asentada la corrección. Lo aprobado antes sigue aprobado: no se empieza de nuevo.
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.CORRECCION,
        resultado: ResultadoActuacion.APTO,
        usuario,
        observaciones: datos.observaciones,
        datos: { respondeA: observacion.id, ...(nuevas.length ? { reverificaDeuda: true, vuelveA: observacion.etapa, personasNuevas: nuevas } : {}) },
      });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_TRAMITE, usuario);

      //6.- Con personas nuevas va primero a Recaudación; si no, directo a la oficina que observó.
      if (nuevas.length) {
        const vuelveA = NOMBRE_OFICINA[OFICINA_DE_ETAPA[observacion.etapa]];
        await this.expedientes.pasar(tx, expediente, {
          etapa: Etapa.RECAUDACION,
          usuario,
          dictamen: Dictamen.APTO,
          observaciones: `Cambiaron los titulares al corregir: Recaudación verifica la deuda de ${nombresNuevas}. Después vuelve a ${vuelveA}.`,
        });
        return;
      }
      await this.expedientes.pasar(tx, expediente, { etapa: observacion.etapa, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones ?? 'Observaciones corregidas.' });
    });
  }
}
