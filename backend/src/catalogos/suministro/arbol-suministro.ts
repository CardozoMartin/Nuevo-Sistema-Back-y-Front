// El catálogo de suministro de riego como árbol por distrito: lectura de lo que cargaron los
// jefes de Distrito y las reglas para validar el suministro de una concesión. Funciones puras
// (se prueban sin base: npm test).
import { BadRequestException } from '@nestjs/common';
import { NIVELES_SUMINISTRO, NivelSuministro, nombreDeNivel } from '../entities/suministro-nodo.entity.js';

/** Un tramo del árbol con lo que cuelga de él (lo que recibe el formulario del alta). */
export interface NodoArbol {
  nombre: string;
  nivel: NivelSuministro;
  hijos: NodoArbol[];
}

/** Código del distrito («I» … «VII») → sus fuentes, cada una con su árbol. */
export type CatalogoSuministro = Record<string, NodoArbol[]>;

/** Lo que manda el formulario en el paso 6 (solo los campos que salen del árbol). */
export interface SeleccionSuministro {
  /** La primera es la principal: de ella sale el camino; las demás son fuentes adicionales. */
  fuentes?: string[];
  sistemaDistribucion?: string | null;
  canalPrincipal?: string | null;
  canalSecundario?: string | null;
  canalTerciario?: string | null;
  canalCuarto?: string | null;
  canalQuinto?: string | null;
  desague?: string | null;
}

/** El campo de la selección que corresponde a cada nivel después de la fuente, en orden. */
export const CAMPO_DE_NIVEL: [NivelSuministro, Exclude<keyof SeleccionSuministro, 'fuentes'>][] = [
  [NivelSuministro.SISTEMA, 'sistemaDistribucion'],
  [NivelSuministro.CANAL_PRINCIPAL, 'canalPrincipal'],
  [NivelSuministro.CANAL_SECUNDARIO, 'canalSecundario'],
  [NivelSuministro.CANAL_TERCIARIO, 'canalTerciario'],
  [NivelSuministro.CANAL_CUARTO, 'canalCuarto'],
  [NivelSuministro.CANAL_QUINTO, 'canalQuinto'],
  [NivelSuministro.DESAGUE, 'desague'],
];

const alfabetico = new Intl.Collator('es');

/** Sin espacios de más y en mayúsculas (el mismo criterio con que se muestra en el formulario). */
export const normalizarValor = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Largo máximo de un nombre del catálogo (columna `nombre` de cat_suministro_nodo). */
export const MAX_NOMBRE_SUMINISTRO = 120;

/**
 * Texto que NO es un tramo de la red: líneas copiadas de la página web de la DRH
 * («2. COSTO: ESTAMPILLAS PROVINCIALES $ 30», «6. E-MAIL: CATASTRO@…», «FORMULARIOS»).
 */
export function esTextoAjeno(nombre: string): boolean {
  return /^\d+\.\s/.test(nombre) || /^FORMULARIOS?$/.test(nombre) || /CLIC AQU[IÍ]|@|\$/.test(nombre) || nombre.length > MAX_NOMBRE_SUMINISTRO;
}

/**
 * Arma el árbol de un distrito con las ramas del Excel de los jefes (recursos/catalogos/
 * arbol-suministro.json): una fila por rama, una columna por nivel (fuente, sistema, canal
 * principal … quinto, desagüe). Las filas comparten el comienzo («RIO SALI > SAN JOSE > …»):
 * los tramos iguales se juntan. Una celda vacía es un nivel que esa rama no tiene: el tramo
 * siguiente cuelga del último con valor. Los nombres van como están (solo mayúsculas y sin
 * espacios de más). Una rama sin fuente no se puede colgar: se anota en `descartadas`.
 */
export function arbolDesdeRamas(ramas: (string | null)[][], descartadas: string[] = []): NodoArbol[] {
  const raices: NodoArbol[] = [];
  for (const rama of ramas) {
    const valores = NIVELES_SUMINISTRO.map((_, i) => normalizarValor(rama[i]));
    if (!valores[0]) {
      if (valores.some(Boolean)) descartadas.push(valores.filter(Boolean).join(' > '));
      continue;
    }
    let destino = raices;
    valores.forEach((nombre, i) => {
      if (!nombre) return;
      const nivel = NIVELES_SUMINISTRO[i].nivel;
      let nodo = destino.find((n) => n.nivel === nivel && n.nombre === nombre);
      if (!nodo) destino.push((nodo = { nombre, nivel, hijos: [] }));
      destino = nodo.hijos;
    });
  }
  ordenarArbol(raices);
  return raices;
}

/** Alfabético en cada nivel (como lo muestra el formulario). */
export function ordenarArbol<T extends { nombre: string; hijos: T[] }>(nodos: T[]): T[] {
  nodos.sort((a, b) => alfabetico.compare(a.nombre, b.nombre)).forEach((n) => ordenarArbol(n.hijos));
  return nodos;
}

const tieneValor = (v: string | null | undefined): v is string => !!v?.trim();

/**
 * El suministro elegido tiene que ser un camino del árbol del distrito de la concesión:
 *   1. Sin árbol (el distrito todavía no lo tiene cargado): solo se cargan la observación y el
 *      caudal. Si vienen fuentes o canales, 400.
 *   2. Con árbol: al menos una fuente, y cada fuente, una del distrito.
 *   3. Desde la fuente principal, cada nivel elegido cuelga del anterior elegido. Un nivel que
 *      no se eligió se salta (la rama no lo tiene), y el camino puede terminar en cualquier tramo.
 * `lugar` es el distrito escrito para los mensajes (ej: «el distrito I»).
 */
export function exigirSuministroDelArbol(arbol: NodoArbol[] | null, s: SeleccionSuministro, lugar: string): void {
  //1.- Sin árbol para el distrito.
  if (!arbol?.length) {
    const cargados = [...(s.fuentes ?? []), ...CAMPO_DE_NIVEL.map(([, campo]) => s[campo])].filter(tieneValor);
    if (cargados.length) {
      throw new BadRequestException(
        `No hay árbol de suministro cargado para ${lugar}: solo se pueden cargar la observación y el caudal asignado. ` +
          'Catastro lo puede cargar en «Catálogo de suministro».',
      );
    }
    return;
  }

  //2.- Las fuentes, del distrito.
  if (!s.fuentes?.length) throw new BadRequestException('Seleccione al menos una fuente de agua.');
  const fuentes = s.fuentes.map((f) => {
    const nodo = arbol.find((n) => n.nombre === normalizarValor(f));
    if (!nodo) throw new BadRequestException(`La fuente de agua «${f}» no está en el árbol de suministro de ${lugar}.`);
    return nodo;
  });

  //3.- El camino desde la fuente principal.
  let actual = fuentes[0];
  for (const [nivel, campo] of CAMPO_DE_NIVEL) {
    const valor = s[campo];
    if (!tieneValor(valor)) continue;
    const hijo = actual.hijos.find((h) => h.nivel === nivel && h.nombre === normalizarValor(valor));
    if (!hijo) {
      const opciones = actual.hijos.filter((h) => h.nivel === nivel).map((h) => h.nombre);
      const validas = opciones.length ? ` Opciones: ${opciones.join(', ')}.` : ` De «${actual.nombre}» no sale ningún ${nombreDeNivel(nivel)}.`;
      throw new BadRequestException(`El ${nombreDeNivel(nivel)} «${valor}» no sale de «${actual.nombre}» en el árbol de suministro de ${lugar}.${validas}`);
    }
    actual = hijo;
  }
}
