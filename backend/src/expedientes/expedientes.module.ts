import { BadRequestException, Controller, ForbiddenException, Get, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { Actuacion } from './entities/actuacion.entity.js';
import { Auditoria } from './entities/auditoria.entity.js';
import { DocumentacionPresentada } from './entities/documentacion-presentada.entity.js';
import { Expediente } from './entities/expediente.entity.js';
import { Movimiento } from './entities/movimiento.entity.js';
import { Resolucion } from './entities/resolucion.entity.js';
import { SolicitudNumero } from './entities/solicitud-numero.entity.js';
import { BuscarExpedientesQuery } from './dto/buscar-expedientes.query.js';
import { NumeroExpedienteQuery } from './dto/numero-expediente.query.js';
import { Oficina } from './expedientes.constantes.js';
import { ExpedientesService } from './expedientes.service.js';
import { ConDatosSensibles, RequierePermiso, SesionActual, type UsuarioSesion } from '../seguridad/auth.decorators.js';
import { Permiso } from '../seguridad/permisos.constantes.js';

/** Acciones comunes a cualquier expediente, sea del trámite que sea. */
@Controller('expedientes')
class ExpedientesController {
  constructor(private readonly expedientes: ExpedientesService) {}

  /** GET /api/expedientes/bandeja/recaudacion: expedientes que están en esa oficina. */
  @Get('bandeja/:oficina')
  bandeja(@Param('oficina') oficina: string, @SesionActual() sesion: UsuarioSesion) {
    if (!Object.values(Oficina).includes(oficina as Oficina)) throw new BadRequestException(`Oficina desconocida: ${oficina}.`);
    // Cada oficina ve solo su bandeja (el administrador, todas).
    if (!sesion.esAdministrador && sesion.oficina?.codigo !== oficina) throw new ForbiddenException('Solo puede ver la bandeja de su oficina.');
    return this.expedientes.bandeja(oficina as Oficina);
  }

  /**
   * GET /api/expedientes/buscar?texto=&tipoTramite=&estado=&oficina=&desde=&hasta=&pagina=:
   * buscador general (cualquier trámite, en curso o terminado). Va antes de :id.
   */
  @Get('buscar')
  @ConDatosSensibles()
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
  @ConDatosSensibles()
  resumen(@Param('id', ParseIntPipe) id: number) {
    return this.expedientes.resumen(String(id));
  }

  /** GET /api/expedientes/:id/auditoria: quién lo inició, quién lo tuvo en cada oficina y quién lo finalizó. */
  @Get(':id/auditoria')
  auditoria(@Param('id', ParseIntPipe) id: number) {
    return this.expedientes.auditoria(String(id));
  }

  /**
   * GET /api/expedientes/:id/historial: pases, actuaciones y cambios de estado, en orden. Lo que
   * hizo cada oficina solo lo ve esa oficina (y los administradores): ver ExpedientesService.historial.
   */
  @Get(':id/historial')
  historial(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: UsuarioSesion) {
    return this.expedientes.historial(String(id), sesion);
  }

  /** POST /api/expedientes/:id/tomar: la oficina donde está el expediente lo recibe. */
  @Post(':id/tomar')
  @RequierePermiso(Permiso.EXPEDIENTE_TOMAR)
  tomar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string) {
    return this.expedientes.tomar(String(id), usuarioId);
  }
}

/**
 * Expedientes (exp_): carátula, pases entre oficinas, actuaciones, resoluciones y
 * documentación presentada. La mecánica del circuito es común a todos los trámites.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Expediente, Movimiento, Actuacion, Auditoria, Resolucion, DocumentacionPresentada, SolicitudNumero])],
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
  exports: [ExpedientesService, TypeOrmModule],
})
export class ExpedientesModule {}
