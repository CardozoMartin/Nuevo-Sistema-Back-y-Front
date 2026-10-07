import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { ConcesionesModule } from './concesiones/concesiones.module.js';
import { crearDataSource, databaseConfig } from './config/database.config.js';
import { EmpresasModule } from './empresas/empresas.module.js';
import { ExpedientesModule } from './expedientes/expedientes.module.js';
import { HealthController } from './health/health.controller.js';
import { MigracionModule } from './migracion/migracion.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { PozosModule } from './pozos/pozos.module.js';
import { PersonasModule } from './personas/personas.module.js';
import { RecaudacionModule } from './recaudacion/recaudacion.module.js';
import { SeguridadModule } from './seguridad/seguridad.module.js';
import { SigModule } from './sig/sig.module.js';
import { AltaConcesionModule } from './tramites/alta-concesion/alta-concesion.module.js';
import { BajaPozoModule } from './tramites/baja-pozo/baja-pozo.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
      dataSourceFactory: crearDataSource,
    }),
    // Módulos base (datos)
    SeguridadModule,
    CatalogosModule,
    PersonasModule,
    ExpedientesModule,
    ConcesionesModule,
    SigModule,
    RecaudacionModule,
    NotificacionesModule,
    // Trámites (circuitos sobre los datos)
    AltaConcesionModule,
    // Importación del padrón anterior (se usa por línea de comandos)
    MigracionModule,
    // Pozos
    EmpresasModule,
    PozosModule,
    BajaPozoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
