import { createParamDecorator, ForbiddenException, SetMetadata, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { enMinuscula, PERMISOS_INICIALES, type Permiso } from './permisos.constantes.js';

/** Ruta sin sesión (el login, health). Todas las demás exigen haber entrado. */
export const PUBLICO = 'drh:publico';
export const Publico = () => SetMetadata(PUBLICO, true);

/** La acción exige estos permisos (todos), según la oficina y el rol del usuario. */
export const PERMISOS = 'drh:permisos';
export const RequierePermiso = (...permisos: Permiso[]) => SetMetadata(PERMISOS, permisos);

/**
 * Solo usuarios de estas oficinas (y administradores): bandejas y consultas propias de una
 * oficina. Lo general (buscar y ver un expediente) queda para todos.
 */
export const SOLO_OFICINAS = 'drh:solo-oficinas';
export const SoloOficina = (...oficinas: string[]) => SetMetadata(SOLO_OFICINAS, oficinas);

/** La respuesta puede tener datos sensibles: se ocultan a quien no tenga DATOS_SENSIBLES_VER (ver datos-sensibles.ts). */
export const DATOS_SENSIBLES = 'drh:datos-sensibles';
export const ConDatosSensibles = () => SetMetadata(DATOS_SENSIBLES, true);

/** Solo administradores (ABM de usuarios, roles y permisos). */
export const SOLO_ADMIN = 'drh:solo-admin';
export const SoloAdministrador = () => SetMetadata(SOLO_ADMIN, true);

/** Se puede usar aunque la contraseña sea temporal (ver la sesión, cambiarla, salir). */
export const CON_CLAVE_TEMPORAL = 'drh:clave-temporal';
export const AunqueDebaCambiarClave = () => SetMetadata(CON_CLAVE_TEMPORAL, true);

/** Lo que el guardia deja en el pedido: quién es y qué puede hacer. */
export interface UsuarioSesion {
  id: string;
  legajo: string;
  apellido: string;
  nombre: string;
  email: string;
  oficina: { codigo: string; nombre: string } | null;
  rol: { codigo: string; nombre: string } | null;
  esAdministrador: boolean;
  debeCambiarClave: boolean;
  permisos: string[];
}

export interface PedidoAutenticado {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  usuario?: UsuarioSesion;
  sesionId?: string;
}

/** La sesión del pedido (quién es y sus permisos), para controles que dependen de los datos. */
export const SesionActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext): UsuarioSesion => {
  const usuario = ctx.switchToHttp().getRequest<PedidoAutenticado>().usuario;
  if (!usuario) throw new UnauthorizedException('Ingrese con su usuario y contraseña.');
  return usuario;
});

/** Para permisos que dependen de lo que se manda (ej: el KML solo si viene un archivo). */
export function exigirPermiso(sesion: UsuarioSesion, permiso: Permiso) {
  if (!sesion.permisos.includes(permiso)) throw new ForbiddenException(`No tiene permiso para: ${enMinuscula(PERMISOS_INICIALES[permiso].nombre)}.`);
}
