import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Etapa, Oficina } from '../../expedientes/expedientes.constantes.js';
import { ConDatosSensibles, RequierePermiso, SoloOficina } from '../../seguridad/auth.decorators.js';
import { Permiso } from '../../seguridad/permisos.constantes.js';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { GuardarTitularesDto } from '../alta-concesion/dto/guardar-titulares.dto.js';
import { CancelarInicioDto, CursoConDeudaDto, DictamenDto, NotificarDeudaDto, ObservacionesDto, ResolucionDto, VerificacionDeudaDto } from '../circuito/dto/circuito.dto.js';
import { CambioCircuitoService } from './cambio-circuito.service.js';
import { CambioTitularidadService } from './cambio-titularidad.service.js';
import { IniciarCambioDto } from './dto/iniciar-cambio.dto.js';

/**
 * Endpoints del Cambio de Titularidad. `:id` es el id del expediente.
 * Para tomar el expediente y ver el historial: /api/expedientes/:id/tomar y /historial.
 */
@Controller('tramites/cambio-titularidad')
export class CambioTitularidadController {
  constructor(
    private readonly cambios: CambioTitularidadService,
    private readonly circuito: CambioCircuitoService,
  ) {}

  // Consultas

  /** Cambios en trámite (con ?todos=true, también los terminados). */
  @Get()
  listar(@Query('todos', new ParseBoolPipe({ optional: true })) todos?: boolean) {
    return this.cambios.listar(todos ?? false);
  }

  /** Expediente, concesión, titulares actuales y propuestos, resolución y aviso de deuda. */
  @Get(':id')
  @ConDatosSensibles()
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.cambios.obtener(String(id));
  }

  // Catastro: inicio y carga

  /** Inicia el cambio sobre una concesión vigente sin otro trámite en curso: { concesionId, expediente }. */
  @Post()
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  iniciar(@Body() dto: IniciarCambioDto, @UsuarioActual() usuarioId: string) {
    return this.cambios.iniciar(dto, usuarioId);
  }

  /** Nuevos titulares y domicilios legales (lista completa, mismo formato que el paso 2 del alta). Es una propuesta. */
  @Put(':id/titulares')
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  guardarTitulares(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarTitularesDto, @UsuarioActual() usuarioId: string) {
    return this.cambios.guardarTitulares(String(id), dto, usuarioId);
  }

  // Circuito por las oficinas

  /** Catastro: cancela un cambio iniciado por error, antes de enviarlo ({ observaciones }: el motivo). */
  @Post(':id/cancelar')
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelarInicioDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.cancelarInicio(String(id), dto, usuarioId);
  }

  /** Catastro: termina la carga y lo envía a Recaudación. */
  @Post(':id/enviar')
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  enviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.enviar(String(id), dto, usuarioId);
  }

  /** Catastro: corrigió lo observado y lo reenvía a la oficina que lo observó. */
  @Post(':id/reenviar')
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  reenviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.reenviar(String(id), dto, usuarioId);
  }

  /** Recaudación: concesiones otorgadas de los titulares actuales y nuevos, y si tienen deuda. */
  @Get(':id/recaudacion')
  @ConDatosSensibles()
  @SoloOficina(Oficina.RECAUDACION)
  antecedentesDeuda(@Param('id', ParseIntPipe) id: number) {
    return this.circuito.antecedentesDeuda(String(id));
  }

  /** Recaudación: por cada concesión, si tiene deuda. Ninguna: pasa a Distrito. Alguna: en espera. */
  @Post(':id/recaudacion')
  @RequierePermiso(Permiso.DEUDA_VERIFICAR)
  recaudacion(@Param('id', ParseIntPipe) id: number, @Body() dto: VerificacionDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificarDeuda(String(id), dto, usuarioId);
  }

  /** Recaudación: en espera por deuda que no se pudo cobrar → pasa igual con la nota. */
  @Post(':id/recaudacion/curso-con-deuda')
  @RequierePermiso(Permiso.DEUDA_VERIFICAR)
  cursoConDeuda(@Param('id', ParseIntPipe) id: number, @Body() dto: CursoConDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.darCursoConDeuda(String(id), dto, usuarioId);
  }

  /** Recaudación: avisa por correo a los titulares con deuda pendiente. */
  @Post(':id/recaudacion/notificar-deuda')
  @RequierePermiso(Permiso.DEUDA_VERIFICAR)
  notificarDeuda(@Param('id', ParseIntPipe) id: number, @Body() dto: NotificarDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.notificarDeuda(String(id), dto, usuarioId);
  }

  /** Distrito: APTO / OBSERVADO / NO_APTO. */
  @Post(':id/distrito')
  @RequierePermiso(Permiso.DISTRITO_DICTAMINAR)
  distrito(@Param('id', ParseIntPipe) id: number, @Body() dto: DictamenDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.dictaminar(String(id), Etapa.DISTRITO, dto, usuarioId);
  }

  /** Jurídico: APTO / OBSERVADO / NO_APTO. */
  @Post(':id/juridico')
  @RequierePermiso(Permiso.JURIDICO_DICTAMINAR)
  juridico(@Param('id', ParseIntPipe) id: number, @Body() dto: DictamenDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.dictaminar(String(id), Etapa.JURIDICO, dto, usuarioId);
  }

  /** Secretaría General: carga la resolución (sin número de concesión: ya lo tiene) y lo pasa a Catastro. */
  @Post(':id/resolucion')
  @RequierePermiso(Permiso.RESOLUCION_CARGAR)
  resolucion(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolucionDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.registrarResolucion(String(id), dto, usuarioId);
  }

  /** Catastro: verificación final. El cambio FINALIZA y la concesión pasa a los nuevos titulares. */
  @Post(':id/verificacion-final')
  @RequierePermiso(Permiso.TITULARIDAD_GESTIONAR)
  verificacionFinal(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificacionFinal(String(id), dto, usuarioId);
  }
}
