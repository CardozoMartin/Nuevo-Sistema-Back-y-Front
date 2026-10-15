import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { PedidoAutenticado } from './auth.decorators.js';

/**
 * Id del usuario que hace la petición: lo deja el AuthGuard a partir del token de la sesión
 * (o del encabezado X-Usuario-Id, solo en pruebas con AUTH_ENCABEZADO_PRUEBAS=true).
 */
export const UsuarioActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext): string => {
  const usuario = ctx.switchToHttp().getRequest<PedidoAutenticado>().usuario;
  if (!usuario) throw new UnauthorizedException('Ingrese con su usuario y contraseña.');
  return usuario.id;
});
