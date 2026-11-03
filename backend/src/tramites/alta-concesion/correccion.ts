// Corrección de errores materiales de un alta (por fuera del circuito): qué secciones se pueden
// corregir y cómo se calcula el antes / después de cada campo para el historial.
import { BadRequestException } from '@nestjs/common';
import type { CambioCorregido } from '../../expedientes/expedientes.service.js';
import type { armarRespuestaAlta } from './alta-concesion.respuesta.js';

type Alta = ReturnType<typeof armarRespuestaAlta>;

/**
 * Secciones que se corrigen. Los usos, magnitudes y el caudal NO: son lo que otorga la
 * resolución, y cambiarlos es otro trámite (ampliación o reducción).
 */
export type SeccionCorregible = 'titulares' | 'ubicacion' | 'inmueble' | 'suministro';

export const NOMBRE_SECCION: Record<SeccionCorregible, string> = {
  titulares: 'Titulares y domicilios',
  ubicacion: 'Ubicación y polígono',
  inmueble: 'Inmueble',
  suministro: 'Suministro',
};

/** Un campo de la sección: su valor como texto y si es un dato sensible (documento, contacto, domicilio). */
type Campo = { valor: string | null; sensible?: boolean };
export type Instantanea = Map<string, Campo>;

const texto = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : Array.isArray(v) ? v.join(', ') || null : String(v));

/** Los campos de una sección tal como están en el alta, con un nombre legible para el historial. */
export function instantanea(alta: Alta, seccion: SeccionCorregible): Instantanea {
  const campos: Instantanea = new Map();
  const poner = (campo: string, valor: unknown, sensible = false) => campos.set(campo, { valor: texto(valor), sensible });

  if (seccion === 'titulares') {
    alta.titulares.forEach((t, i) => {
      const n = `Titular ${i + 1}`;
      poner(`${n} · Tipo de documento`, t.tipoDocumento);
      poner(`${n} · Documento`, t.documento, true);
      poner(`${n} · Apellido`, t.apellido);
      poner(`${n} · Nombre`, t.nombre);
      poner(`${n} · Fecha de nacimiento`, t.fechaNacimiento);
      poner(`${n} · Razón social`, t.razonSocial);
      poner(`${n} · Fecha de constitución`, t.fechaConstitucion);
      poner(`${n} · Correo electrónico`, t.email, true);
      poner(`${n} · Teléfono`, t.telefono, true);
    });
    alta.domicilios.forEach((d, i) => {
      const n = `Domicilio ${i + 1}`;
      poner(`${n} · Calle`, d.calle, true);
      poner(`${n} · Número`, d.numero, true);
      poner(`${n} · Departamento`, d.departamento);
      poner(`${n} · Localidad`, d.localidad);
      poner(`${n} · Distrito`, d.distrito);
    });
  }

  if (seccion === 'ubicacion') {
    poner('Departamento', alta.ubicacion?.departamento);
    poner('Localidad', alta.ubicacion?.localidad);
    poner('Distrito', alta.ubicacion?.distrito);
  }

  if (seccion === 'inmueble') {
    const c = alta.inmueble ? alta.inmueble.catastral : null;
    const r = alta.inmueble ? alta.inmueble.registral : null;
    poner('Matrícula catastral', c?.matricula);
    poner('Circunscripción', c?.circunscripcion);
    poner('Sección', c?.seccion);
    poner('Parcela', c?.parcela);
    poner('Lámina', c?.lamina);
    poner('Orden', c?.orden);
    poner('Libro', r?.libro);
    poner('Folio', r?.folio);
    poner('Año de dominio', r?.anio);
    poner('Matrícula de dominio', r?.matricula);
    poner('Serie', r?.serie);
  }

  if (seccion === 'suministro') {
    const s = alta.suministro;
    poner('Fuentes', s?.fuentes);
    poner('Sistema de distribución', s?.sistemaDistribucion);
    poner('Canal principal', s?.canalPrincipal);
    poner('Canal secundario', s?.canalSecundario);
    poner('Canal terciario', s?.canalTerciario);
    poner('Canal cuarto', s?.canalCuarto);
    poner('Canal quinto', s?.canalQuinto);
    poner('Desagüe', s?.desague);
    poner('Observación', s?.observacion);
  }
  return campos;
}

/**
 * Los campos que cambiaron entre dos instantáneas (en el orden de la sección). Los sensibles van
 * marcados: el historial los oculta a quien no tiene permiso para ver datos sensibles.
 */
export function diferencias(antes: Instantanea, despues: Instantanea): (CambioCorregido & { sensible?: true })[] {
  const nombres = [...new Set([...antes.keys(), ...despues.keys()])];
  return nombres.flatMap((campo) => {
    const a = antes.get(campo);
    const d = despues.get(campo);
    if ((a?.valor ?? null) === (d?.valor ?? null)) return [];
    return [{ campo, antes: a?.valor ?? null, despues: d?.valor ?? null, ...(a?.sensible || d?.sensible ? { sensible: true as const } : {}) }];
  });
}

/** Sin cambios no hay corrección que registrar. */
export function exigirCambios(cambios: unknown[]): void {
  if (!cambios.length) throw new BadRequestException('No hay cambios para guardar: los datos son iguales a los registrados.');
}
