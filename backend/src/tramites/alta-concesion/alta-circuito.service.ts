import { Injectable } from '@nestjs/common';
import { Etapa, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import type { CursoConDeudaDto, DictamenDto, NotificarDeudaDto, ObservacionesDto, PadronDto, ResolucionDto, VerificacionDeudaDto } from '../circuito/dto/circuito.dto.js';
import { EtapaCierreService } from '../circuito/etapa-cierre.service.js';
import { EtapaDictamenService } from '../circuito/etapa-dictamen.service.js';
import { EtapaEnvioService } from '../circuito/etapa-envio.service.js';
import { EtapaRecaudacionService } from '../circuito/etapa-recaudacion.service.js';
import { EtapaResolucionService } from '../circuito/etapa-resolucion.service.js';
import { NumeroConcesionService } from '../circuito/numero-concesion.service.js';
import type { RespuestaAlta } from './alta-concesion.respuesta.js';
import { AltaConcesionService } from './alta-concesion.service.js';

const ALTA = TipoTramite.ALTA_CONCESION;

/**
 * Circuito del Alta de Concesión por las oficinas. Cada oficina es un service común a todos
 * los trámites (tramites/circuito/); lo propio del alta está en AltaCircuitoConfig. Acá solo
 * se llama a cada oficina con el alta y se devuelve el alta actualizada.
 *
 *   Catastro            enviar ─────────────────────────────────────► Recaudación
 *   Recaudación         por cada concesión otorgada de los titulares: ¿tiene deuda? (sí / no)
 *                       ninguna ► Distrito  |  alguna ► EN ESPERA hasta que se levante la deuda
 *                       si no se puede cobrar: curso con deuda (con nota) ► Distrito, con aviso
 *                       notificarDeuda: correo a los titulares con deuda
 *   Distrito            APTO ► Jurídico   |  OBSERVADO ► Catastro corrige  |  NO_APTO ► RECHAZADO
 *   Jurídico            APTO ► Secretaría |  OBSERVADO ► Catastro corrige  |  NO_APTO ► RECHAZADO
 *   Catastro            reenviar (después de corregir) ► vuelve a la oficina que observó
 *   Secretaría General  pide el N° de concesión ► Catastro lo carga del libro ► resolución ► Catastro
 *   Catastro            verificación final ► espera del padrón (30-60 días) ► padrón ► FINALIZADO
 */
@Injectable()
export class AltaCircuitoService {
  constructor(
    private readonly alta: AltaConcesionService,
    private readonly envio: EtapaEnvioService,
    private readonly recaudacion: EtapaRecaudacionService,
    private readonly dictamen: EtapaDictamenService,
    private readonly numeros: NumeroConcesionService,
    private readonly resolucion: EtapaResolucionService,
    private readonly cierre: EtapaCierreService,
  ) {}

  async enviar(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.envio.enviar(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  async reenviar(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.envio.reenviar(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  /** Concesiones otorgadas de los titulares y si tienen deuda (lo que verifica Recaudación). */
  antecedentesDeuda(id: string) {
    return this.recaudacion.antecedentes(ALTA, id);
  }

  async verificarDeuda(id: string, datos: VerificacionDeudaDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.recaudacion.verificarDeuda(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  async darCursoConDeuda(id: string, datos: CursoConDeudaDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.recaudacion.darCursoConDeuda(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  /** Devuelve a quién se mandó el aviso (y quién no tiene correo), no el alta. */
  notificarDeuda(id: string, datos: NotificarDeudaDto, usuarioId: string) {
    return this.recaudacion.notificarDeuda(ALTA, id, datos, usuarioId);
  }

  async dictaminar(id: string, etapa: Etapa.DISTRITO | Etapa.JURIDICO, datos: DictamenDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.dictamen.dictaminar(ALTA, id, etapa, datos, usuarioId);
    return this.alta.obtener(id);
  }

  async solicitarNumero(id: string, usuarioId: string): Promise<RespuestaAlta> {
    await this.numeros.solicitar(ALTA, id, usuarioId);
    return this.alta.obtener(id);
  }

  async registrarResolucion(id: string, datos: ResolucionDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.resolucion.registrar(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  async verificacionFinal(id: string, datos: ObservacionesDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.cierre.verificacionFinal(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }

  async registrarPadron(id: string, datos: PadronDto, usuarioId: string): Promise<RespuestaAlta> {
    await this.cierre.registrarPadron(ALTA, id, datos, usuarioId);
    return this.alta.obtener(id);
  }
}
