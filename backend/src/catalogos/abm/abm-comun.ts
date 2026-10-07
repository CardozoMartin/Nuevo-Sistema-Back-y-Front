// Piezas comunes del ABM del catálogo de ubicación: nombres, permisos, baja lógica y respuesta.
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Oficina } from '../../expedientes/expedientes.constantes.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import type { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { FilaCatalogo } from '../entities/fila-catalogo.js';

/**
 * Nombre tal como se guarda: sin espacios de más y en mayúsculas («  san   pablo » → «SAN PABLO»).
 * Es el mismo criterio con que se cargó el catálogo y con que el frontend muestra las opciones.
 */
export function normalizarNombre(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Quién puede modificar el catálogo: un usuario de Catastro o un administrador.
 * TODO(login): pasar a un permiso propio (ej: CATALOGO_UBICACION) cuando estén los roles.
 */
export async function exigirAdministradorDeCatalogo(usuarios: UsuariosService, usuarioId: string): Promise<Usuario> {
  const usuario = await usuarios.obtener(usuarioId);
  if (!usuario.esAdministrador && usuario.oficina?.codigo !== Oficina.CATASTRO) {
    throw new ForbiddenException('Solo Catastro (o un administrador) puede modificar el catálogo de ubicación.');
  }
  return usuario;
}

/** 404 si la fila no existe. */
export function exigirExistente<T>(fila: T | null, descripcion: string): T {
  if (!fila) throw new NotFoundException(`No existe ${descripcion}.`);
  return fila;
}

/** Una fila dada de baja no se modifica: primero hay que reactivarla. */
export function exigirActiva(fila: FilaCatalogo, descripcion: string): void {
  if (!fila.activo) throw new ConflictException(`${descripcion} está dado de baja: reactívelo antes de modificarlo.`);
}

/**
 * Antes de crear o renombrar: que no exista otra fila con la misma clave. Si existe dada de
 * baja, se sugiere reactivarla en lugar de crear una repetida.
 */
export function exigirClaveLibre(existente: (FilaCatalogo & { id: number }) | null, descripcion: string, excluirId?: number): void {
  if (!existente || existente.id === excluirId) return;
  throw new ConflictException(
    existente.activo ? `Ya existe ${descripcion}.` : `Ya existe ${descripcion}, dado de baja (id ${existente.id}): reactívelo en lugar de crearlo de nuevo.`,
  );
}

/** Baja lógica: activo = false con motivo, fecha y usuario. Nunca se borra la fila. */
export function aplicarBaja(fila: FilaCatalogo, motivo: string, usuario: Usuario): void {
  fila.activo = false;
  fila.bajaMotivo = motivo;
  fila.bajaEn = new Date();
  fila.bajaUsuarioId = usuario.id;
  fila.modificadoUsuarioId = usuario.id;
}

/**
 * Reactivación: vuelve a estar disponible. Los datos de la última baja se CONSERVAN (motivo,
 * fecha, usuario) para que no se pierda por qué estuvo de baja mientras no exista la auditoría.
 */
export function quitarBaja(fila: FilaCatalogo, usuario: Usuario): void {
  fila.activo = true;
  fila.modificadoUsuarioId = usuario.id;
}

/** Datos de autoría y baja para las respuestas del ABM. */
export function estadoDeFila(fila: FilaCatalogo) {
  const ultimaBaja = fila.bajaEn ? { motivo: fila.bajaMotivo, fecha: fila.bajaEn, usuarioId: fila.bajaUsuarioId } : null;
  return {
    activo: fila.activo,
    /** La baja vigente (null si está activa). */
    baja: fila.activo ? null : ultimaBaja,
    /** Si estuvo de baja y se reactivó: la última baja. */
    ultimaBaja: fila.activo ? ultimaBaja : null,
    creadoEn: fila.creadoEn,
    modificadoEn: fila.modificadoEn,
  };
}
