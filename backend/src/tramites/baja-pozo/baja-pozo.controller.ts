import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { ObservacionesDto } from '../circuito/dto/circuito.dto.js';
import { BajaPozoService } from './baja-pozo.service.js';
import {
  BajaDeOficioDto,
  ClausuraDto,
  DatosBajaDto,
  DictamenJuridicoDto,
  DocumentacionDto,
  EvaluacionTecnicaDto,
  IniciarBajaPozoDto,
  ResolucionBajaDto,
} from './dto/baja-pozo.dto.js';

/**
 * Endpoints de la Baja de Pozo. `:id` es el id del expediente.
 * Para tomar el expediente y ver el historial: /api/expedientes/:id/tomar y /historial.
 * Para buscar el pozo: GET /api/pozos?q=…
 * Las rutas fijas (documentos, avisos-distrito, de-oficio) van antes que las de `:id`.
 */
@Controller('tramites/baja-pozo')
export class BajaPozoController {
  constructor(private readonly baja: BajaPozoService) {}

  // --- Consultas ---------------------------------------------------------------

  /** Bajas sin terminar (?todas=true incluye las terminadas y las de oficio). */
  @Get()
  listar(@Query('todas') todas?: string) {
    return this.baja.listar(todas === 'true');
  }

  /** Documentación que se presenta para la baja a solicitud (checklist de mesa de entrada). */
  @Get('documentos')
  documentos() {
    return this.baja.documentos();
  }

  /** Distrito: bajas aprobadas de las que tiene que tomar conocimiento (?todos=true incluye las vistas). */
  @Get('avisos-distrito')
  avisosDistrito(@Query('todos') todos?: string) {
    return this.baja.avisosDistrito(todos === 'true');
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.baja.obtener(String(id));
  }

  // --- Baja de oficio y aviso a Distrito ----------------------------------------

  /** Pozos: baja DE OFICIO del pozo, en el acto (sin expediente ni circuito). Devuelve la ficha del pozo. */
  @Post('de-oficio/:pozoId')
  deOficio(@Param('pozoId', ParseIntPipe) pozoId: number, @Body() dto: BajaDeOficioDto, @UsuarioActual() usuarioId: string) {
    return this.baja.darDeBajaDeOficio(String(pozoId), dto, usuarioId);
  }

  /** Distrito: tomó conocimiento de la baja (no dictamina). `:bajaId` es el id de poz_baja. */
  @Post('avisos-distrito/:bajaId/visto')
  tomarConocimiento(@Param('bajaId', ParseIntPipe) bajaId: number, @UsuarioActual() usuarioId: string) {
    return this.baja.tomarConocimiento(String(bajaId), usuarioId);
  }

  // --- Baja a solicitud: Pozos ---------------------------------------------------

  /** Pozos (mesa de entrada): registra el expediente e inicia la baja a solicitud del titular. */
  @Post()
  iniciar(@Body() dto: IniciarBajaPozoDto, @UsuarioActual() usuarioId: string) {
    return this.baja.iniciar(dto, usuarioId);
  }

  /** Pozos: corrige los datos de la solicitud y el checklist. */
  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: DatosBajaDto, @UsuarioActual() usuarioId: string) {
    return this.baja.actualizar(String(id), dto, usuarioId);
  }

  /** Pozos: documentación COMPLETA (→ antecedentes) o PENDIENTE (→ en espera). */
  @Post(':id/documentacion')
  documentacion(@Param('id', ParseIntPipe) id: number, @Body() dto: DocumentacionDto, @UsuarioActual() usuarioId: string) {
    return this.baja.controlarDocumentacion(String(id), dto, usuarioId);
  }

  /** Pozos: antecedentes verificados (→ evaluación técnica). */
  @Post(':id/antecedentes')
  antecedentes(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.baja.verificarAntecedentes(String(id), dto, usuarioId);
  }

  /** Pozos: evaluación técnica FAVORABLE (→ Jurídico) o REQUIERE_SUBSANACION (→ en espera). */
  @Post(':id/evaluacion-tecnica')
  evaluacionTecnica(@Param('id', ParseIntPipe) id: number, @Body() dto: EvaluacionTecnicaDto, @UsuarioActual() usuarioId: string) {
    return this.baja.evaluarTecnicamente(String(id), dto, usuarioId);
  }

  /** Pozos: corrigió lo observado por Jurídico y se lo reenvía. */
  @Post(':id/reenviar')
  reenviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.baja.reenviar(String(id), dto, usuarioId);
  }

  // --- Jurídico, Secretaría y clausura -------------------------------------------

  /** Jurídico: APTO / OBSERVADO / NO_APTO, y si se anula también la concesión. */
  @Post(':id/juridico')
  juridico(@Param('id', ParseIntPipe) id: number, @Body() dto: DictamenJuridicoDto, @UsuarioActual() usuarioId: string) {
    return this.baja.dictaminarJuridico(String(id), dto, usuarioId);
  }

  /** Secretaría General: resolución que APRUEBA o RECHAZA la baja. */
  @Post(':id/resolucion')
  resolucion(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolucionBajaDto, @UsuarioActual() usuarioId: string) {
    return this.baja.resolver(String(id), dto, usuarioId);
  }

  /** Pozos: acta de clausura física; el trámite finaliza. */
  @Post(':id/clausura')
  clausura(@Param('id', ParseIntPipe) id: number, @Body() dto: ClausuraDto, @UsuarioActual() usuarioId: string) {
    return this.baja.registrarClausura(String(id), dto, usuarioId);
  }
}
