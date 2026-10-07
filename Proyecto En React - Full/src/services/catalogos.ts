// Peticiones de catálogos de referencia. La API ya los devuelve normalizados
// (mayúsculas, sin duplicados, ordenados).
import { api } from './api/client'

/** departamento → localidad → distritos */
export type CatalogoLocalidades = Record<string, Record<string, string[]>>

/** Árbol de canales: canal principal → secundario → terciario → cuarto → [quintos]. */
export interface NodoCascada {
  [canal: string]: NodoCascada | string[]
}

export interface DatosSuministro {
  fuentesAgua: string[]
  sistemasDistribucion: string[]
  /** canal principal → canales secundarios */
  canalesPrincipales: Record<string, string[]>
  cascada: NodoCascada
  desagues: string[]
}

/** departamento → localidad → distrito → datos de suministro */
export type CatalogoSuministro = Record<string, Record<string, Record<string, DatosSuministro>>>

export async function fetchCatalogoLocalidades(): Promise<CatalogoLocalidades> {
  const { data } = await api.get<CatalogoLocalidades>('/catalogoLocalidades')
  return data
}

/** Con el backend real convendría pedir solo la ubicación elegida (?departamento=…). */
export async function fetchCatalogoSuministro(): Promise<CatalogoSuministro> {
  const { data } = await api.get<CatalogoSuministro>('/catalogoSuministro')
  return data
}
