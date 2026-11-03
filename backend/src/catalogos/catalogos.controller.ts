import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CatalogosService } from './catalogos.service.js';
import { DominioService } from './dominio.service.js';
import { DistritoSuministroDto } from './dto/suministro.dto.js';
import { Distrito } from './entities/distrito.entity.js';
import { SuministroCatalogoService } from './suministro/suministro-catalogo.service.js';
import { UbicacionesService } from './ubicaciones.service.js';

@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly catalogos: CatalogosService,
    private readonly ubicaciones: UbicacionesService,
    private readonly suministro: SuministroCatalogoService,
    @InjectRepository(Distrito) private readonly distritos: Repository<Distrito>,
  ) {}

  /**
   * GET /api/catalogos/suministro: el árbol de suministro de riego de cada distrito, solo lo
   * activo: { "I": [{ nombre, nivel: "FUENTE", hijos: [{ nombre, nivel: "SISTEMA", hijos }] }] }.
   * Con ?distrito=II devuelve solo las fuentes de ese distrito (o null si no tiene árbol).
   */
  @Get('suministro')
  async catalogoSuministro(@Query() { distrito }: DistritoSuministroDto) {
    if (!distrito) return this.suministro.obtenerCatalogo();
    const fila = await this.distritos.findOneBy({ codigo: distrito, activo: true });
    if (!fila) throw new NotFoundException(`No existe el distrito ${distrito}.`);
    return this.suministro.arbolDe(fila.id);
  }

  // El ABM del árbol de suministro está en AbmSuministroController.

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

@Controller('dominio')
export class DominioController {
  constructor(private readonly dominio: DominioService) {}

  /**
   * GET /api/dominio: todos los datos de referencia que el frontend carga al abrir la app
   * (oficinas, etapas, trámites, estados, usos, situaciones legales, listas y usuarios).
   */
  @Get()
  obtener() {
    return this.dominio.obtener();
  }
}
