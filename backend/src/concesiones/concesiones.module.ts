import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concesion } from './entities/concesion.entity.js';
import { Condicion } from './entities/condicion.entity.js';
import { Domicilio } from './entities/domicilio.entity.js';
import { Inmueble } from './entities/inmueble.entity.js';
import { Poligono } from './entities/poligono.entity.js';
import { Punto } from './entities/punto.entity.js';
import { Suministro } from './entities/suministro.entity.js';
import { Titular } from './entities/titular.entity.js';
import { Uso } from './entities/uso.entity.js';
import { VistaInmueble } from './entities/vista-inmueble.entity.js';
import { PoligonosService } from './poligonos.service.js';

/**
 * Concesiones superficiales (con_). Registra las entidades y el servicio de polígonos
 * (PostGIS); los datos los escriben los trámites (alta, cambio de titularidad…).
 * Más adelante suma la consulta del padrón.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Concesion, Titular, Domicilio, Inmueble, Condicion, Uso, Punto, Suministro, Poligono, VistaInmueble])],
  providers: [PoligonosService],
  exports: [TypeOrmModule, PoligonosService],
})
export class ConcesionesModule {}
