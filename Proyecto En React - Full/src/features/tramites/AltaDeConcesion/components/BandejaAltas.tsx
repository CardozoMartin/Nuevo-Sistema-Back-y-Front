import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import type { EstadoExpedienteBackend, OficinaBackend } from '../backend.types'
import { useBandeja } from '../hooks'

const ESTADO: Partial<Record<EstadoExpedienteBackend, { texto: string; color: string }>> = {
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  EN_ESPERA: { texto: 'En espera (deuda)', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

/**
 * Altas de concesión que están en la oficina (backend real). Va arriba de la bandeja de los
 * demás trámites, que todavía usan los datos de demostración. En Catastro incluye las altas en
 * carga y las devueltas para corregir: desde el expediente se continúa o se corrige la carga.
 */
export function BandejaAltas({ oficina }: { oficina: OficinaBackend }) {
  const navigate = useNavigate()
  const bandeja = useBandeja(oficina)
  const altas = bandeja.data?.filter((e) => e.tipoTramite === 'ALTA_CONCESION') ?? []

  function contenido() {
    if (bandeja.isPending) return <LoadingState mensaje="Cargando altas…" className="py-6" />
    if (bandeja.isError) return <ErrorState error={bandeja.error} onRetry={() => void bandeja.refetch()} reintentando={bandeja.isFetching} className="py-6" />
    if (!altas.length) return <EmptyState icon="inbox" titulo="No hay altas en esta oficina" className="py-6" />
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {altas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
                Expediente {e.numero}
                {ESTADO[e.estado] && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO[e.estado]!.color)}>{ESTADO[e.estado]!.texto}</span>}
                {!e.tomadoPor && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Sin tomar</span>}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {e.titular ?? 'Sin titular cargado'} · {e.etapaNombre}
                {e.enLaOficinaDesde && ` · llegó ${haceCuanto(e.enLaOficinaDesde)}`}
                {e.tomadoPor && ` · lo tiene ${e.tomadoPor}`}
              </p>
            </div>
            <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(e.id))}>
              {e.tomadoPor ? 'Abrir' : 'Revisar'}
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="mb-6 p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Altas de concesión</h2>
        <span className="text-xs text-slate-400">{bandeja.isFetching && !bandeja.isPending ? 'Actualizando…' : `${altas.length} en la oficina`}</span>
      </div>
      {contenido()}
    </Card>
  )
}
