import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbmCaucesController } from './abm-cauces.controller.js';
import { ArchivosService } from './archivos.service.js';
import { CapasService } from './capas.service.js';
import { CaucesService } from './cauces.service.js';
import { Cauce } from './entities/cauce.entity.js';
import { VistaConcesion, VistaConcesionPublica } from './entities/vista-concesion.entity.js';
import { VistaPozo } from './entities/vista-pozo.entity.js';
import { VistaPunto, VistaPuntoPublica } from './entities/vista-punto.entity.js';
import { GeometriaService } from './geometria.service.js';
import { SigController } from './sig.controller.js';

/**
 * Información geográfica (PostGIS):
 *   - GeometriaService: valida y mide polígonos (KML) y detecta superposiciones.
 *   - CapasService: publica las capas para la web en GeoJSON.
 *   - ArchivosService: guarda los archivos originales (KML) fuera de la base.
 *   - Vistas internas con_v_mapa_concesion y con_v_mapa_punto (todo, para el visor del sistema) y
 *     las públicas sig.v_concesiones, sig.v_puntos (solo lo publicado en el mapa) y sig.v_pozos, y la
 *     tabla sig.cauce (ríos y canales): las capas que leen QGIS, GeoServer y la web. Los cauces tienen su ABM por la API (AbmCaucesController).
 */
@Module({
  imports: [TypeOrmModule.forFeature([VistaConcesion, VistaConcesionPublica, VistaPozo, VistaPunto, VistaPuntoPublica, Cauce])],
  controllers: [SigController, AbmCaucesController],
  providers: [GeometriaService, CapasService, CaucesService, ArchivosService],
  exports: [GeometriaService, ArchivosService, CaucesService],
})
export class SigModule {}
