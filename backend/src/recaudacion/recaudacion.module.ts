import { Body, Controller, Get, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Texto } from '../comun/validadores/texto.js';
import { ExpedientesModule } from '../expedientes/expedientes.module.js';
import { nombrePersona } from '../personas/entities/persona.entity.js';
import { UsuarioActual } from '../seguridad/usuario-actual.decorator.js';
import { Deuda } from './entities/deuda.entity.js';
import { RecaudacionService } from './recaudacion.service.js';

class CancelarDeudaDto {
  /** Número de recibo, transferencia, etc. */
  @IsOptional() @Texto() @IsString() @MaxLength(120)
  comprobante?: string;
}

@Controller('deudas')
class DeudasController {
  constructor(private readonly recaudacion: RecaudacionService) {}

  /** GET /api/deudas?personaId=5 — deudas de una persona; sin persona, todas las pendientes. */
  @Get()
  async listar(@Query('personaId') personaId?: string) {
    const deudas = await this.recaudacion.listar(personaId);
    return deudas.map((d) => ({
      id: d.id,
      persona: { id: d.persona.id, nombre: nombrePersona(d.persona), documento: d.persona.documento },
      detalle: d.detalle,
      monto: d.monto === null ? null : Number(d.monto),
      estado: d.estado,
      creadoEn: d.creadoEn,
      canceladoEn: d.canceladoEn,
      comprobantePago: d.comprobantePago,
    }));
  }

  /** POST /api/deudas/:id/cancelar — Recaudación registra el pago (reanuda los expedientes en espera). */
  @Post(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelarDeudaDto, @UsuarioActual() usuarioId: string) {
    return this.recaudacion.cancelar(String(id), usuarioId, dto.comprobante);
  }
}

/** Recaudación (rec_): deudas de los titulares. */
@Module({
  imports: [TypeOrmModule.forFeature([Deuda]), ExpedientesModule],
  controllers: [DeudasController],
  providers: [RecaudacionService],
  exports: [RecaudacionService],
})
export class RecaudacionModule {}
