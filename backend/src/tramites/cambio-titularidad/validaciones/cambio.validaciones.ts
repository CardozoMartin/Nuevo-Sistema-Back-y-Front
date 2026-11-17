// Reglas del Cambio de Titularidad. Funciones puras: reciben datos y lanzan un 400/409.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { claveDeDocumento } from '../../../comun/validadores/cuit.js';
import { EstadoConcesion } from '../../../concesiones/concesiones.constantes.js';

/** El cambio se tramita sobre una concesión otorgada y vigente (no en trámite, denegada ni anulada). */
export function exigirConcesionVigente(concesion: { estado: EstadoConcesion; numero: string | null }): void {
  if (concesion.estado !== EstadoConcesion.VIGENTE) {
    const nombre = concesion.numero ? `La concesión N° ${concesion.numero}` : 'La concesión';
    throw new ConflictException(`${nombre} no está vigente (${concesion.estado.replace('_', ' ').toLowerCase()}): no admite un cambio de titularidad.`);
  }
}

/** Sin otro trámite en curso sobre la concesión: se informa el expediente que la tiene ocupada. */
export function exigirSinTramiteEnCurso(numeroConcesion: string | null, enCurso: { expediente: string; tramite: string } | null): void {
  if (!enCurso) return;
  const nombre = numeroConcesion ? `La concesión N° ${numeroConcesion}` : 'La concesión';
  throw new ConflictException(`${nombre} tiene un trámite en curso (${enCurso.tramite}, expediente ${enCurso.expediente}). Espere a que finalice.`);
}

/**
 * Los nuevos titulares no pueden ser exactamente los actuales: tiene que entrar o salir al menos
 * uno (puede quedar un cotitular). Cuenta como la misma persona un DNI y el CUIL / CUIT que lo contiene.
 */
export function exigirTitularesDistintos(documentosActuales: (string | null)[], documentosNuevos: string[]): void {
  const actuales = new Set(documentosActuales.filter((d): d is string => !!d).map(claveDeDocumento));
  const nuevos = new Set(documentosNuevos.map(claveDeDocumento));
  const iguales = actuales.size === nuevos.size && [...nuevos].every((d) => actuales.has(d));
  if (iguales) throw new BadRequestException('Los titulares cargados son los mismos que los actuales: no hay cambio de titularidad.');
}

/** Para enviar el cambio: al menos un nuevo titular y su domicilio legal. */
export function exigirPropuestaCompleta(cantidadTitulares: number, cantidadDomicilios: number): void {
  const faltan = [cantidadTitulares ? null : 'el nuevo titular', cantidadDomicilios ? null : 'el domicilio legal'].filter(Boolean);
  if (faltan.length) throw new BadRequestException(`Falta cargar ${faltan.join(' y ')}.`);
}

/**
 * Recaudación verifica la deuda de los titulares actuales y de los nuevos (los que siguen
 * figuran una sola vez). Primero los actuales, en su orden; después los nuevos.
 */
export function unirPersonas<T extends { id: string }>(actuales: T[], nuevas: T[]): T[] {
  const vistas = new Set<string>();
  return [...actuales, ...nuevas].filter((p) => !vistas.has(p.id) && !!vistas.add(p.id));
}

/** Al finalizar, el cambio rige desde la fecha de la resolución que lo aprobó. */
export function exigirFechaDeResolucion(resolucion: { fecha: string } | null): string {
  if (!resolucion) throw new ConflictException('No se puede finalizar el cambio: falta la resolución de Secretaría General.');
  return resolucion.fecha;
}
