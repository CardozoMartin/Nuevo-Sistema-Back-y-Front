import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { CuencasService } from './abm/cuencas.service.js';
import { DepartamentosService } from './abm/departamentos.service.js';
import { DistritosService } from './abm/distritos.service.js';
import { LocalidadesService } from './abm/localidades.service.js';
import { BajaCatalogoDto, DistritoDto, FiltroCatalogoDto, FiltroLocalidadesDto, LocalidadDto, NombreCatalogoDto } from './dto/abm-ubicaciones.dto.js';

/**
 * ABM del catálogo de ubicación: departamentos, localidades, distritos y cuencas.
 *
 * Para cada uno:
 *   GET    /api/catalogos/<catalogo>              listado (?todas=true incluye los dados de baja; ?q= busca)
 *   GET    /api/catalogos/<catalogo>/:id          uno
 *   POST   /api/catalogos/<catalogo>              alta
 *   PUT    /api/catalogos/<catalogo>/:id          modificación
 *   DELETE /api/catalogos/<catalogo>/:id          BAJA LÓGICA, con { "motivo" } (nunca se borra la fila)
 *   POST   /api/catalogos/<catalogo>/:id/reactivar
 *
 * Modifican solo usuarios de Catastro o administradores (encabezado X-Usuario-Id, TODO(login)).
 * Lo que usa el formulario (la cascada de activos) sigue en GET /api/catalogos/ubicaciones.
 */
@Controller('catalogos')
export class AbmUbicacionesController {
  constructor(
    private readonly departamentos: DepartamentosService,
    private readonly localidades: LocalidadesService,
    private readonly distritos: DistritosService,
    private readonly cuencas: CuencasService,
  ) {}

  // --- Departamentos -------------------------------------------------------------

  @Get('departamentos')
  listarDepartamentos(@Query() filtro: FiltroCatalogoDto) {
    return this.departamentos.listar(filtro);
  }

  @Get('departamentos/:id')
  obtenerDepartamento(@Param('id', ParseIntPipe) id: number) {
    return this.departamentos.obtener(id);
  }

  @Post('departamentos')
  crearDepartamento(@Body() dto: NombreCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.departamentos.crear(dto, usuarioId);
  }

  @Put('departamentos/:id')
  editarDepartamento(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.departamentos.editar(id, dto, usuarioId);
  }

  @Delete('departamentos/:id')
  bajaDepartamento(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.departamentos.darDeBaja(id, dto, usuarioId);
  }

  @Post('departamentos/:id/reactivar')
  reactivarDepartamento(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.departamentos.reactivar(id, usuarioId);
  }

  // --- Localidades (?departamentoId= y ?distritoId= para filtrar) -----------------

  @Get('localidades')
  listarLocalidades(@Query() filtro: FiltroLocalidadesDto) {
    return this.localidades.listar(filtro);
  }

  @Get('localidades/:id')
  obtenerLocalidad(@Param('id', ParseIntPipe) id: number) {
    return this.localidades.obtener(id);
  }

  @Post('localidades')
  crearLocalidad(@Body() dto: LocalidadDto, @UsuarioActual() usuarioId: string) {
    return this.localidades.crear(dto, usuarioId);
  }

  @Put('localidades/:id')
  editarLocalidad(@Param('id', ParseIntPipe) id: number, @Body() dto: LocalidadDto, @UsuarioActual() usuarioId: string) {
    return this.localidades.editar(id, dto, usuarioId);
  }

  @Delete('localidades/:id')
  bajaLocalidad(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.localidades.darDeBaja(id, dto, usuarioId);
  }

  @Post('localidades/:id/reactivar')
  reactivarLocalidad(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.localidades.reactivar(id, usuarioId);
  }

  // --- Distritos ------------------------------------------------------------------

  @Get('distritos')
  listarDistritos(@Query() filtro: FiltroCatalogoDto) {
    return this.distritos.listar(filtro);
  }

  @Get('distritos/:id')
  obtenerDistrito(@Param('id', ParseIntPipe) id: number) {
    return this.distritos.obtener(id);
  }

  @Post('distritos')
  crearDistrito(@Body() dto: DistritoDto, @UsuarioActual() usuarioId: string) {
    return this.distritos.crear(dto, usuarioId);
  }

  @Put('distritos/:id')
  editarDistrito(@Param('id', ParseIntPipe) id: number, @Body() dto: DistritoDto, @UsuarioActual() usuarioId: string) {
    return this.distritos.editar(id, dto, usuarioId);
  }

  @Delete('distritos/:id')
  bajaDistrito(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.distritos.darDeBaja(id, dto, usuarioId);
  }

  @Post('distritos/:id/reactivar')
  reactivarDistrito(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.distritos.reactivar(id, usuarioId);
  }

  // --- Cuencas --------------------------------------------------------------------

  @Get('cuencas')
  listarCuencas(@Query() filtro: FiltroCatalogoDto) {
    return this.cuencas.listar(filtro);
  }

  @Get('cuencas/:id')
  obtenerCuenca(@Param('id', ParseIntPipe) id: number) {
    return this.cuencas.obtener(id);
  }

  @Post('cuencas')
  crearCuenca(@Body() dto: NombreCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.cuencas.crear(dto, usuarioId);
  }

  @Put('cuencas/:id')
  editarCuenca(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.cuencas.editar(id, dto, usuarioId);
  }

  @Delete('cuencas/:id')
  bajaCuenca(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.cuencas.darDeBaja(id, dto, usuarioId);
  }

  @Post('cuencas/:id/reactivar')
  reactivarCuenca(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.cuencas.reactivar(id, usuarioId);
  }
}
