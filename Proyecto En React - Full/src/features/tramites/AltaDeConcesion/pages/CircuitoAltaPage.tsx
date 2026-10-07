import { useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { esNoEncontrado } from '@/services/api/errors'
import { AccionesOficina } from '../components/circuito/AccionesOficina'
import { BarraEtapas } from '../components/circuito/BarraEtapas'
import { DatosAlta } from '../components/circuito/DatosAlta'
import { HistorialAlta } from '../components/circuito/HistorialAlta'
import { useAlta } from '../hooks'

const TITULO = 'Expediente de alta de concesión'

/**
 * Un alta en el circuito de oficinas (backend real): dónde está, qué tiene que hacer la
 * oficina que lo tiene, los datos cargados y el historial completo de pases y actuaciones.
 */
export default function CircuitoAltaPage() {
  const { expedienteId } = useParams()
  const alta = useAlta(expedienteId)

  if (alta.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (alta.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(alta.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : (
          <ErrorState error={alta.error} onRetry={() => void alta.refetch()} reintentando={alta.isFetching} />
        )}
      </>
    )
  }

  const a = alta.data
  return (
    <>
      <PageHeader
        title={`Expediente ${a.numeroExpediente}`}
        description={`Alta de concesión · ${a.titulares[0] ? (a.titulares[0].razonSocial ?? `${a.titulares[0].apellido}, ${a.titulares[0].nombre}`) : 'sin titular cargado'}${a.concesion.numero ? ` · Concesión N° ${a.concesion.numero}` : ''}`}
      />

      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <BarraEtapas circuito={a.circuito} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <Card className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {a.circuito.oficinaNombre} · {a.circuito.etapaNombre}
                </h2>
                {a.circuito.tomadoPor && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Lo tiene {a.circuito.tomadoPor.nombre} desde {new Date(a.circuito.tomadoEn!).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
              <AccionesOficina alta={a} />
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Datos del expediente</h2>
              <DatosAlta alta={a} />
            </Card>
          </div>

          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial</h2>
            <HistorialAlta expedienteId={a.id} />
          </Card>
        </div>
      </div>
    </>
  )
}
