import { BadRequestException, Controller, Get, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { Actuacion } from './entities/actuacion.entity.js';
import { DocumentacionPresentada } from './entities/documentacion-presentada.entity.js';
import { Expediente } from './entities/expediente.entity.js';
import { Movimiento } from './entities/movimiento.entity.js';
import { Resolucion } from './entities/resolucion.entity.js';
import { SolicitudNumero } from './entities/solicitud-numero.entity.js';
import { BuscarExpedientesQuery } from './dto/buscar-expedientes.query.js';
import { NumeroExpedienteQuery } from './dto/numero-expediente.query.js';
import { Oficina } from './expedientes.constantes.js';
import { ExpedientesService } from './expedientes.service.js';

/** Acciones comunes a cualquier expediente, sea del trámite que sea. */
@Controller('expedientes')
class ExpedientesController {
  constructor(private readonly expedientes: ExpedientesService) {}

  /** GET /api/expedientes/bandeja/recaudacion: expedientes que están en esa oficina. */
  @Get('bandeja/:oficina')
  bandeja(@Param('oficina') oficina: string) {
    if (!Object.values(Oficina).includes(oficina as Oficina)) throw new BadRequestException(`Oficina desconocida: ${oficina}.`);
    return this.expedientes.bandeja(oficina as Oficina);
  }

  /**
   * GET /api/expedientes/buscar?texto=&tipoTramite=&estado=&oficina=&desde=&hasta=&pagina=:
   * buscador general (cualquier trámite, en curso o terminado). Va antes de :id.
   */
  @Get('buscar')
  buscar(@Query() query: BuscarExpedientesQuery) {
    return this.expedientes.buscar(query);
  }

  /**
   * GET /api/expedientes/disponibilidad?numero=123&reparticion=332&anio=2026: si el número
   * está libre o, si ya está registrado, de qué trámite es y dónde está. Va antes de :id.
   */
  @Get('disponibilidad')
  disponibilidad(@Query() query: NumeroExpedienteQuery) {
    return this.expedientes.disponibilidad(query);
  }

  /** GET /api/expedientes/:id: dónde está y quién lo tiene. */
  @Get(':id')
  resumen(@Param('id', ParseIntPipe) id: number) {
    return this.expedientes.resumen(String(id));
  }

  /** GET /api/expedientes/:id/historial: pases y actuaciones, en orden. */
  @Get(':id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.expedientes.historial(String(id));
  }

  /** POST /api/expedientes/:id/tomar: la oficina donde está el expediente lo recibe. */
  @Post(':id/tomar')
  tomar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.expedientes.tomar(String(id), usuarioId);
  }
}

/**
 * Expedientes (exp_): carátula, pases entre oficinas, actuaciones, resoluciones y
 * documentación presentada. La mecánica del circuito es común a todos los trámites.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Expediente, Movimiento, Actuacion, Resolucion, DocumentacionPresentada, SolicitudNumero])],
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
  exports: [ExpedientesService, TypeOrmModule],
})
export class ExpedientesModule {}
