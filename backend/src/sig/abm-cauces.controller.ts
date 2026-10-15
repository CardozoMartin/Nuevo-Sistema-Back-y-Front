import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { BajaCatalogoDto } from '../catalogos/dto/abm-ubicaciones.dto.js';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { CaucesService } from './cauces.service.js';
import { CauceDto, EditarCauceDto, FiltroCaucesDto } from './dto/cauce.dto.js';
import { RequierePermiso } from '../seguridad/auth.decorators.js';
import { Permiso } from '../seguridad/permisos.constantes.js';

/**
 * ABM de ríos y canales (sig.cauce), solo por la API (sin pantalla por ahora):
 *
 *   GET    /api/catalogos/cauces              listado sin trazado (?todas=true, ?q=, ?tipo=RIO|CANAL, ?fuente=)
 *   GET    /api/catalogos/cauces/:id          uno, con su trazado completo en WGS84
 *   POST   /api/catalogos/cauces              alta { nombre, tipo, linea, sistema?, fuente? }
 *   PUT    /api/catalogos/cauces/:id          modificación (solo lo que cambia; con «linea», el trazado nuevo)
 *   DELETE /api/catalogos/cauces/:id          BAJA LÓGICA con { "motivo" }
 *   POST   /api/catalogos/cauces/:id/reactivar
 *
 * La capa para el mapa sigue en GET /api/sig/cauces (solo los activos, simplificados).
 * Modifican solo usuarios de Catastro o administradores (encabezado X-Usuario-Id, TODO(login)).
 */
@Controller('catalogos/cauces')
export class AbmCaucesController {
  constructor(private readonly cauces: CaucesService) {}

  @Get()
  listar(@Query() filtro: FiltroCaucesDto) {
    return this.cauces.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.cauces.obtener(id);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Post()
  crear(@Body() dto: CauceDto, @UsuarioActual() usuarioId: string) {
    return this.cauces.crear(dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Put(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarCauceDto, @UsuarioActual() usuarioId: string) {
    return this.cauces.editar(id, dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Delete(':id')
  darDeBaja(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.cauces.darDeBaja(id, dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Post(':id/reactivar')
  reactivar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.cauces.reactivar(id, usuarioId);
  }
}
