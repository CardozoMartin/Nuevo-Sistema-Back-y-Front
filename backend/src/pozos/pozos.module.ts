import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BajaPozo } from './entities/baja-pozo.entity.js';
import { Pozo } from './entities/pozo.entity.js';
import { PozosController } from './pozos.controller.js';
import { PozosService } from './pozos.service.js';

/**
 * Pozos (poz_): la tabla de pozos, su búsqueda y ficha, y la tabla de bajas. Los pozos
 * entran por la importación y se ven en el mapa (capa sig.v_pozos); el circuito de la baja
 * está en tramites/baja-pozo. El alta de pozo y la autorización de perforación vienen después.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Pozo, BajaPozo])],
  controllers: [PozosController],
  providers: [PozosService],
  exports: [TypeOrmModule, PozosService],
})
export class PozosModule {}
