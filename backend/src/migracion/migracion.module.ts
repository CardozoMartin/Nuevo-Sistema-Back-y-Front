import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModule } from '../catalogos/catalogos.module.js';
import { ConcesionesModule } from '../concesiones/concesiones.module.js';
import { SigModule } from '../sig/sig.module.js';
import { LoteMigracion } from './entities/lote-migracion.entity.js';
import { RegistroOrigen } from './entities/registro-origen.entity.js';
import { ImportadorService } from './importador.service.js';

/**
 * Migración del padrón anterior (mig_). No expone endpoints: se usa desde la línea de
 * comandos (src/migracion/cli.ts), porque una importación masiva no es una acción de la web.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LoteMigracion, RegistroOrigen]), CatalogosModule, ConcesionesModule, SigModule],
  providers: [ImportadorService],
  exports: [ImportadorService],
})
export class MigracionModule {}
