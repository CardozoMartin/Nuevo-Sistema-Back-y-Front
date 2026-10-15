import { Body, Controller, Get, Global, HttpCode, Module, Param, Post, Put, Query, Req } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbmUsuariosService } from './abm-usuarios.service.js';
import { AunqueDebaCambiarClave, Publico, SoloAdministrador, type PedidoAutenticado } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { DatosSensiblesInterceptor } from './datos-sensibles.js';
import { BajaUsuarioDto, CambiarClaveDto, ListarUsuariosQuery, LoginDto, PermisosRolDto, UsuarioDto } from './dto/seguridad.dto.js';
import { OficinaDrh } from './entities/oficina.entity.js';
import { PermisoDrh, RolPermiso, UsuarioPermiso } from './entities/permiso.entity.js';
import { RolDrh } from './entities/rol.entity.js';
import { Sesion } from './entities/sesion.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PermisosService } from './permisos.service.js';
import { UsuarioActual } from './usuario-actual.decorator.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login { usuario (legajo o email), clave } → { token, usuario (con permisos) }. */
  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() pedido: PedidoAutenticado) {
    return this.auth.login(dto.usuario, dto.clave, pedido.ip, String(pedido.headers['user-agent'] ?? ''));
  }

  /** GET /api/auth/sesion: quién está conectado, su oficina, rol y permisos. */
  @AunqueDebaCambiarClave()
  @Get('sesion')
  sesion(@Req() pedido: PedidoAutenticado) {
    return pedido.usuario;
  }

  @AunqueDebaCambiarClave()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() pedido: PedidoAutenticado) {
    if (pedido.sesionId) await this.auth.logout(pedido.sesionId);
  }

  /** POST /api/auth/cambiar-clave { actual, nueva }: cierra las demás sesiones del usuario. */
  @AunqueDebaCambiarClave()
  @Post('cambiar-clave')
  @HttpCode(200)
  cambiarClave(@Body() dto: CambiarClaveDto, @Req() pedido: PedidoAutenticado, @UsuarioActual() usuarioId: string) {
    return this.auth.cambiarClave(usuarioId, pedido.sesionId, dto.actual, dto.nueva);
  }
}

/** ABM de usuarios: solo administradores. */
@SoloAdministrador()
@Controller('usuarios')
class UsuariosController {
  constructor(private readonly abm: AbmUsuariosService) {}

  @Get()
  listar(@Query() q: ListarUsuariosQuery) {
    return this.abm.listar(q);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.abm.obtener(id);
  }

  /** Devuelve la contraseña temporal UNA vez (el usuario la cambia al entrar). */
  @Post()
  crear(@Body() dto: UsuarioDto, @UsuarioActual() adminId: string) {
    return this.abm.crear(dto, adminId);
  }

  @Put(':id')
  actualizar(@Param('id') id: string, @Body() dto: UsuarioDto, @UsuarioActual() adminId: string) {
    return this.abm.actualizar(id, dto, adminId);
  }

  @Post(':id/baja')
  @HttpCode(200)
  baja(@Param('id') id: string, @Body() dto: BajaUsuarioDto, @UsuarioActual() adminId: string) {
    return this.abm.baja(id, dto, adminId);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  reactivar(@Param('id') id: string, @UsuarioActual() adminId: string) {
    return this.abm.reactivar(id, adminId);
  }

  @Post(':id/restablecer-clave')
  @HttpCode(200)
  restablecerClave(@Param('id') id: string, @UsuarioActual() adminId: string) {
    return this.abm.restablecerClave(id, adminId);
  }
}

/** Roles y permisos por oficina: solo administradores. */
@SoloAdministrador()
@Controller('roles')
class RolesController {
  constructor(private readonly permisos: PermisosService) {}

  /** GET /api/roles/permisos: oficinas, roles, permisos (con su oficina) y la plantilla de cada rol en cada oficina. */
  @Get('permisos')
  matriz() {
    return this.permisos.obtenerMatriz();
  }

  /** PUT /api/roles/permisos { oficina, rol, permisos[] }: reemplaza la plantilla (no cambia a los usuarios existentes). */
  @Put('permisos')
  actualizar(@Body() dto: PermisosRolDto) {
    return this.permisos.actualizar(dto.oficina, dto.rol, dto.permisos);
  }
}

/**
 * Seguridad (seg_): oficinas, usuarios, roles, permisos y sesiones. Es global porque todos los
 * trámites registran quién hizo cada cosa. El guardia (AuthGuard) protege todas las rutas.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OficinaDrh, Usuario, RolDrh, PermisoDrh, RolPermiso, UsuarioPermiso, Sesion])],
  controllers: [AuthController, UsuariosController, RolesController],
  providers: [UsuariosService, PermisosService, AuthService, AbmUsuariosService, { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_INTERCEPTOR, useClass: DatosSensiblesInterceptor }],
  exports: [UsuariosService, PermisosService],
})
export class SeguridadModule {}
