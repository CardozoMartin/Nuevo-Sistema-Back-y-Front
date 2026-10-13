import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbmCaucesController } from './abm-cauces.controller.js';
import { ArchivosService } from './archivos.service.js';
import { CapasService } from './capas.service.js';
import { CaucesService } from './cauces.service.js';
import { Cauce } from './entities/cauce.entity.js';
import { VistaConcesion } from './entities/vista-concesion.entity.js';
import { VistaPozo } from './entities/vista-pozo.entity.js';
import { VistaPunto } from './entities/vista-punto.entity.js';
import { GeometriaService } from './geometria.service.js';
import { SigController } from './sig.controller.js';

/**
 * Información geográfica (PostGIS):
 *   - GeometriaService: valida y mide polígonos (KML) y detecta superposiciones.
 *   - CapasService: publica las capas para la web en GeoJSON.
 *   - ArchivosService: guarda los archivos originales (KML) fuera de la base.
 *   - Vistas sig.v_concesiones y sig.v_pozos, y la tabla sig.cauce (ríos y canales): las capas
 *     que leen QGIS y la web. Los cauces tienen su ABM por la API (AbmCaucesController).
 */
@Module({
  imports: [TypeOrmModule.forFeature([VistaConcesion, VistaPozo, VistaPunto, Cauce])],
  controllers: [SigController, AbmCaucesController],
  providers: [GeometriaService, CapasService, CaucesService, ArchivosService],
  exports: [GeometriaService, ArchivosService, CaucesService],
})
export class SigModule {}
