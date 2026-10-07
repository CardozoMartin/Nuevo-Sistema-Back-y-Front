// Conexión de eventos en tiempo real. Hoy usa SSE (EventSource) contra el servidor de
// eventos de la demo; si el backend real usa WebSocket o Socket.IO, solo cambia este archivo.
import type { EstadoExpediente, Oficina, TipoTramite } from '@/types/domain'

export interface EventoExpediente {
  tipo: 'nuevo' | 'derivado' | 'observado' | 'finalizado' | 'solicitud_numero' | 'numero_asignado'
  /** Solo en numero_asignado. */
  numeroConcesion?: string
  expediente: {
    id: string
    numero: string
    tramiteId: TipoTramite
    titular: string
    oficinaId: Oficina
    estadoId: EstadoExpediente
  }
  /** Oficina de donde salió (solo en derivado / finalizado). */
  oficinaOrigenId?: Oficina
  fecha: string // ISO
}

export type EstadoConexion = 'conectando' | 'en_vivo' | 'desconectado'

const URL_EVENTOS = `${import.meta.env.VITE_API_URL ?? '/api'}/events`
const REINTENTO_MS = 5000

/**
 * Se suscribe a los eventos de expedientes. Devuelve la función para desuscribirse.
 * EventSource reintenta solo ante cortes de red, pero no si el servidor responde con error
 * (ej: 502 del proxy cuando el servidor de eventos está apagado): ese caso se reintenta acá.
 */
export function suscribirEventos(onEvento: (e: EventoExpediente) => void, onEstado: (e: EstadoConexion) => void): () => void {
  let fuente: EventSource | null = null
  let reintento: ReturnType<typeof setTimeout> | undefined
  let activo = true

  function conectar() {
    if (!activo) return
    onEstado('conectando')
    fuente = new EventSource(URL_EVENTOS)
    fuente.onopen = () => onEstado('en_vivo')
    fuente.addEventListener('expediente', (msg) => {
      try {
        onEvento(JSON.parse((msg as MessageEvent<string>).data) as EventoExpediente)
      } catch {
        /* mensaje malformado: se ignora */
      }
    })
    fuente.onerror = () => {
      if (fuente?.readyState === EventSource.CLOSED) {
        onEstado('desconectado')
        reintento = setTimeout(conectar, REINTENTO_MS)
      } else {
        onEstado('conectando') // EventSource está reintentando solo
      }
    }
  }

  conectar()
  return () => {
    activo = false
    clearTimeout(reintento)
    fuente?.close()
  }
}
