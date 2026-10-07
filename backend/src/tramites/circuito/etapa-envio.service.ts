import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dictamen, EstadoExpediente, Etapa, ResultadoActuacion, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { ObservacionesDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';

/**
 * Catastro pone el expediente en circulación:
 *   enviar    terminó la carga → Recaudación.
 *   reenviar  corrigió lo que observó Distrito o Jurídico → vuelve a ESA oficina.
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

      //4.- Queda asentada la corrección y vuelve a la oficina que observó (lo aprobado antes
      //    sigue aprobado: no se empieza de nuevo el circuito).
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.CORRECCION,
        resultado: ResultadoActuacion.APTO,
        usuario,
        observaciones: datos.observaciones,
        datos: { respondeA: observacion.id },
      });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_TRAMITE, usuario);
      await this.expedientes.pasar(tx, expediente, { etapa: observacion.etapa, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones ?? 'Observaciones corregidas.' });
    });
  }
}
