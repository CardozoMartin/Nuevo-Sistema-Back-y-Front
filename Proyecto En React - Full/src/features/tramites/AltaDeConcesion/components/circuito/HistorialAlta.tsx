import { ErrorState, LoadingState } from '@/components/feedback/States'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { EntradaHistorial } from '../../backend.types'
import { useHistorial } from '../../hooks'

const formatear = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Nombre de cada actuación para leer el historial sin códigos. */
const ACTUACION: Record<string, string> = {
  CARGA_COMPLETA: 'Carga completa',
  CORRECCION: 'Corrigió las observaciones',
  VERIFICACION_DEUDA: 'Verificó la deuda',
  DEUDA_CANCELADA: 'Se canceló la deuda',
  INFORME_TECNICO: 'Informe técnico',
  DICTAMEN_JURIDICO: 'Dictamen jurídico',
  NUMERO_CONCESION: 'Asignó el número de concesión',
  RESOLUCION: 'Cargó la resolución',
  VERIFICACION_FINAL: 'Verificación final',
  PADRON: 'Cargó el padrón de Rentas',
  // Baja de pozo (el historial es el mismo para cualquier expediente)
  DOCUMENTACION: 'Control de documentación',
  ANTECEDENTES: 'Verificó los antecedentes',
  EVALUACION_TECNICA: 'Evaluación técnica',
  CLAUSURA: 'Registró la clausura física',
  TOMA_CONOCIMIENTO: 'Tomó conocimiento',
  // Registro de pozo
  REGISTRO_POZO: 'Registró el pozo',
  REGISTRO_CONCESION: 'Registró la concesión del pozo',
  CIERRE: 'Cerró el expediente',
}

const RESULTADO: Record<string, { texto: string; color: string }> = {
  APTO: { texto: 'Apto', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  NO_APTO: { texto: 'No apto', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  SIN_DEUDA: { texto: 'Sin deuda', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  CON_DEUDA: { texto: 'Con deuda', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  REGISTRADO: { texto: 'Registrado', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
}

/** Dato extra de una actuación que conviene ver (número de concesión, resolución, padrón). */
function datoDestacado(e: Extract<EntradaHistorial, { tipo: 'ACTUACION' }>): string | null {
  const d = e.datos ?? {}
  if (e.actuacion === 'NUMERO_CONCESION' || ((e.actuacion === 'REGISTRO_CONCESION' || e.actuacion === 'CIERRE') && d.numero)) return `Concesión N° ${String(d.numero)}`
  if (e.actuacion === 'RESOLUCION') return `Resolución ${String(d.resolucion)} del ${String(d.fecha)}${d.decision === 'RECHAZAR' ? ' (rechaza)' : ''}`
  if (e.actuacion === 'CLAUSURA') return `Acta ${String(d.acta)} del ${String(d.fecha)}`
  if (e.actuacion === 'PADRON') return `Padrón ${String(d.padron)}`
  if (e.actuacion === 'VERIFICACION_DEUDA' && Array.isArray(d.deudas) && d.deudas.length) {
    return (d.deudas as { detalle: string }[]).map((x) => x.detalle).join(' · ')
  }
  return null
}

/**
 * Historial del expediente: cada pase (de qué oficina a cuál, quién lo envió, quién lo tomó
 * y cuándo) y cada actuación (qué resolvió cada oficina), en orden.
 */
export function HistorialAlta({ expedienteId }: { expedienteId: string }) {
  const historial = useHistorial(expedienteId)
  if (historial.isPending) return <LoadingState mensaje="Cargando historial…" className="py-6" />
  if (historial.isError) return <ErrorState error={historial.error} onRetry={() => void historial.refetch()} className="py-6" />

  return (
    <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
      {historial.data.map((e, i) => (
        <li key={i} className="mb-4 ml-5">
          <span
            className={cn(
              'absolute -left-3 grid size-6 place-items-center rounded-full ring-4 ring-white dark:ring-slate-900',
              e.tipo === 'PASE' ? (e.esDevolucion ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary') : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            <Icon name={e.tipo === 'PASE' ? (e.esDevolucion ? 'undo' : 'arrow_forward') : 'gavel'} className="text-[14px]!" />
          </span>
          {e.tipo === 'PASE' ? (
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.oficinaOrigen ? `${e.oficinaOrigen} → ${e.oficinaDestino}` : `Ingreso en ${e.oficinaDestino}`}
                {e.esDevolucion && <span className="ml-2 text-xs font-semibold text-amber-600">devolución</span>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatear(e.fecha)} · lo envió {e.enviadoPor}
                {e.recibidoPor ? ` · lo tomó ${e.recibidoPor} (${formatear(e.recibidoEn!)})` : ' · todavía nadie lo tomó'}
              </p>
            </div>
          ) : (
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.oficina}: {ACTUACION[e.actuacion] ?? e.actuacion}
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', RESULTADO[e.resultado]?.color)}>{RESULTADO[e.resultado]?.texto ?? e.resultado}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatear(e.fecha)} · {e.usuario}
              </p>
              {datoDestacado(e) && <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{datoDestacado(e)}</p>}
              {e.observaciones && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{e.observaciones}</p>}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
