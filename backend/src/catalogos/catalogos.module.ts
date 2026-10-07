import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbmUbicacionesController } from './abm-ubicaciones.controller.js';
import { CuencasService } from './abm/cuencas.service.js';
import { DepartamentosService } from './abm/departamentos.service.js';
import { DistritosService } from './abm/distritos.service.js';
import { LocalidadesService } from './abm/localidades.service.js';
import { CatalogosController } from './catalogos.controller.js';
import { CatalogosService } from './catalogos.service.js';
import { Cuenca } from './entities/cuenca.entity.js';
import { Departamento } from './entities/departamento.entity.js';
import { Distrito } from './entities/distrito.entity.js';
import { DocumentoRequerido } from './entities/documento-requerido.entity.js';
import { Localidad } from './entities/localidad.entity.js';
import { SituacionLegal } from './entities/situacion-legal.entity.js';
import { TipoUso } from './entities/tipo-uso.entity.js';
import { UbicacionesService } from './ubicaciones.service.js';

/**
 * Tablas de referencia (cat_). Las usan los trámites para validar lo que se carga.
 * El catálogo de ubicación (departamentos, localidades, distritos, cuencas) tiene su ABM
 * con baja lógica (AbmUbicacionesController + abm/).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SituacionLegal, DocumentoRequerido, TipoUso, Departamento, Localidad, Distrito, Cuenca])],
  controllers: [CatalogosController, AbmUbicacionesController],
  providers: [CatalogosService, UbicacionesService, DepartamentosService, LocalidadesService, DistritosService, CuencasService],
  exports: [CatalogosService, UbicacionesService],
})
export class CatalogosModule {}
