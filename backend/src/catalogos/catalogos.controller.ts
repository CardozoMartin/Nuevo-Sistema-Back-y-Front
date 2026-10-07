import { Controller, Get } from '@nestjs/common';
import { CatalogosService } from './catalogos.service.js';
import { UbicacionesService } from './ubicaciones.service.js';

@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly catalogos: CatalogosService,
    private readonly ubicaciones: UbicacionesService,
  ) {}

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
