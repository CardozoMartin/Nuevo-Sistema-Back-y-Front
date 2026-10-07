import { Controller, Get, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OficinaDrh } from './entities/oficina.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /** GET /api/usuarios: usuarios activos (mientras no haya login, sirve para elegir con quién probar). */
  @Get()
  async listar() {
    const lista = await this.usuarios.listar();
    return lista.map((u) => ({ id: u.id, legajo: u.legajo, apellido: u.apellido, nombre: u.nombre, oficina: u.oficina?.codigo ?? null, esAdministrador: u.esAdministrador }));
  }
}

/**
 * Seguridad (seg_): oficinas y usuarios. Es global porque todos los trámites registran
 * quién hizo cada cosa. El login, los permisos y la auditoría se suman acá.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OficinaDrh, Usuario])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class SeguridadModule {}
