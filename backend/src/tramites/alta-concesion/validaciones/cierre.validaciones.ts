// Reglas del cierre en Catastro (después de la resolución firmada). Funciones puras.
//
// Decisión (07/10/2026): en el cierre Catastro SOLO COMPLETA lo que falta. Lo que ya tiene valor
// fue lo que evaluaron Distrito y Jurídico y lo que aprobó la resolución: no se cambia.
//   - Titulares, domicilios, ubicación, polígono, usos y caudal: bloqueados.
//   - Datos catastrales, registrales y de suministro: se pueden llenar los campos vacíos.
import { ConflictException } from '@nestjs/common';

/** Un campo de una sección: cómo está guardado y cómo viene en el formulario. */
export interface CampoCierre {
  nombre: string;
  actual: unknown;
  nuevo: unknown;
}

const vacio = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

/** Mismo valor, sin importar mayúsculas, espacios, tipo (12.5 = «12.500») ni orden de llegada. */
function iguales(a: unknown, b: unknown): boolean {
  if (vacio(a) && vacio(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : [a];
    const y = Array.isArray(b) ? b : [b];
    return x.length === y.length && x.every((v, i) => iguales(v, y[i]));
  }
  const numero = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) ? Number(v) : NaN);
  if (!Number.isNaN(numero(a)) && !Number.isNaN(numero(b))) return numero(a) === numero(b);
  return String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
}

/**
 * Solo se pueden completar los campos vacíos: si un campo ya tiene valor y viene otro, 409
 * con la lista de los que se intentó cambiar.
 */
export function exigirSoloCompletar(seccion: string, campos: CampoCierre[]): void {
  const cambiados = campos.filter((c) => !vacio(c.actual) && !iguales(c.actual, c.nuevo)).map((c) => c.nombre);
  if (cambiados.length) {
    throw new ConflictException(
      `En el cierre solo se completan los datos que faltan: ${seccion} ya tiene datos aprobados en la resolución que no se pueden cambiar (${cambiados.join(', ')}).`,
    );
  }
}

/** Una sección entera quedó fija con la resolución: no puede cambiar nada. */
export function exigirSinCambios(seccion: string, campos: CampoCierre[]): void {
  const cambiados = campos.filter((c) => !iguales(c.actual, c.nuevo)).map((c) => c.nombre);
  if (cambiados.length) {
    throw new ConflictException(`En el cierre no se puede modificar ${seccion}: quedó aprobado en la resolución (cambió: ${cambiados.join(', ')}).`);
  }
}
