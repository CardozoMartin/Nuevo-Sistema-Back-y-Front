import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoExpediente, Etapa, ResultadoActuacion, TipoActuacion, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { CancelarInicioDto, CursoConDeudaDto, DictamenDto, NotificarDeudaDto, ObservacionesDto, ResolucionDto, VerificacionDeudaDto } from '../circuito/dto/circuito.dto.js';
import { EtapaCierreService } from '../circuito/etapa-cierre.service.js';
import { EtapaDictamenService } from '../circuito/etapa-dictamen.service.js';
import { EtapaEnvioService } from '../circuito/etapa-envio.service.js';
import { EtapaRecaudacionService } from '../circuito/etapa-recaudacion.service.js';
import { EtapaResolucionService } from '../circuito/etapa-resolucion.service.js';
import { EstadoCambioTitularidad } from './cambio-titularidad.constantes.js';
import { CambioTitularidadService, type RespuestaCambio } from './cambio-titularidad.service.js';
import { CambioTitularidad } from './entities/cambio-titularidad.entity.js';

const CAMBIO = TipoTramite.CAMBIO_TITULARIDAD;

/**
 * Circuito del Cambio de Titularidad por las oficinas. Cada oficina es un service común a todos
 * los trámites (tramites/circuito/); lo propio del cambio está en CambioCircuitoConfig.
 *
 *   Catastro            cancelar (iniciado por error, antes de enviarlo) ► ANULADO, número libre
 *   Catastro            enviar ─────────────────────────────────────► Recaudación
 *   Recaudación         deuda de los titulares actuales y de los nuevos (como en el alta)
 *   Distrito            APTO ► Jurídico   |  OBSERVADO ► Catastro corrige  |  NO_APTO ► RECHAZADO
 *   Jurídico            APTO ► Secretaría |  OBSERVADO ► Catastro corrige  |  NO_APTO ► RECHAZADO
 *   Catastro            reenviar (después de corregir) ► vuelve a la oficina que observó
 *   Secretaría General  resolución (sin número de concesión: ya lo tiene) ► Catastro
 *   Catastro            verificación final ► FINALIZADO: la concesión cambia de titular
 */
@Injectable()
export class CambioCircuitoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly cambios: CambioTitularidadService,
    private readonly envio: EtapaEnvioService,
    private readonly recaudacion: EtapaRecaudacionService,
    private readonly dictamen: EtapaDictamenService,
    private readonly resolucion: EtapaResolucionService,
    private readonly cierre: EtapaCierreService,
  ) {}

  /**
   * Catastro cancela un cambio que inició por error, mientras sigue en la carga. No se borra nada:
   * el expediente queda ANULADO con el motivo en su historial (su número queda libre) y el cambio
   * ANULADO (la concesión queda libre para otro trámite).
   */
  async cancelarInicio(id: string, datos: CancelarInicioDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Solo en la carga y tomado por quien cancela.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, id, CAMBIO, [Etapa.CARGA], usuarioId);

      //2.- El motivo queda en el historial.
      await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.CANCELACION, resultado: ResultadoActuacion.REGISTRADO, usuario, observaciones: datos.observaciones });

      //3.- El cambio queda anulado: la concesión sigue igual y libre para otro trámite.
      const cambio = await this.cambios.cargar(tx, id);
      await tx.update(CambioTitularidad, cambio.id, { estado: EstadoCambioTitularidad.ANULADO, modificadoUsuarioId: usuario.id });

      //4.- El expediente deja de circular y libera su número.
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.ANULADO, usuario, true);
    });
    return this.cambios.obtener(id);
  }

  async enviar(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.envio.enviar(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  async reenviar(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.envio.reenviar(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  /** Concesiones otorgadas de los titulares (actuales y nuevos) y si tienen deuda. */
  antecedentesDeuda(id: string) {
    return this.recaudacion.antecedentes(CAMBIO, id);
  }

  async verificarDeuda(id: string, datos: VerificacionDeudaDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.recaudacion.verificarDeuda(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  async darCursoConDeuda(id: string, datos: CursoConDeudaDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.recaudacion.darCursoConDeuda(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  /** Devuelve a quién se mandó el aviso (y quién no tiene correo), no el cambio. */
  notificarDeuda(id: string, datos: NotificarDeudaDto, usuarioId: string) {
    return this.recaudacion.notificarDeuda(CAMBIO, id, datos, usuarioId);
  }

  async dictaminar(id: string, etapa: Etapa.DISTRITO | Etapa.JURIDICO, datos: DictamenDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.dictamen.dictaminar(CAMBIO, id, etapa, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  async registrarResolucion(id: string, datos: ResolucionDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.resolucion.registrar(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }

  /** Verificación final de Catastro: el cambio finaliza y la concesión pasa a los nuevos titulares. */
  async verificacionFinal(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaCambio> {
    await this.cierre.verificacionFinal(CAMBIO, id, datos, usuarioId);
    return this.cambios.obtener(id);
  }
}
