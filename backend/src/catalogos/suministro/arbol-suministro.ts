// El catálogo de suministro de riego como árbol: lectura del archivo de la DRH y las reglas para
// validar el suministro de una concesión. Funciones puras (se prueban sin base: npm test).
import { BadRequestException } from '@nestjs/common';
import { NIVELES_CANAL } from '../entities/suministro-canal.entity.js';

/**
 * Cascada de canales tal como la usa el frontend: cada canal → sus derivaciones. En el último
 * nivel con hijos (el canal cuarto) la lista de canales quintos viene como array.
 */
export interface NodoCascada {
  [canal: string]: NodoCascada | string[];
}

/** Lo que el formulario ofrece para una zona (mismo formato que /catalogoSuministro de json-server). */
export interface DatosSuministro {
  fuentesAgua: string[];
  sistemasDistribucion: string[];
  /** Canal principal → canales secundarios. */
  canalesPrincipales: Record<string, string[]>;
  cascada: NodoCascada;
  desagues: string[];
}

/** departamento → localidad → distrito → datos. */
export type CatalogoSuministro = Record<string, Record<string, Record<string, DatosSuministro>>>;

/** Un canal del árbol con sus derivaciones (lo que se guarda en cat_suministro_canal). */
export interface CanalArbol {
  nombre: string;
  hijos: CanalArbol[];
}

/** Lo que manda el formulario en el paso 6 (solo los campos que salen del catálogo). */
export interface SeleccionSuministro {
  fuentes?: string[];
  sistemaDistribucion?: string | null;
  canalPrincipal?: string | null;
  canalSecundario?: string | null;
  canalesAdicionales?: string[] | null;
  desague?: string | null;
}

const alfabetico = new Intl.Collator('es');

