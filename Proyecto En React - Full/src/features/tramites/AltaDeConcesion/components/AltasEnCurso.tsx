import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAltasEnCarga } from '../hooks'

/**
 * Altas que Catastro está cargando o corrigiendo (todavía no salieron, o volvieron
 * observadas). No se pueden descartar: el expediente en papel ya está registrado; si no
 * prospera, se rechaza en el circuito y queda en el historial.
 */
export function AltasEnCurso() {
  const navigate = useNavigate()
  const altas = useAltasEnCarga()

  function contenido() {
    if (altas.isPending) return <LoadingState mensaje="Cargando altas en carga…" className="py-8" />
    if (altas.isError) return <ErrorState error={altas.error} onRetry={() => void altas.refetch()} reintentando={altas.isFetching} className="py-8" />
    if (altas.data.length === 0) {
      return <EmptyState icon="task_alt" titulo="No hay altas en carga" descripcion="Las altas iniciadas y no enviadas, o devueltas para corregir, aparecen acá." className="py-8" />
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {altas.data.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                Expediente {a.numeroExpediente}
                {a.etapa === 'CORRECCION' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Observado: corregir</span>
                )}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {a.titular ?? 'Sin titular cargado'} · Ingresó {formatearFecha(a.fechaIngreso)} · Actualizado {formatearFecha(a.actualizado)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" iconLeft="history" onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(a.id))}>
                Expediente
              </Button>
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.altaConcesion.datos(a.id))}>
                {a.etapa === 'CORRECCION' ? 'Corregir' : 'Continuar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Altas en carga</h2>
        {altas.isFetching && !altas.isPending && <span className="text-xs text-slate-400">Actualizando…</span>}
      </div>
      {contenido()}
    </Card>
  )
}
