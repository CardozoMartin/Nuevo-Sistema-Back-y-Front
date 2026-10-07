import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { CatalogosService } from './catalogos.service.js';
import { FiltroZonasDto, UbicacionSuministroDto, VincularZonaDto } from './dto/suministro.dto.js';
import { SuministroCatalogoService } from './suministro/suministro-catalogo.service.js';
import { UbicacionesService } from './ubicaciones.service.js';

@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly catalogos: CatalogosService,
    private readonly ubicaciones: UbicacionesService,
    private readonly suministro: SuministroCatalogoService,
  ) {}

  /**
   * GET /api/catalogos/suministro: el catálogo de suministro de riego en el formato de
   * /catalogoSuministro de json-server (departamento → localidad → distrito → fuentes,
   * sistemas, canales y desagües), con los nombres del catálogo de ubicación.
   * Con ?departamento=&localidad=&distrito= devuelve solo lo de esa ubicación (o null si no hay).
   */
  @Get('suministro')
  async catalogoSuministro(@Query() u: UbicacionSuministroDto) {
    const algunos = [u.departamento, u.localidad, u.distrito].filter(Boolean).length;
    if (algunos === 0) return this.suministro.obtenerCatalogo();
    if (algunos < 3) throw new BadRequestException('Indique departamento, localidad y distrito (los tres) o ninguno.');
    const ubicacion = await this.ubicaciones.exigirUbicacion({ departamento: u.departamento!, localidad: u.localidad!, distrito: u.distrito! });
    return this.suministro.datosPara(ubicacion.localidad.id, ubicacion.distrito.id);
  }

  /**
   * GET /api/catalogos/suministro/zonas?sinVincular=true: las zonas del catálogo de la DRH con la
   * localidad a la que están vinculadas. Las que no tienen localidad no se ofrecen en el formulario.
   */
  @Get('suministro/zonas')
  zonasSuministro(@Query() filtro: FiltroZonasDto) {
    return this.suministro.listarZonas({ sinVincular: filtro.sinVincular });
  }

  /**
   * PUT /api/catalogos/suministro/zonas/:id/localidad { localidadId }: vincula una zona del
   * catálogo de la DRH a una localidad (ej: «TRANCAS» → «VILLA DE TRANCAS»). Catastro o administrador.
   */
  @Put('suministro/zonas/:id/localidad')
  vincularZona(@Param('id', ParseIntPipe) id: number, @Body() dto: VincularZonaDto, @UsuarioActual() usuarioId: string) {
    return this.suministro.vincular(id, dto.localidadId, usuarioId);
  }

  /**
   * GET /api/catalogos/ubicaciones: departamento → localidad → distritos, en el mismo formato
   * que el /catalogoLocalidades de json-server ({ "BURRUYACU": { "7 DE ABRIL": ["II"] } }).
   * Alimenta la cascada del domicilio del titular y de la ubicación de la concesión.
   */
  @Get('ubicaciones')
  ubicacionesCatalogo() {
    return this.ubicaciones.obtenerCatalogo();
  }

  /** GET /api/catalogos/situaciones-legales: alimenta el checklist del paso 1 del alta. */
  @Get('situaciones-legales')
  situacionesLegales() {
    return this.catalogos.listarSituacionesLegales();
  }

  /** GET /api/catalogos/tipos-uso: usos con su dotación (paso 5 del alta). */
  @Get('tipos-uso')
  async tiposUso() {
    const tipos = await this.catalogos.listarTiposUso();
    return tipos.map(({ codigo, nombre, dotacion, unidad, requierePuntoEntrega }) => ({
      codigo,
      nombre,
      dotacion: Number(dotacion),
      unidad,
      requierePuntoEntrega,
    }));
  }
}
