import type { CatalogoSuministro, DatosSuministro, NodoCascada } from '@/services/catalogos'

export const NIVELES_CANAL_ADICIONAL = ['Canal terciario', 'Canal cuarto', 'Canal quinto'] as const

const collator = new Intl.Collator('es')

export interface UbicacionSeleccionada {
  departamento: string
  localidad: string
  distrito: string
}

export function getDatosSuministro(catalogo: CatalogoSuministro | null, u: UbicacionSeleccionada): DatosSuministro | null {
  if (!catalogo || !u.departamento || !u.localidad || !u.distrito) return null
  return catalogo[u.departamento]?.[u.localidad]?.[u.distrito] ?? null
}

/**
 * Opciones del próximo canal adicional recorriendo la cascada:
 * principal → secundario → (canales adicionales ya elegidos) → ?
 * El último nivel de la cascada es una lista de strings en lugar de un objeto.
 */
export function opcionesCanalSiguiente(datos: DatosSuministro | null, principal: string, secundario: string, previos: string[]): string[] {
  if (!datos || !principal || !secundario) return []
  let nodo: NodoCascada | string[] | undefined = datos.cascada[principal]
  for (const canal of [secundario, ...previos]) {
    if (!nodo || Array.isArray(nodo) || !canal) return []
    nodo = nodo[canal]
  }
  if (!nodo) return []
  return (Array.isArray(nodo) ? [...nodo] : Object.keys(nodo)).filter(Boolean).sort(collator.compare)
}
