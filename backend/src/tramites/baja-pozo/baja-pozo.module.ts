import { Module } from '@nestjs/common';
import { ExpedientesModule } from '../../expedientes/expedientes.module.js';
import { PozosModule } from '../../pozos/pozos.module.js';
import { RecaudacionModule } from '../../recaudacion/recaudacion.module.js';
import { BajaPozoController } from './baja-pozo.controller.js';
import { BajaPozoService } from './baja-pozo.service.js';

/**
 * Baja de Pozo: de oficio (directa) o a solicitud (Pozos → Jurídico → Secretaría General →
 * clausura física si corresponde). Distrito toma conocimiento de las bajas aprobadas.
 */
@Module({
  imports: [ExpedientesModule, PozosModule, RecaudacionModule],
  controllers: [BajaPozoController],
  providers: [BajaPozoService],
})
export class BajaPozoModule {}
