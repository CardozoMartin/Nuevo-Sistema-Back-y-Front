import { Module } from '@nestjs/common';
import { ExpedientesModule } from '../../expedientes/expedientes.module.js';
import { NotificacionesModule } from '../../notificaciones/notificaciones.module.js';
import { RecaudacionModule } from '../../recaudacion/recaudacion.module.js';
import { EtapaCierreService } from './etapa-cierre.service.js';
import { EtapaDictamenService } from './etapa-dictamen.service.js';
import { EtapaEnvioService } from './etapa-envio.service.js';
import { EtapaRecaudacionService } from './etapa-recaudacion.service.js';
import { EtapaResolucionService } from './etapa-resolucion.service.js';
import { NumeroConcesionService } from './numero-concesion.service.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { SolicitudesNumeroController } from './solicitudes-numero.controller.js';

/**
 * Circuito por las oficinas, común a los trámites de concesiones: un service por oficina.
 * Cada trámite registra su ConfigTramite en RegistroTramitesService y llama a estos services
 * desde sus endpoints (ver tramites/alta-concesion/alta-circuito.config.ts).
 */
@Module({
  imports: [ExpedientesModule, RecaudacionModule, NotificacionesModule],
  controllers: [SolicitudesNumeroController],
  providers: [RegistroTramitesService, EtapaEnvioService, EtapaRecaudacionService, EtapaDictamenService, NumeroConcesionService, EtapaResolucionService, EtapaCierreService],
  exports: [RegistroTramitesService, EtapaEnvioService, EtapaRecaudacionService, EtapaDictamenService, NumeroConcesionService, EtapaResolucionService, EtapaCierreService],
})
export class CircuitoModule {}
