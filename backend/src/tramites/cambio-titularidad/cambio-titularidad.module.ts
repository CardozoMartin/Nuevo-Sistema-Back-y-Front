import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModule } from '../../catalogos/catalogos.module.js';
import { ConcesionesModule } from '../../concesiones/concesiones.module.js';
import { ExpedientesModule } from '../../expedientes/expedientes.module.js';
import { PersonasModule } from '../../personas/personas.module.js';
import { CircuitoModule } from '../circuito/circuito.module.js';
import { CambioCircuitoConfig } from './cambio-circuito.config.js';
import { CambioCircuitoService } from './cambio-circuito.service.js';
import { CambioTitularidadController } from './cambio-titularidad.controller.js';
import { CambioTitularidadService } from './cambio-titularidad.service.js';
import { CambioTitularidad } from './entities/cambio-titularidad.entity.js';
import { DomicilioPropuesto } from './entities/domicilio-propuesto.entity.js';
import { TitularPropuesto } from './entities/titular-propuesto.entity.js';

/**
 * Trámite de Cambio de Titularidad de una concesión vigente:
 *   - el inicio y la carga del nuevo titular en Catastro (CambioTitularidadService);
 *   - el circuito por las oficinas: los services comunes de tramites/circuito/ con la
 *     configuración del cambio (CambioCircuitoConfig), llamados desde CambioCircuitoService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CambioTitularidad, TitularPropuesto, DomicilioPropuesto]), CatalogosModule, ExpedientesModule, PersonasModule, ConcesionesModule, CircuitoModule],
  controllers: [CambioTitularidadController],
  providers: [CambioTitularidadService, CambioCircuitoConfig, CambioCircuitoService],
})
export class CambioTitularidadModule {}
