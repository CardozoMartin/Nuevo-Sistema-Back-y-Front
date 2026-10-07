import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresasController } from './empresas.controller.js';
import { EmpresasService } from './empresas.service.js';
import { Empresa } from './entities/empresa.entity.js';
import { Maquina } from './entities/maquina.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, Maquina])],
  controllers: [EmpresasController],
  providers: [EmpresasService],
})
export class EmpresasModule {}
