import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CrearEmpresaDto } from './dto/crear-empresa.dto.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  listar() {
    return this.empresasService.listar();
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.empresasService.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearEmpresaDto) {
    return this.empresasService.crear(dto);
  }
}
