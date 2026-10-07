// Datos de referencia del dominio: oficinas, circuito, trámites, estados, usos, etc.
// Viven en la API (json-server) y se relacionan por id con expedientes y borradores.
import type {
  EstadoInfo,
  EtapaInfo,
  OficinaInfo,
  OpcionCatalogo,
  SituacionLegalInfo,
  TramiteInfo,
  UsoInfo,
  Usuario,
} from '@/types/domain'
import { api } from './api/client'

export interface Dominio {
  oficinas: OficinaInfo[]
  etapas: EtapaInfo[]
  tramites: TramiteInfo[]
  estados: EstadoInfo[]
  situacionesLegales: SituacionLegalInfo[]
  usos: UsoInfo[]
  circunscripciones: OpcionCatalogo[]
  seccionesCatastrales: OpcionCatalogo[]
  caracteres: OpcionCatalogo[]
  codigosServicio: OpcionCatalogo[]
  tiposConcesion: OpcionCatalogo[]
  /** Documentos que Jurídico puede marcar como faltantes. */
  documentosJuridicos: OpcionCatalogo[]
  usuarios: Usuario[]
}

const COLECCIONES: (keyof Dominio)[] = [
  'oficinas',
  'etapas',
  'tramites',
  'estados',
  'situacionesLegales',
  'usos',
  'circunscripciones',
  'seccionesCatastrales',
  'caracteres',
  'codigosServicio',
  'tiposConcesion',
  'documentosJuridicos',
  'usuarios',
]

/**
 * Trae todas las colecciones de referencia en paralelo.
 * Con el backend real podría ser un único endpoint (ej: GET /dominio).
 */
export async function fetchDominio(): Promise<Dominio> {
  const respuestas = await Promise.all(COLECCIONES.map((c) => api.get<unknown[]>(`/${c}`)))
  const dominio = Object.fromEntries(COLECCIONES.map((c, i) => [c, respuestas[i].data])) as unknown as Dominio
  dominio.etapas = [...dominio.etapas].sort((a, b) => a.orden - b.orden)
  return dominio
}
