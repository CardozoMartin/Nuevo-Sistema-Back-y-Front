import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { BajaCatalogoDto } from './dto/abm-ubicaciones.dto.js';
import { CanalSuministroDto, EditarZonaSuministroDto, FiltroZonasDto, NombreSuministroDto, OpcionSuministroDto, VincularZonaDto, ZonaSuministroDto } from './dto/suministro.dto.js';
import { SuministroAbmService } from './suministro/suministro-abm.service.js';
import { SuministroCatalogoService } from './suministro/suministro-catalogo.service.js';

/**
 * ABM del catálogo de suministro de riego (solo por la API, sin pantalla por ahora):
 *
 *   Zonas (departamento + localidad + distrito)
 *     GET    /api/catalogos/suministro/zonas                 listado (?sinVincular=true, ?todas=true)
 *     GET    /api/catalogos/suministro/zonas/:id             ficha: listas y árbol de canales, con ids
 *     POST   /api/catalogos/suministro/zonas                 alta
 *     PUT    /api/catalogos/suministro/zonas/:id             corrige el nombre de origen
 *     PUT    /api/catalogos/suministro/zonas/:id/localidad   vincula a una localidad (null desvincula)
 *     DELETE /api/catalogos/suministro/zonas/:id             BAJA LÓGICA con { "motivo" }
 *     POST   /api/catalogos/suministro/zonas/:id/reactivar
 *
 *   Fuentes, sistemas y desagües de una zona
 *     POST   /api/catalogos/suministro/zonas/:id/opciones    alta { tipo, nombre }
 *     PUT    /api/catalogos/suministro/opciones/:id          corrige el nombre
 *     DELETE /api/catalogos/suministro/opciones/:id          BAJA LÓGICA
 *     POST   /api/catalogos/suministro/opciones/:id/reactivar
 *
 *   Canales (el árbol)
 *     POST   /api/catalogos/suministro/zonas/:id/canales     alta { nombre, padreId? }
 *     PUT    /api/catalogos/suministro/canales/:id           corrige el nombre
 *     DELETE /api/catalogos/suministro/canales/:id           BAJA LÓGICA (con sus derivaciones)
 *     POST   /api/catalogos/suministro/canales/:id/reactivar
 *
 * Modifican solo usuarios de Catastro o administradores (encabezado X-Usuario-Id, TODO(login)).
 * Lo que usa el formulario sigue en GET /api/catalogos/suministro (solo lo activo).
 */
@Controller('catalogos/suministro')
export class AbmSuministroController {
  constructor(
    private readonly catalogo: SuministroCatalogoService,
    private readonly abm: SuministroAbmService,
  ) {}

  // --- Zonas ----------------------------------------------------------------------

  @Get('zonas')
  listarZonas(@Query() filtro: FiltroZonasDto) {
    return this.catalogo.listarZonas({ sinVincular: filtro.sinVincular, todas: filtro.todas });
  }

  @Get('zonas/:id')
  obtenerZona(@Param('id', ParseIntPipe) id: number) {
    return this.abm.obtenerZona(id);
  }

  @Post('zonas')
  crearZona(@Body() dto: ZonaSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.crearZona(dto, usuarioId);
  }

  @Put('zonas/:id')
  editarZona(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarZonaSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.editarZona(id, dto, usuarioId);
  }

  /** Vincula una zona del catálogo de la DRH a una localidad (ej: «TRANCAS» → «VILLA DE TRANCAS»). */
  @Put('zonas/:id/localidad')
  vincularZona(@Param('id', ParseIntPipe) id: number, @Body() dto: VincularZonaDto, @UsuarioActual() usuarioId: string) {
    return this.catalogo.vincular(id, dto.localidadId, usuarioId);
  }

  @Delete('zonas/:id')
  bajaZona(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.abm.darDeBajaZona(id, dto, usuarioId);
  }

  @Post('zonas/:id/reactivar')
  reactivarZona(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.abm.reactivarZona(id, usuarioId);
  }

  // --- Fuentes, sistemas de distribución y desagües --------------------------------

  @Post('zonas/:id/opciones')
  crearOpcion(@Param('id', ParseIntPipe) zonaId: number, @Body() dto: OpcionSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.crearOpcion(zonaId, dto, usuarioId);
  }

  @Put('opciones/:id')
  editarOpcion(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.editarOpcion(id, dto, usuarioId);
  }

  @Delete('opciones/:id')
  bajaOpcion(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.abm.darDeBajaOpcion(id, dto, usuarioId);
  }

  @Post('opciones/:id/reactivar')
  reactivarOpcion(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.abm.reactivarOpcion(id, usuarioId);
  }

  // --- Canales ----------------------------------------------------------------------

  @Post('zonas/:id/canales')
  crearCanal(@Param('id', ParseIntPipe) zonaId: number, @Body() dto: CanalSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.crearCanal(zonaId, dto, usuarioId);
  }

  @Put('canales/:id')
  editarCanal(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.editarCanal(id, dto, usuarioId);
  }

  @Delete('canales/:id')
  bajaCanal(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.abm.darDeBajaCanal(id, dto, usuarioId);
  }

  @Post('canales/:id/reactivar')
  reactivarCanal(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.abm.reactivarCanal(id, usuarioId);
  }
}
