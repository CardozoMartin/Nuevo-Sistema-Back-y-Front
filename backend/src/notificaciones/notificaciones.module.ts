import { Controller, Get, Module, Param, ParseIntPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity.js';
import { NotificacionesService } from './notificaciones.service.js';

@Controller('expedientes')
class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  /** GET /api/expedientes/:id/emails: correos que se mandaron por el expediente. */
  @Get(':id/emails')
  emails(@Param('id', ParseIntPipe) id: number) {
    return this.notificaciones.deExpediente(String(id));
  }
}

/** Notificaciones (not_): correos del sistema, con registro de cada envío. Módulo base reutilizable. */
@Module({
  imports: [TypeOrmModule.forFeature([Email])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