/** Mismo criterio que el mock del frontend (build-db.mjs): sin espacios de más y en mayúsculas. */
export const normalizarValor = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Para comparar nombres de localidades escritos distinto: sin tildes, sin «*» y en mayúsculas. */
export const claveLocalidad = (v: string) =>
  normalizarValor(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .trim();

/** Largo máximo de un nombre del catálogo (columna `nombre` de las tablas cat_suministro_*). */
export const MAX_NOMBRE_SUMINISTRO = 120;

/**
 * Texto que NO es un canal ni una fuente: el archivo de la DRH trae, mezcladas como canales
 * secundarios, líneas copiadas de su página web («2. COSTO: ESTAMPILLAS PROVINCIALES $ 30»,
 * «6. E-MAIL: CATASTRO@…», «FORMULARIOS», «… (CLIC AQUÍ PARA DESCARGAR …)»). Se descartan.
 */
export function esTextoAjeno(nombre: string): boolean {
  return /^\d+\.\s/.test(nombre) || /^FORMULARIOS?$/.test(nombre) || /CLIC AQU[IÍ]|@|\$/.test(nombre) || nombre.length > MAX_NOMBRE_SUMINISTRO;
}

/**
 * Lee el árbol de la DRH (recursos/catalogos/suministro.json) y lo normaliza igual que el
 * frontend: nombres en mayúsculas, sin repetidos, ordenados; «desagies» (sic) → desagues.
 * Además descarta los textos ajenos (ver esTextoAjeno) y los anota en `descartados`.
 */
export function normalizarCatalogo(crudo: Record<string, Record<string, Record<string, Record<string, unknown>>>>, descartados: string[] = []): CatalogoSuministro {
  const valido = (nombre: string) => {
    if (!nombre) return false;
    if (!esTextoAjeno(nombre)) return true;
    descartados.push(nombre);
    return false;
  };
  const lista = (xs: unknown) => [...new Set((Array.isArray(xs) ? xs : []).map(normalizarValor).filter(valido))].sort(alfabetico.compare);
  // Dos canales hermanos pueden quedar con el mismo nombre al normalizar («DVDO.  NORTE» y
  // «DVDO. NORTE»): se juntan sus derivaciones en lugar de pisar las del primero.
  const comoNodo = (n: NodoCascada | string[]): NodoCascada => (Array.isArray(n) ? Object.fromEntries(n.map((h) => [h, {}])) : n);
  const juntar = (a: NodoCascada | string[], b: NodoCascada | string[]): NodoCascada | string[] => {
    if (Array.isArray(a) && Array.isArray(b)) return lista([...a, ...b]);
    const salida = { ...comoNodo(a) };
    for (const [nombre, hijos] of Object.entries(comoNodo(b))) salida[nombre] = nombre in salida ? juntar(salida[nombre], hijos) : hijos;
    return salida;
  };
  const cascada = (nodo: unknown): NodoCascada => {
    const salida: NodoCascada = {};
    for (const [canal, hijos] of Object.entries((nodo ?? {}) as Record<string, unknown>)) {
      const nombre = normalizarValor(canal);
      if (!valido(nombre)) continue;
      const normalizado = Array.isArray(hijos) ? lista(hijos) : cascada(hijos);
      salida[nombre] = nombre in salida ? juntar(salida[nombre], normalizado) : normalizado;
    }
    return salida;
  };

  const catalogo: CatalogoSuministro = {};
  for (const [departamento, localidades] of Object.entries(crudo)) {
    for (const [localidad, distritos] of Object.entries(localidades)) {
      for (const [distrito, datos] of Object.entries(distritos)) {
        const principales = (datos.canalesPrincipales ?? {}) as Record<string, unknown>;
        ((catalogo[normalizarValor(departamento)] ??= {})[normalizarValor(localidad)] ??= {})[normalizarValor(distrito)] = {
          fuentesAgua: lista(datos.fuentesAgua),
          sistemasDistribucion: lista(datos.sistemasDistribucion),
          canalesPrincipales: Object.fromEntries(
            Object.entries(principales)
              .map(([p, sec]) => [normalizarValor(p), sec] as const)
              .filter(([p]) => valido(p))
              .map(([p, sec]) => [p, lista(sec)]),
          ),
          cascada: cascada(datos.cascada),
          desagues: lista(datos.desagies ?? datos.desagues),
        };
      }
    }
  }
  return catalogo;
}

/**
 * Árbol de canales de una zona. Junta las dos fuentes del archivo, que se superponen:
 * `canalesPrincipales` (principal → secundarios) y `cascada` (principal → secundario → … → quinto).
 * Corta en el nivel 5 (canal quinto): el formulario no tiene más niveles.
 */
export function arbolDeCanales(datos: DatosSuministro): CanalArbol[] {
  const agregar = (destino: CanalArbol[], nombre: string): CanalArbol => {
    let canal = destino.find((c) => c.nombre === nombre);
    if (!canal) destino.push((canal = { nombre, hijos: [] }));
    return canal;
  };
  const recorrer = (nodo: NodoCascada | string[], destino: CanalArbol[], nivel: number) => {
    if (nivel > NIVELES_CANAL.length) return;
    for (const nombre of Array.isArray(nodo) ? nodo : Object.keys(nodo)) {
      const canal = agregar(destino, nombre);
      if (!Array.isArray(nodo)) recorrer(nodo[nombre], canal.hijos, nivel + 1);
    }
  };

  const raiz: CanalArbol[] = [];
  for (const [principal, secundarios] of Object.entries(datos.canalesPrincipales)) {
    const canal = agregar(raiz, principal);
    for (const s of secundarios) agregar(canal.hijos, s);
  }
  recorrer(datos.cascada, raiz, 1);

  const ordenar = (canales: CanalArbol[]) => canales.sort((a, b) => alfabetico.compare(a.nombre, b.nombre)).forEach((c) => ordenar(c.hijos));
  ordenar(raiz);
  return raiz;
}

/**
 * Lo inverso: del árbol guardado a lo que usa el formulario (canalesPrincipales + cascada).
 * En la cascada, el canal cuarto lleva la lista de quintos como array (formato del frontend).
 */
export function datosDeArbol(canales: CanalArbol[]): Pick<DatosSuministro, 'canalesPrincipales' | 'cascada'> {
  const cascada = (hijos: CanalArbol[], nivel: number): NodoCascada =>
    Object.fromEntries(hijos.map((c) => [c.nombre, nivel === 4 ? c.hijos.map((h) => h.nombre) : cascada(c.hijos, nivel + 1)]));
  return {
    canalesPrincipales: Object.fromEntries(canales.map((c) => [c.nombre, c.hijos.map((h) => h.nombre)])),
    cascada: cascada(canales, 1),
  };
}

const tieneValor = (v: string | null | undefined) => !!v?.trim();

/**
 * El suministro elegido tiene que existir en el catálogo de la zona de la concesión:
 *   1. Sin zona (no hay catálogo para esa ubicación): el formulario no ofrece opciones, así que
 *      solo se cargan la observación y el caudal. Si vienen fuentes o canales, 400.
 *   2. Con zona: al menos una fuente; cada fuente, el sistema y el desagüe, de sus listas.
 *   3. Los canales tienen que ser un CAMINO del árbol: el principal de la zona, el secundario
 *      que deriva de ese principal, el terciario de ese secundario, y así.
 * `lugar` es la ubicación escrita para los mensajes (ej: «LULES, LULES, distrito IV»).
 */
export function exigirSuministroDelCatalogo(datos: DatosSuministro | null, s: SeleccionSuministro, lugar: string): void {
  const canales = [s.canalPrincipal, s.canalSecundario, ...(s.canalesAdicionales ?? [])].filter(tieneValor) as string[];

  //1.- Sin catálogo para la ubicación.
  if (!datos) {
    const cargados = [...(s.fuentes ?? []), s.sistemaDistribucion, s.desague, ...canales].filter(tieneValor);
    if (cargados.length) {
      throw new BadRequestException(
        `No hay catálogo de suministro para ${lugar}: solo se pueden cargar la observación y el caudal asignado. ` +
          'Si la zona existe en el catálogo con otro nombre, Catastro tiene que vincularla a la localidad.',
      );
    }
    return;
  }

  //2.- Fuentes, sistema y desagüe, de las listas de la zona.
  if (!s.fuentes?.length) throw new BadRequestException('Seleccione al menos una fuente de agua.');
  const exigirDeLista = (valor: string | null | undefined, opciones: string[], que: string) => {
    if (tieneValor(valor) && !opciones.includes(normalizarValor(valor))) throw new BadRequestException(`${que} «${valor}» no está en el catálogo de suministro de ${lugar}.`);
  };
  for (const fuente of s.fuentes) exigirDeLista(fuente, datos.fuentesAgua, 'La fuente de agua');
  exigirDeLista(s.sistemaDistribucion, datos.sistemasDistribucion, 'El sistema de distribución');
  exigirDeLista(s.desague, datos.desagues, 'El desagüe');

  //3.- Los canales, un camino del árbol desde el principal.
  let opciones = arbolDeCanales(datos);
  canales.forEach((nombre, nivel) => {
    const canal = opciones.find((c) => c.nombre === normalizarValor(nombre));
    if (!canal) {
      const padre = nivel > 0 ? ` que deriva del ${NIVELES_CANAL[nivel - 1]} «${canales[nivel - 1]}»` : '';
      const validas = opciones.length ? ` Opciones: ${opciones.map((c) => c.nombre).join(', ')}.` : ' No tiene derivaciones en el catálogo.';
      throw new BadRequestException(`El ${NIVELES_CANAL[nivel]} «${nombre}»${padre} no está en el catálogo de suministro de ${lugar}.${validas}`);
    }
    opciones = canal.hijos;
  });
}
