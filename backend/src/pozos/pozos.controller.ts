import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PozosService } from './pozos.service.js';
import { ConDatosSensibles } from '../seguridad/auth.decorators.js';

@Controller('pozos')
export class PozosController {
  constructor(private readonly pozos: PozosService) {}

  /** GET /api/pozos?q=texto: busca por ID interno, alias, número de concesión o titular. */
  @ConDatosSensibles()
  @Get()
  buscar(@Query('q') q?: string) {
    return this.pozos.buscar(q);
  }

  /** GET /api/pozos/:id: ficha del pozo, con su concesión y la baja en trámite (si hay). */
  @ConDatosSensibles()
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.pozos.obtener(String(id));
  }
}
