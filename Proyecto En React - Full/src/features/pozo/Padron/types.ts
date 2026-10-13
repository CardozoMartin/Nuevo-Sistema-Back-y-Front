// Padrón de pozos (listado por origen). PROTOTIPO: lo responde el backend emulado
// (services/demo/servidor/pozos.ts, GET /pozos/padron).
import type { PozoBackend } from '../BajaDePozo/types'

/** Cómo entró el pozo al padrón. */
export type OrigenPozo = 'OFICIO' | 'AUTORIZACION' | 'MIGRACION'

export interface PozoEnPadron {
  id: string
  idInterno: string
  alias: string | null
  estado: PozoBackend['estado']
  origen: OrigenPozo
  jurisdiccionDrh: boolean
  profundidadM: number | null
  caudalLps: number | null
  coordX: number
  coordY: number
  latitud: number
  longitud: number
  departamento: string | null
  localidad: string | null
  distrito: string | null
  concesion: { id: string; numero: string | null; titular: string | null } | null
  /** Solo los registrados de oficio (los migrados vienen del padrón anterior, sin ficha). */
  registro: {
    expediente: string
    /** Expediente del circuito y dónde está. */
    expedienteId: string
    circuito: { estado: string; etapaNombre: string; oficinaNombre: string }
    motivo: string
    causante: string
    documento: string | null
    fechaIngreso: string
    asunto: string | null
    registradoPor: string
    registradoEn: string
    /** En qué se cargó la coordenada (la otra forma la calculó el sistema). */
    sistemaCoordenada: 'POSGAR_FAJA3' | 'WGS84'
    monitoreos: { hidraulicos: number; quimicos: number }
  } | null
}

export interface PadronPozos {
  pozos: PozoEnPadron[]
  /** Cuántos hay de cada origen (para las solapas), sin contar la búsqueda. */
  totales: Record<OrigenPozo | 'TODOS', number>
}
