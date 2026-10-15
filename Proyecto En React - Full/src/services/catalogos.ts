// Peticiones de catálogos de referencia: salen de la base (backend /catalogos/*), ya
// normalizados (mayúsculas, sin duplicados, ordenados). json-server solo en demo / dev:mock.
import { backend } from './api/backend'
import { api } from './api/client'
import { USA_JSON_SERVER } from './demo/modo'

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
  const { data } = USA_JSON_SERVER
    ? await api.get<CatalogoLocalidades>('/catalogoLocalidades')
    : await backend.get<CatalogoLocalidades>('/catalogos/ubicaciones')
  return data
}

/** El backend también acepta ?departamento=&localidad=&distrito= para pedir solo esa ubicación. */
export async function fetchCatalogoSuministro(): Promise<CatalogoSuministro> {
  const { data } = USA_JSON_SERVER
    ? await api.get<CatalogoSuministro>('/catalogoSuministro')
    : await backend.get<CatalogoSuministro>('/catalogos/suministro')
  return data
}
