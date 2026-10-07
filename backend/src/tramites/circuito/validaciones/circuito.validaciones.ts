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
