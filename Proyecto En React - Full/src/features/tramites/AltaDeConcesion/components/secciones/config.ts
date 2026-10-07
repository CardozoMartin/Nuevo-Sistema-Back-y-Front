// Metadatos de las secciones de la pre carga (sin componentes, para poder importarlos
// desde cualquier lado sin arrastrar el mapa u otros bloques pesados).
import type { FieldPath } from 'react-hook-form'
import type { PreCargaForm } from '../../schemas'

export interface InfoSeccion {
  key: 'titular' | 'ubicacion' | 'catastral' | 'registral' | 'usos' | 'suministro'
  label: string
  /** Campos del formulario que se validan antes de pasar a la siguiente sección. */
  campos: FieldPath<PreCargaForm>[]
}

export const SECCIONES_PRECARGA: InfoSeccion[] = [
  { key: 'titular', label: 'Titular', campos: ['titulares', 'domicilios'] },
  { key: 'ubicacion', label: 'Ubicación', campos: ['ubicacion'] },
  { key: 'catastral', label: 'Catastral', campos: ['catastral'] },
  { key: 'registral', label: 'Registral', campos: ['registral'] },
  { key: 'usos', label: 'Usos', campos: ['usos'] },
  { key: 'suministro', label: 'Suministro', campos: ['suministro'] },
]

/** Índice de la sección a la que pertenece un campo (para llevar al usuario al primer error). */
export function seccionDeCampo(path: string): number {
  return SECCIONES_PRECARGA.findIndex((s) => s.campos.some((c) => path === c || path.startsWith(`${c}.`)))
}
