import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CON_CLAVE_TEMPORAL, PERMISOS, PUBLICO, SOLO_ADMIN, SOLO_OFICINAS, type PedidoAutenticado } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { Usuario } from './entities/usuario.entity.js';
import { enMinuscula, PERMISOS_INICIALES, type Permiso } from './permisos.constantes.js';
import { PermisosService } from './permisos.service.js';
import { UsuariosService } from './usuarios.service.js';

/**
 * Guardia global: toda ruta exige sesión salvo las marcadas @Publico(). Después controla
 * @SoloAdministrador() y @RequierePermiso(...), y que no tenga pendiente cambiar la contraseña.
 *
 * Solo para tests y scripts en desarrollo (AUTH_ENCABEZADO_PRUEBAS=true, nunca en producción):
 * sin token, se acepta el encabezado X-Usuario-Id como antes del login.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly encabezadoPruebas: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly usuarios: UsuariosService,
    private readonly permisos: PermisosService,
    config: ConfigService,
  ) {
    this.encabezadoPruebas = config.get('AUTH_ENCABEZADO_PRUEBAS') === 'true' && config.get('NODE_ENV') !== 'production';
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = <T>(clave: string) => this.reflector.getAllAndOverride<T>(clave, [ctx.getHandler(), ctx.getClass()]);
    if (meta<boolean>(PUBLICO)) return true;

    //1.- Quién es: el token de la sesión (o el encabezado de pruebas).
    const pedido = ctx.switchToHttp().getRequest<PedidoAutenticado>();
    const autorizacion = String(pedido.headers.authorization ?? '');
    const token = /^Bearer\s+(.+)$/i.exec(autorizacion)?.[1];
    let usuario: Usuario;
    if (token) {
      const valido = await this.auth.validar(token);
      usuario = valido.usuario;
      pedido.sesionId = valido.sesionId;
    } else if (this.encabezadoPruebas && pedido.headers['x-usuario-id']) {
      usuario = await this.usuarios.obtener(String(pedido.headers['x-usuario-id']).trim());
    } else {
      throw new UnauthorizedException('Ingrese con su usuario y contraseña.');
    }
    const sesion = await this.permisos.armarSesion(usuario);
    pedido.usuario = sesion;

    //2.- Con contraseña temporal solo puede ver su sesión, cambiarla o salir.
    if (sesion.debeCambiarClave && token && !meta<boolean>(CON_CLAVE_TEMPORAL)) {
      throw new ForbiddenException('Tiene que cambiar la contraseña temporal antes de seguir.');
    }

    //3.- Lo que exige la ruta.
    if (meta<boolean>(SOLO_ADMIN) && !sesion.esAdministrador) throw new ForbiddenException('Solo un administrador puede hacer esto.');
    const oficinas = meta<string[]>(SOLO_OFICINAS);
    if (oficinas && !sesion.esAdministrador && !oficinas.includes(sesion.oficina?.codigo ?? '')) {
      throw new ForbiddenException('Esto es de otra oficina: solo pueden verlo sus usuarios.');
    }
    const faltan = (meta<Permiso[]>(PERMISOS) ?? []).filter((p) => !sesion.permisos.includes(p));
    if (faltan.length) {
      const quien = sesion.oficina && sesion.rol ? ` (${sesion.rol.nombre} de ${sesion.oficina.nombre})` : '';
      throw new ForbiddenException(`No tiene permiso para: ${faltan.map((p) => enMinuscula(PERMISOS_INICIALES[p].nombre)).join(', ')}${quien}.`);
    }
    return true;
  }
}
