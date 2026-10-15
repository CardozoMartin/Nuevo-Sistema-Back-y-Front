import { BadRequestException, Controller, Get, Module, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { soloDigitos } from '../comun/validadores/cuit.js';
import { Persona } from './entities/persona.entity.js';
import { PersonasService } from './personas.service.js';
import { ConDatosSensibles } from '../seguridad/auth.decorators.js';

@Controller('personas')
class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  /**
   * GET /api/personas?documento=20123456786
   * Si el titular ya está cargado, devuelve sus datos (para completar el formulario), sus
   * concesiones y sus deudas pendientes. 404 si no existe.
   */
  @Get()
  @ConDatosSensibles()
  buscar(@Query('documento') documento?: string) {
    const doc = soloDigitos(documento ?? '');
    if (!/^\d{7,11}$/.test(doc)) throw new BadRequestException('Indique el documento (DNI, CUIL o CUIT, solo números).');
    return this.personas.buscarPorDocumento(doc);
  }
}

/** Padrón de personas (per_): titulares de concesiones, únicos por documento. */
@Module({
  imports: [TypeOrmModule.forFeature([Persona])],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService, TypeOrmModule],
})
export class PersonasModule {}
