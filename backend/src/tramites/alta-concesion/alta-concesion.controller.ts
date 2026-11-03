import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Etapa } from '../../expedientes/expedientes.constantes.js';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { RecibirKml, type ArchivoSubido } from '../../sig/kml/archivo-kml.js';
import { AltaCircuitoService } from './alta-circuito.service.js';
import { AltaConcesionService } from './alta-concesion.service.js';
import { CancelarInicioDto, CursoConDeudaDto, DictamenDto, NotificarDeudaDto, ObservacionesDto, PadronDto, ResolucionDto, VerificacionDeudaDto } from '../circuito/dto/circuito.dto.js';
import { CorregirInmuebleDto, CorregirSuministroDto, CorregirTitularesDto, CorregirUbicacionDto } from './dto/correccion.dto.js';
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
import { ConDatosSensibles, exigirPermiso, RequierePermiso, SesionActual, SoloOficina, type UsuarioSesion } from '../../seguridad/auth.decorators.js';
import { Permiso } from '../../seguridad/permisos.constantes.js';
import { Oficina } from '../../expedientes/expedientes.constantes.js';

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


  //Todo lo cargado del alta, dónde está y qué pasos de la carga están completos.
  @Get(':id')
  @ConDatosSensibles()
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.alta.obtener(String(id));
  }

  //Paso 1.1: registra el expediente en papel e inicia el alta.
  @Post()
  @RequierePermiso(Permiso.ALTA_INICIAR)
  iniciar(@Body() dto: IniciarAltaDto, @UsuarioActual() usuarioId: string) {
    return this.inicio.iniciar(dto, usuarioId);
  }

  //Paso 1.2: titulares (personas únicas por documento) y domicilios legales.
  @Put(':id/titulares')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  guardarTitulares(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarTitularesDto, @UsuarioActual() usuarioId: string) {
    return this.titulares.guardar(String(id), dto, usuarioId);
  }

  //Paso 1.3: ubicación de la concesión. multipart/form-data: departamento, localidad y distrito + «archivo» (KML/GeoJSON, optativo).
  @Put(':id/ubicacion')
  @UseInterceptors(RecibirKml())
  @RequierePermiso(Permiso.ALTA_CARGAR)
  guardarUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UbicacionDto,
    @UsuarioActual() usuarioId: string,
    @SesionActual() sesion: UsuarioSesion,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    // El polígono cambia lo que se ve en el visor: subirlo es un permiso aparte.
    if (archivo) exigirPermiso(sesion, Permiso.KML_CARGAR);
    return this.ubicacion.guardar(String(id), dto, usuarioId, archivo);
  }

  //Paso 1.4: inmueble (datos catastrales + registro de dominio).
  @Put(':id/inmueble')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  guardarInmueble(@Param('id', ParseIntPipe) id: number, @Body() dto: DatosInmuebleDto, @UsuarioActual() usuarioId: string) {
    return this.inmueble.guardar(String(id), dto, usuarioId);
  }

  //Paso 1.5: usos, magnitudes, desagüe y punto de entrega.
  @Put(':id/usos')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  guardarUsos(@Param('id', ParseIntPipe) id: number, @Body() dto: UsosDto, @UsuarioActual() usuarioId: string) {
    return this.usos.guardar(String(id), dto, usuarioId);
  }

  //Paso 1.6: suministro (fuente, sistema, canales) y caudal asignado.
  @Put(':id/suministro')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  guardarSuministro(@Param('id', ParseIntPipe) id: number, @Body() dto: SuministroDto, @UsuarioActual() usuarioId: string) {
    return this.suministro.guardar(String(id), dto, usuarioId);
  }

  // Corrección de errores materiales (por fuera del circuito)
  //
  // Desde que el alta sale de la carga (con o sin resolución): datos mal escritos o un KML mal
  // cargado. Permiso «Corregir datos de altas»; el polígono, además, «Cargar o reemplazar el KML».
  // Cada una pide el motivo y queda en el historial con el antes y el después, y en la auditoría.
  // Los usos y el caudal no se corrigen: son lo otorgado (ampliación o reducción).

  @Put(':id/correccion/titulares')
  @RequierePermiso(Permiso.ALTA_CORREGIR)
  corregirTitulares(@Param('id', ParseIntPipe) id: number, @Body() { motivo, ...dto }: CorregirTitularesDto, @UsuarioActual() usuarioId: string) {
    return this.titulares.guardar(String(id), dto, usuarioId, motivo);
  }

  /**
   * multipart/form-data. Si viene «archivo» y el polígono vigente ya está publicado, el corregido
   * espera la aprobación de quien publica en el mapa (mientras tanto, afuera se ve el anterior).
   */
  @Put(':id/correccion/ubicacion')
  @UseInterceptors(RecibirKml())
  @RequierePermiso(Permiso.ALTA_CORREGIR)
  corregirUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() { motivo, ...dto }: CorregirUbicacionDto,
    @UsuarioActual() usuarioId: string,
    @SesionActual() sesion: UsuarioSesion,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    if (archivo) exigirPermiso(sesion, Permiso.KML_CARGAR);
    return this.ubicacion.guardar(String(id), dto, usuarioId, archivo, motivo);
  }

  @Put(':id/correccion/inmueble')
  @RequierePermiso(Permiso.ALTA_CORREGIR)
  corregirInmueble(@Param('id', ParseIntPipe) id: number, @Body() { motivo, ...dto }: CorregirInmuebleDto, @UsuarioActual() usuarioId: string) {
    return this.inmueble.guardar(String(id), dto, usuarioId, motivo);
  }

  @Put(':id/correccion/suministro')
  @RequierePermiso(Permiso.ALTA_CORREGIR)
  corregirSuministro(@Param('id', ParseIntPipe) id: number, @Body() { motivo, ...dto }: CorregirSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.suministro.guardar(String(id), dto, usuarioId, motivo);
  }

  // Circuito por las oficinas


  /**
   * Catastro: cancela un alta iniciada por error, antes de enviarla ({ observaciones }: el motivo).
   * El expediente queda ANULADO en el historial y su número se puede volver a registrar.
   */
  @Post(':id/cancelar')
  @RequierePermiso(Permiso.ALTA_INICIAR)
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelarInicioDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.cancelarInicio(String(id), dto, usuarioId);
  }

  //Catastro: termina la carga preliminar y lo envía a Recaudación.
  @Post(':id/enviar')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  enviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.enviar(String(id), dto, usuarioId);
  }

  // Catastro: corrigió lo observado y lo reenvía a la oficina que lo observó.
  @Post(':id/reenviar')
  @RequierePermiso(Permiso.ALTA_CARGAR)
  reenviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.reenviar(String(id), dto, usuarioId);
  }

  // Recaudación: concesiones otorgadas de los titulares (tener otra solo se informa) y si tienen deuda.
  @Get(':id/recaudacion')
  @ConDatosSensibles()
  @SoloOficina(Oficina.RECAUDACION)
  antecedentesDeuda(@Param('id', ParseIntPipe) id: number) {
    return this.circuito.antecedentesDeuda(String(id));
  }

  /**
   * Recaudación: por cada concesión otorgada de los titulares, si tiene deuda
   * ({ concesiones: [{ concesionId, tieneDeuda }] }). Ninguna: pasa a Distrito. Alguna: en espera.
   */
  @Post(':id/recaudacion')
  @RequierePermiso(Permiso.DEUDA_VERIFICAR)
  recaudacion(@Param('id', ParseIntPipe) id: number, @Body() dto: VerificacionDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificarDeuda(String(id), dto, usuarioId);
  }

  /**
   * Recaudación: el expediente está en espera por deuda y no se pudo cobrar → pasa igual a
   * Distrito con la nota de por qué ({ observaciones }). La deuda sigue pendiente.
   */
  @Post(':id/recaudacion/curso-con-deuda')
  @RequierePermiso(Permiso.DEUDA_VERIFICAR)
  cursoConDeuda(@Param('id', ParseIntPipe) id: number, @Body() dto: CursoConDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.darCursoConDeuda(String(id), dto, usuarioId);
  }

  /** Recaudación: avisa por correo a los titulares con deuda pendiente (cada envío queda registrado). */
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

  /**
   * Secretaría General: pide a Catastro el número de concesión. Catastro lo carga desde su
   * bandeja (POST /api/solicitudes-numero/:id/asignar). Pedirlo dos veces no crea otro pedido.
   */
  @Post(':id/numero-concesion')
  @RequierePermiso(Permiso.NUMERO_SOLICITAR)
  numeroConcesion(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.circuito.solicitarNumero(String(id), usuarioId);
  }

  /** Secretaría General: carga la resolución (necesita el N° de concesión ya cargado) y lo pasa a Catastro. */
  @Post(':id/resolucion')
  @RequierePermiso(Permiso.RESOLUCION_CARGAR)
  resolucion(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolucionDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.registrarResolucion(String(id), dto, usuarioId);
  }

  /** Catastro: verificación final; queda esperando el padrón de Rentas. */
  @Post(':id/verificacion-final')
  @RequierePermiso(Permiso.ALTA_CERRAR)
  verificacionFinal(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservacionesDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.verificacionFinal(String(id), dto, usuarioId);
  }

  /** Catastro: carga el padrón de Rentas y el trámite finaliza (concesión VIGENTE). */
  @Post(':id/padron')
  @RequierePermiso(Permiso.ALTA_CERRAR)
  padron(@Param('id', ParseIntPipe) id: number, @Body() dto: PadronDto, @UsuarioActual() usuarioId: string) {
    return this.circuito.registrarPadron(String(id), dto, usuarioId);
  }
}
