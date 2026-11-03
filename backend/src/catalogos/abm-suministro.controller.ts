import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { BajaCatalogoDto } from './dto/abm-ubicaciones.dto.js';
import { NodoSuministroDto, NombreSuministroDto } from './dto/suministro.dto.js';
import { SuministroAbmService } from './suministro/suministro-abm.service.js';
import { RequierePermiso } from '../seguridad/auth.decorators.js';
import { Permiso } from '../seguridad/permisos.constantes.js';

/**
 * ABM del árbol de suministro de riego de cada distrito
 * (fuente → sistema → canal principal → … → quinto → desagüe):
 *
 *   GET    /api/catalogos/suministro/distritos             distritos con cuántos tramos tienen
 *   GET    /api/catalogos/suministro/distritos/:id/arbol   el árbol con ids, también lo dado de baja
 *   POST   /api/catalogos/suministro/nodos                 alta { distritoId, nivel, nombre, padreId? }
 *   PUT    /api/catalogos/suministro/nodos/:id             corrige el nombre
 *   DELETE /api/catalogos/suministro/nodos/:id             BAJA LÓGICA con { "motivo" } (con lo que cuelga)
 *   POST   /api/catalogos/suministro/nodos/:id/reactivar
 *
 * Modifican solo usuarios de Catastro o administradores con el permiso «Administrar catálogos».
 * Lo que usa el formulario sigue en GET /api/catalogos/suministro (solo lo activo).
 */
@Controller('catalogos/suministro')
export class AbmSuministroController {
  constructor(private readonly abm: SuministroAbmService) {}

  @Get('distritos')
  listarDistritos() {
    return this.abm.listarDistritos();
  }

  @Get('distritos/:id/arbol')
  obtenerArbol(@Param('id', ParseIntPipe) id: number) {
    return this.abm.obtenerArbol(id);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Post('nodos')
  crear(@Body() dto: NodoSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.crear(dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Put('nodos/:id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreSuministroDto, @UsuarioActual() usuarioId: string) {
    return this.abm.editar(id, dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Delete('nodos/:id')
  darDeBaja(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaCatalogoDto, @UsuarioActual() usuarioId: string) {
    return this.abm.darDeBaja(id, dto, usuarioId);
  }

  @RequierePermiso(Permiso.CATALOGOS_ADMINISTRAR)
  @Post('nodos/:id/reactivar')
  reactivar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.abm.reactivar(id, usuarioId);
  }
}
