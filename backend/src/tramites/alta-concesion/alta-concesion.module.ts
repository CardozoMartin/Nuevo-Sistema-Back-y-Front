import { Module } from '@nestjs/common';
import { CatalogosModule } from '../../catalogos/catalogos.module.js';
import { ConcesionesModule } from '../../concesiones/concesiones.module.js';
import { ExpedientesModule } from '../../expedientes/expedientes.module.js';
import { PersonasModule } from '../../personas/personas.module.js';
import { RecaudacionModule } from '../../recaudacion/recaudacion.module.js';
import { SigModule } from '../../sig/sig.module.js';
import { CircuitoModule } from '../circuito/circuito.module.js';
import { AltaCircuitoConfig } from './alta-circuito.config.js';
import { AltaCircuitoService } from './alta-circuito.service.js';
import { AltaConcesionController } from './alta-concesion.controller.js';
import { AltaConcesionService } from './alta-concesion.service.js';
import { InicioAltaService } from './pasos/paso1-inicio.service.js';
import { TitularesAltaService } from './pasos/paso2-titulares.service.js';
import { UbicacionAltaService } from './pasos/paso3-ubicacion.service.js';
import { InmuebleAltaService } from './pasos/paso4-inmueble.service.js';
import { UsosAltaService } from './pasos/paso5-usos.service.js';
import { SuministroAltaService } from './pasos/paso6-suministro.service.js';

/**
 * Trámite de Alta de Concesión:
 *   - la carga en Catastro, un service por paso (pasos/) más lo común (AltaConcesionService);
 *   - el circuito por las oficinas: los services comunes de tramites/circuito/ con la
 *     configuración del alta (AltaCircuitoConfig), llamados desde AltaCircuitoService.
 * Orquesta expedientes, personas, concesiones, recaudación, catálogos y SIG.
 */
@Module({
  imports: [CatalogosModule, ExpedientesModule, PersonasModule, ConcesionesModule, RecaudacionModule, SigModule, CircuitoModule],
  controllers: [AltaConcesionController],
  providers: [
    AltaConcesionService,
    InicioAltaService,
    TitularesAltaService,
    UbicacionAltaService,
    InmuebleAltaService,
    UsosAltaService,
    SuministroAltaService,
    AltaCircuitoConfig,
    AltaCircuitoService,
  ],
})
export class AltaConcesionModule {}
