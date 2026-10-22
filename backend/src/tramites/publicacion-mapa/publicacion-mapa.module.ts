import { Module } from '@nestjs/common';
import { ConcesionesModule } from '../../concesiones/concesiones.module.js';
import { ExpedientesModule } from '../../expedientes/expedientes.module.js';
import { SigModule } from '../../sig/sig.module.js';
import { PublicacionMapaController } from './publicacion-mapa.controller.js';
import { PublicacionMapaService } from './publicacion-mapa.service.js';

/** Publicación de los polígonos en el mapa público (Argenmap), después de la resolución. */
@Module({
  imports: [ExpedientesModule, ConcesionesModule, SigModule],
  controllers: [PublicacionMapaController],
  providers: [PublicacionMapaService],
})
export class PublicacionMapaModule {}
