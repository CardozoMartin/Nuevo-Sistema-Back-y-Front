import { Controller, Get, Param, ParseIntPipe, Query, StreamableFile } from '@nestjs/common';
import { Oficina } from '../expedientes/expedientes.constantes.js';
import { ConDatosSensibles, SesionActual, SoloOficina, type UsuarioSesion } from '../seguridad/auth.decorators.js';
import { ConsultaConcesionesService } from './consulta-concesiones.service.js';
import { BuscarConcesionesQuery } from './dto/buscar-concesiones.query.js';
import { ExportarConcesionesService } from './exportar-concesiones.service.js';

/** Consulta de concesiones de Catastro (y administradores). */
@Controller('concesiones')
@SoloOficina(Oficina.CATASTRO)
export class ConcesionesController {
  constructor(
    private readonly consulta: ConsultaConcesionesService,
    private readonly exportador: ExportarConcesionesService,
  ) {}

  /** GET /api/concesiones/filtros: las opciones de cada filtro, de los catálogos de la base. */
  @Get('filtros')
  filtros() {
    return this.consulta.filtros();
  }

  /**
   * GET /api/concesiones/buscar?texto=&titular=&documento=&expediente=&padron=&distrito=&localidad=…:
   * concesiones que cumplen todos los filtros (ver BuscarConcesionesQuery), de a una página.
   */
  @Get('buscar')
  @ConDatosSensibles()
  buscar(@Query() query: BuscarConcesionesQuery) {
    return this.consulta.buscar(query);
  }

  /**
   * GET /api/concesiones/exportar?(los mismos filtros de /buscar): planilla Excel con TODAS las
   * concesiones que cumplen los filtros y todos sus detalles (concesiones, titulares, domicilios, usos, deudas).
   */
  @Get('exportar')
  async exportar(@Query() query: BuscarConcesionesQuery, @SesionActual() sesion: UsuarioSesion) {
    const archivo = await this.exportador.exportar(query, sesion);
    const nombre = `concesiones-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new StreamableFile(archivo, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: `attachment; filename="${nombre}"` });
  }

  /** GET /api/concesiones/:id: la ficha con todo lo vigente, el expediente y las deudas pendientes. */
  @Get(':id')
  @ConDatosSensibles()
  ficha(@Param('id', ParseIntPipe) id: number) {
    return this.consulta.ficha(String(id));
  }
}
