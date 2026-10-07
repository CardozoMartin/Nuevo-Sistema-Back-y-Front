import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Etapa } from '../../expedientes/expedientes.constantes.js';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { RecibirKml, type ArchivoSubido } from '../../sig/kml/archivo-kml.js';
import { AltaCircuitoService } from './alta-circuito.service.js';
import { AltaConcesionService } from './alta-concesion.service.js';
import { DictamenDto, NotificarDeudaDto, ObservacionesDto, PadronDto, ResolucionDto, VerificacionDeudaDto } from '../circuito/dto/circuito.dto.js';
import { DatosInmuebleDto } from './dto/datos-inmueble.dto.js';
import { GuardarTitularesDto } from './dto/guardar-titulares.dto.js';
import { IniciarAltaDto } from './dto/iniciar-alta.dto.js';
import { SuministroDto } from './dto/suministro.dto.js';
import { UbicacionDto } from './dto/ubicacion.dto.js';
import { UsosDto } from './dto/usos.dto.js';
import { InicioAltaService } from './pasos/paso1-inicio.service.js';
import { TitularesAltaService } from './pasos/paso2-titulares.service.js';
import { UbicacionAltaService } from './pasos/paso3-ubicacion.service.js';
import { InmuebleAltaService } from './pasos/paso4-inmueble.service.js';
import { UsosAltaService } from './pasos/paso5-usos.service.js';
import { SuministroAltaService } from './pasos/paso6-suministro.service.js';

/**
 * Endpoints del Alta de Concesión. `:id` es el id del expediente.
 * Quién actúa sale del encabezado X-Usuario-Id (TODO(login): de la sesión).
 * Para tomar el expediente y ver el historial: /api/expedientes/:id/tomar y /historial.
 */
@Controller('tramites/alta-concesion')
export class AltaConcesionController {
  constructor(
    private readonly alta: AltaConcesionService,
    private readonly inicio: InicioAltaService,
    private readonly titulares: TitularesAltaService,
    private readonly ubicacion: UbicacionAltaService,
    private readonly inmueble: InmuebleAltaService,
    private readonly usos: UsosAltaService,
    private readonly suministro: SuministroAltaService,
    private readonly circuito: AltaCircuitoService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Altas que Catastro está cargando o corrigiendo. */
  @Get()
  listarEnCarga() {
    return this.alta.listarEnCarga();
  }

  /** Todo lo cargado del alta, dónde está y qué pasos de la carga están completos. */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.alta.obtener(String(id));
  }

  // ---------------------------------------------------------------------------
  // Catastro: carga de datos (cada PUT guarda una sección completa)
  // ---------------------------------------------------------------------------

  /** Paso 1: registra el expediente en papel e inicia el alta. */
  @Post()
  iniciar(@Body() dto: IniciarAltaDto, @UsuarioActual() usuarioId: string) {
    return this.inicio.iniciar(dto, usuarioId);
  }

  /** Paso 2: titulares (personas únicas por documento) y domicilios legales. */
  @Put(':id/titulares')
  guardarTitulares(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarTitularesDto, @UsuarioActual() usuarioId: string) {
    return this.titulares.guardar(String(id), dto, usuarioId);
  }

  /** Paso 3: ubicación de la concesión. multipart/form-data: departamento, localidad y distrito + «archivo» (KML/GeoJSON, optativo). */
  @Put(':id/ubicacion')
  @UseInterceptors(RecibirKml())
  guardarUbicacion(@Param('id', ParseIntPipe) id: number, @Body() dto: UbicacionDto, @UsuarioActual() usuarioId: string, @UploadedFile() archivo?: ArchivoSubido) {
    return this.ubicacion.guardar(String(id), dto, usuarioId, archivo);
  }

  /** Paso 4: inmueble (datos catastrales + registro de dominio). */
  @Put(':id/inmueble')
  guardarInmueble(@Param('id', ParseIntPipe) id: number, @Body() dto: DatosInmuebleDto, @UsuarioActual() usuarioId: string) {
    return this.inmueble.guardar(String(id), dto, usuarioId);
  }

  /** Paso 5: usos, magnitudes, desagüe y punto de entrega. */
  @Put(':id/usos')
  guardarUsos(@Param('id', ParseIntPipe) id: number, @Body() dto: UsosDto, @UsuarioActual() usuarioId: string) {
    return this.usos.guardar(String(id), dto, usuarioId);
  }

  /** Paso 6: suministro (fuente, sistema, canales) y caudal asignado. */
  @Put(':id/suministro')
  guardarSuministro(@Param('id', ParseIntPipe) id: number, @Body() dto: SuministroDto, @UsuarioActual() usuarioId: string) {
    return this.suministro.guardar(String(id), dto, usuarioId);
  }

  // ---------------------------------------------------------------------------
  // Circuito por las oficinas
  // ---------------------------------------------------------------------------

  /** Catastro: termina la carga y lo envía a Recaudación. */
  @Post(':id/enviar')
  enviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.enviar(String(id), dto, usuarioId);
  }

  /** Catastro: corrigió lo observado y lo reenvía a la oficina que lo observó. */
  @Post(':id/reenviar')
  reenviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.reenviar(String(id), dto, usuarioId);
  }

  /** Recaudación: SIN_DEUDA (pasa a Distrito) o CON_DEUDA (queda en espera hasta que paguen). */
  @Post(':id/recaudacion')
  recaudacion(@Param('id', ParseIntPipe) id: number, @Body() dto: VerificacionDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificarDeuda(String(id), dto, usuarioId);
  }

  /** Recaudación: avisa por correo a los titulares con deuda pendiente (cada envío queda registrado). */
  @Post(':id/recaudacion/notificar-deuda')
  notificarDeuda(@Param('id', ParseIntPipe) id: number, @Body() dto: NotificarDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.notificarDeuda(String(id), dto, usuarioId);
  }

  /** Distrito: APTO / OBSERVADO / NO_APTO. */
  @Post(':id/distrito')
  distrito(@Param('id', ParseIntPipe) id: number, @Body() dto: DictamenDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.dictaminar(String(id), Etapa.DISTRITO, dto, usuarioId);
  }

  /** Jurídico: APTO / OBSERVADO / NO_APTO. */
  @Post(':id/juridico')
  juridico(@Param('id', ParseIntPipe) id: number, @Body() dto: DictamenDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.dictaminar(String(id), Etapa.JURIDICO, dto, usuarioId);
  }

  /**
   * Secretaría General: pide a Catastro el número de concesión. Catastro lo carga desde su
   * bandeja (POST /api/solicitudes-numero/:id/asignar). Pedirlo dos veces no crea otro pedido.
   */
  @Post(':id/numero-concesion')
  numeroConcesion(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.circuito.solicitarNumero(String(id), usuarioId);
  }

  /** Secretaría General: carga la resolución (necesita el N° de concesión ya cargado) y lo pasa a Catastro. */
  @Post(':id/resolucion')
  resolucion(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolucionDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.registrarResolucion(String(id), dto, usuarioId);
  }

  /** Catastro: verificación final; queda esperando el padrón de Rentas. */
  @Post(':id/verificacion-final')
  verificacionFinal(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificacionFinal(String(id), dto, usuarioId);
  }

  /** Catastro: carga el padrón de Rentas y el trámite finaliza (concesión VIGENTE). */
  @Post(':id/padron')
  padron(@Param('id', ParseIntPipe) id: number, @Body() dto: PadronDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.registrarPadron(String(id), dto, usuarioId);
  }
}
