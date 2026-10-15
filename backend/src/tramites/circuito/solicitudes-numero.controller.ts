import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { AsignarNumerosDto, FiltroSolicitudesDto } from './dto/circuito.dto.js';
import { NumeroConcesionService } from './numero-concesion.service.js';
import { RequierePermiso, SoloOficina } from '../../seguridad/auth.decorators.js';
import { Permiso } from '../../seguridad/permisos.constantes.js';
import { Oficina } from '../../expedientes/expedientes.constantes.js';

/**
 * Pedidos de número de concesión (bandeja de Catastro). Los pide Secretaría General desde el
 * trámite (ej: POST /api/tramites/alta-concesion/:id/numero-concesion) y Catastro los carga acá.
 */
@Controller('solicitudes-numero')
export class SolicitudesNumeroController {
  constructor(private readonly numeros: NumeroConcesionService) {}

  /** GET /api/solicitudes-numero?estado=PENDIENTE&expedienteId=: los pedidos (pendientes primero). */
  @Get()
  @SoloOficina(Oficina.CATASTRO, Oficina.SECRETARIA_GENERAL)
  listar(@Query() filtro: FiltroSolicitudesDto) {
    return this.numeros.listar(filtro);
  }

  /** GET /api/solicitudes-numero/ultimo-numero: referencia para Catastro (el último número registrado). */
  @Get('ultimo-numero')
  @SoloOficina(Oficina.CATASTRO)
  ultimoNumero() {
    return this.numeros.ultimoRegistrado();
  }

  /** POST /api/solicitudes-numero/:id/asignar { "numeros": ["4521"] }: Catastro carga el número del libro. */
  @Post(':id/asignar')
  @RequierePermiso(Permiso.NUMERO_ASIGNAR)
  asignar(@Param('id', ParseIntPipe) id: number, @Body() dto: AsignarNumerosDto, @UsuarioActual() usuarioId: string) {
    return this.numeros.asignar(String(id), dto.numeros, usuarioId);
  }
}
