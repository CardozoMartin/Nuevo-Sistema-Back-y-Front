import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { USUARIO_SISTEMA } from '../comun/usuario-sistema.js';

/**
 * Id del usuario que hace la petición.
 *
 * TODO(login): hoy sale del encabezado «X-Usuario-Id» (para probar el circuito con los
 * usuarios de prueba de cada oficina); si no viene, es el usuario Sistema. Con el login va
 * a salir del token de la sesión, y los controllers no cambian.
 */
export const UsuarioActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext): string => {
  const pedido = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
  return pedido.headers['x-usuario-id']?.trim() || USUARIO_SISTEMA;
});
