// Colores de las concesiones en el visor: se elige un criterio (estado, uso, distrito…) y cada
// valor de ese criterio tiene su color. La leyenda sirve también de filtro: se puede apagar
// cada color.
import { ESTADOS } from './estilos'
import type { AtributosConcesion, ConcesionGeo, EstadoConcesionGeo } from './types'

export type CriterioColor = 'estado' | 'uso' | 'distrito' | 'departamento' | 'fuente'

export const CRITERIOS: { valor: CriterioColor; nombre: string }[] = [
  { valor: 'estado', nombre: 'Estado' },
  { valor: 'uso', nombre: 'Uso del agua' },
  { valor: 'distrito', nombre: 'Distrito de riego' },
  { valor: 'departamento', nombre: 'Departamento' },
  { valor: 'fuente', nombre: 'Fuente (río)' },
]

/** Valor que se usa cuando la concesión no tiene el dato. */
export const SIN_DATO = '(sin dato)'
const COLOR_SIN_DATO = '#94a3b8'

/**
 * Paleta para valores sin color propio: colores bien distintos entre sí y que se ven sobre los
 * mapas de fondo (Argenmap, OpenStreetMap y satélite).
 */
const PALETA = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0d9488', '#9333ea', '#ca8a04', '#4f46e5', '#be123c', '#059669', '#a16207']

/** El valor de una concesión para el criterio (el primer uso, si tiene varios). */
export function valorDe(p: AtributosConcesion, criterio: CriterioColor): string {
  const v =
    criterio === 'estado'
      ? p.estado
      : criterio === 'uso'
        ? p.usos?.split(',')[0]?.trim()
        : criterio === 'distrito'
          ? p.distrito
          : criterio === 'departamento'
            ? p.departamento
            : p.fuente
  return v?.trim() || SIN_DATO
}

/** Cómo se muestra un valor en la leyenda. */
export function nombreValor(valor: string, criterio: CriterioColor): string {
  if (valor === SIN_DATO) return 'Sin dato'
  if (criterio === 'estado') return ESTADOS[valor as EstadoConcesionGeo]?.nombre ?? valor
  if (criterio === 'distrito') return `Distrito ${valor}`
  // «RIO MEDINA - A. BARRIENTO» → «Rio Medina - A. Barriento»
  return valor.toLowerCase().replace(/(^|[\s(.-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase())
}

export interface ItemLeyenda {
  valor: string
  nombre: string
  color: string
  cantidad: number
}

/**
 * Leyenda del criterio: un ítem por valor, con su color y cuántas concesiones lo tienen.
 * Los colores se asignan por orden alfabético (así un valor conserva su color aunque cambien
 * las cantidades); la lista se muestra de mayor a menor cantidad.
 */
export function armarLeyenda(concesiones: ConcesionGeo[], criterio: CriterioColor): ItemLeyenda[] {
  const cantidades = new Map<string, number>()
  for (const f of concesiones) {
    const v = valorDe(f.properties, criterio)
    cantidades.set(v, (cantidades.get(v) ?? 0) + 1)
  }
  const valores = [...cantidades.keys()].filter((v) => v !== SIN_DATO).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const colorDe = (v: string, i: number) =>
    v === SIN_DATO ? COLOR_SIN_DATO : criterio === 'estado' ? (ESTADOS[v as EstadoConcesionGeo]?.color ?? COLOR_SIN_DATO) : PALETA[i % PALETA.length]
  const items = valores.map((v, i) => ({ valor: v, nombre: nombreValor(v, criterio), color: colorDe(v, i), cantidad: cantidades.get(v)! }))
  if (cantidades.has(SIN_DATO)) items.push({ valor: SIN_DATO, nombre: 'Sin dato', color: COLOR_SIN_DATO, cantidad: cantidades.get(SIN_DATO)! })
  return items.sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Función de color para el mapa a partir de la leyenda. */
export function colorizador(leyenda: ItemLeyenda[], criterio: CriterioColor) {
  const colores = new Map(leyenda.map((i) => [i.valor, i.color]))
  return (p: AtributosConcesion) => colores.get(valorDe(p, criterio)) ?? COLOR_SIN_DATO
}
