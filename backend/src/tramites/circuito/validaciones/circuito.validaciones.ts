// Reglas del circuito por las oficinas. Funciones puras: reciben datos y lanzan un 400/409.
import { BadRequestException, ConflictException } from '@nestjs/common';

/** Distrito y Jurídico: «observado» y «no apto» llevan el motivo (qué corregir / por qué no). */
export function exigirMotivoSiNoEsApto(resultado: 'APTO' | 'OBSERVADO' | 'NO_APTO', observaciones?: string): void {
  if (resultado === 'APTO' || observaciones) return;
  throw new BadRequestException(resultado === 'OBSERVADO' ? 'Indique qué hay que corregir.' : 'Indique el motivo por el que no es apto.');
}

/** La fecha de la resolución tiene que ser del año de la resolución. */
export function exigirFechaDelAnio(fecha: string, anio: number): void {
  if (Number(fecha.slice(0, 4)) !== anio) throw new BadRequestException('La fecha de la resolución no coincide con el año.');
}

/**
 * Números de concesión que carga Catastro: tantos como se pidieron y sin repetir.
 * Devuelve los números sin ceros a la izquierda («0123» y «123» son el mismo).
 */
export function normalizarNumerosConcesion(numeros: string[], cantidadPedida: number): string[] {
  if (numeros.length !== cantidadPedida) {
    throw new BadRequestException(cantidadPedida === 1 ? 'Ingrese un solo número de concesión.' : `Se pidieron ${cantidadPedida} números de concesión y llegaron ${numeros.length}.`);
  }
  const normalizados = numeros.map((n) => String(Number(n)));
  const repetido = normalizados.find((n, i) => normalizados.indexOf(n) !== i);
  if (repetido) throw new ConflictException(`El número de concesión ${repetido} está repetido.`);
  return normalizados;
}

/**
 * Personas que hoy forman parte del trámite y Recaudación todavía no verificó (por ejemplo,
 * un titular agregado al corregir lo que observó Jurídico). `verificadas` es lo que guardó
 * la última verificación «sin deuda»; si no lo tiene (verificaciones anteriores a esta regla)
 * se toma como que no hubo cambios.
 */
export function personasSinVerificar(verificadas: unknown, actuales: string[]): string[] {
  if (!Array.isArray(verificadas)) return [];
  const ya = new Set(verificadas.map(String));
  return actuales.filter((id) => !ya.has(id));
}

/** Lo mínimo de una actuación para decidir a dónde sigue el expediente. */
export interface ActuacionResumen {
  id: string;
  datos: Record<string, unknown> | null;
}

/**
 * A dónde pasa el expediente cuando Recaudación da el «sin deuda»:
 *   - Normalmente, a la etapa siguiente (Distrito).
 *   - Si llegó a Recaudación porque, al corregir, cambiaron los titulares (corrección con
 *     `reverificaDeuda`), vuelve a la oficina que había observado (`vuelveA`): lo que ya
 *     aprobaron las demás sigue aprobado.
 * Vale la corrección POSTERIOR al último «sin deuda» (los ids de las actuaciones son crecientes).
 */
export function destinoTrasVerificarDeuda<E extends string>(correccion: ActuacionResumen | null, ultimoSinDeuda: ActuacionResumen | null, siguiente: E): E {
  if (!correccion?.datos?.reverificaDeuda || typeof correccion.datos.vuelveA !== 'string') return siguiente;
  if (ultimoSinDeuda && BigInt(ultimoSinDeuda.id) > BigInt(correccion.id)) return siguiente;
  return correccion.datos.vuelveA as E;
}

/**
 * Recaudación responde, por cada concesión otorgada de los titulares, si tiene deuda: tiene que
 * responder todas, una sola vez cada una, y ninguna ajena al expediente. Devuelve la respuesta
 * de cada concesión (id → tiene deuda).
 */
export function respuestasDeDeuda(concesiones: { id: string; numero: string | null }[], respuestas: { concesionId: string; tieneDeuda: boolean }[]): Map<string, boolean> {
  const ids = new Set(concesiones.map((c) => c.id));
  const porId = new Map<string, boolean>();
  for (const r of respuestas) {
    if (!ids.has(r.concesionId)) throw new BadRequestException(`La concesión ${r.concesionId} no es de los titulares de este expediente.`);
    if (porId.has(r.concesionId)) throw new BadRequestException(`La concesión ${r.concesionId} está respondida más de una vez.`);
    porId.set(r.concesionId, r.tieneDeuda);
  }
  const faltan = concesiones.filter((c) => !porId.has(c.id));
  if (faltan.length) throw new BadRequestException(`Indique si tienen deuda las concesiones ${faltan.map((c) => (c.numero ? `N° ${c.numero}` : `id ${c.id}`)).join(', ')}.`);
  return porId;
}
