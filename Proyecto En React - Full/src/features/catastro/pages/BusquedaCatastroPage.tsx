import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { EstadoBadge } from '@/features/expedientes/components/EstadoBadge'
import { useExpedientes } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { soloDigitos } from '@/lib/mascaras'
import type { TipoTramite } from '@/types/domain'
import { buscarExpedientes, concesionDeExpediente, hayFiltros, ultimaObservacion, type FiltrosBusqueda } from '../busqueda'

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  )
}

/**
 * Buscador general de expedientes y concesiones (prototipo catastro/busquedaCatastro.html).
 * Catastro es el punto de entrada y cierre de todos los circuitos: consulta cualquier
 * trámite, en curso o finalizado, y desde «Ver» llega a su historial completo.
 */
export default function BusquedaCatastroPage() {
  const navigate = useNavigate()
  const d = useDominio()
  const expedientes = useExpedientes({})
  const [f, setF] = useState<FiltrosBusqueda>({})
  const [avanzados, setAvanzados] = useState(false)

  const editar = <K extends keyof FiltrosBusqueda>(campo: K, valor: string) => setF((x) => ({ ...x, [campo]: (valor || undefined) as FiltrosBusqueda[K] }))
  const consultando = hayFiltros(f)
  const resultados = useMemo(
    () => (consultando ? buscarExpedientes(expedientes.data ?? [], f, d) : []),
    [consultando, expedientes.data, f, d],
  )
  const opcionesTramite = d.tramites.map((t) => ({ value: t.id, label: t.nombre }))
  const opcionesEstado = [{ value: 'pendientes', label: 'Pendientes (en trámite u observados)' }, ...d.estados.map((e) => ({ value: e.id, label: e.nombre }))]

  /** Vista rápida: un atajo que completa Estado o Trámite. */
  function vistaRapida(valor: string) {
    if (!valor) return
    if (valor === '__todos') setF((x) => ({ ...x, estadoId: undefined, tramiteId: undefined, todos: true }))
    else if (valor.startsWith('__')) setF((x) => ({ ...x, estadoId: valor.slice(2) as FiltrosBusqueda['estadoId'], tramiteId: undefined }))
    else setF((x) => ({ ...x, tramiteId: valor as TipoTramite }))
  }

  function resultadosTabla() {
    if (!consultando) {
      return (
        <EmptyState
          icon="manage_search"
          titulo="Empiece por buscar o elegir una vista rápida"
          descripcion="Escriba un N° de concesión, expediente, titular, o seleccione una vista rápida arriba para ver los resultados de cualquier circuito."
          className="m-6"
        />
      )
    }
    if (expedientes.isPending) return <LoadingState mensaje="Buscando…" className="py-10" />
    if (expedientes.isError) {
      return <ErrorState error={expedientes.error} onRetry={() => void expedientes.refetch()} reintentando={expedientes.isFetching} className="m-6" />
    }
    if (resultados.length === 0) {
      return <EmptyState icon="search_off" titulo="No hay resultados" descripcion="Pruebe con otros datos o limpie los filtros." className="m-6" />
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-250 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Concesión</th>
              <th className="px-4 py-3">Expediente</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Trámite</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Oficina actual</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Observación</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {resultados.map((e) => {
              const concesionId = concesionDeExpediente(e)
              const pendiente = d.estadosPendientes.includes(e.estadoId)
              return (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold">
                    {concesionId && e.numeroConcesion ? (
                      <button type="button" className="text-primary hover:underline" onClick={() => navigate(ROUTES.catastro.concesion(concesionId))}>
                        {e.numeroConcesion}
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.numero}</td>
                  <td className="px-4 py-3">{e.titular}</td>
                  <td className="px-4 py-3">{d.nombreTramite(e.tramiteId)}</td>
                  <td className="px-4 py-3">
                    <EstadoBadge estadoId={e.estadoId} />
                  </td>
                  <td className="px-4 py-3">{pendiente ? d.nombreOficina(e.oficinaId) : '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatearFecha(e.fechaActualizacion)}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-slate-500 dark:text-slate-400" title={ultimaObservacion(e)}>
                    {ultimaObservacion(e) || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="font-medium text-primary hover:text-blue-700" onClick={() => navigate(ROUTES.catastro.expediente(e.id))}>
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Buscador general de expedientes y concesiones"
        description="Catastro es el punto de entrada y cierre de todos los circuitos: puede consultar cualquier tipo de trámite en curso o finalizado."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Búsqueda general</h3>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
              <Input
                icon="search"
                placeholder="Buscar por N° concesión, expediente, titular o trámite…"
                value={f.texto ?? ''}
                onChange={(e) => editar('texto', e.target.value)}
                aria-label="Búsqueda general"
              />
              <Select
                aria-label="Vista rápida"
                placeholder="Vista rápida…"
                value=""
                onChange={(e) => vistaRapida(e.target.value)}
                options={[
                  { value: '__todos', label: 'Todos los trámites' },
                  { value: '__pendientes', label: 'Pendientes' },
                  { value: '__finalizado', label: 'Finalizados' },
                  { value: '__observado', label: 'Observados' },
                  ...opcionesTramite,
                ]}
              />
            </div>

            <button
              type="button"
              onClick={() => setAvanzados(!avanzados)}
              className="flex w-fit items-center gap-1.5 text-sm font-semibold text-primary"
              aria-expanded={avanzados}
            >
              <Icon name="tune" className="text-lg!" /> Filtros avanzados
              <Icon name="expand_more" className={cn('text-lg! transition-transform', avanzados && 'rotate-180')} />
            </button>

            {avanzados && (
              <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Campo label="N° concesión">
                    <Input inputMode="numeric" placeholder="Ej. 906" value={f.numeroConcesion ?? ''} onChange={(e) => editar('numeroConcesion', soloDigitos(e.target.value))} />
                  </Campo>
                  <Campo label="Estado">
                    <Select options={opcionesEstado} placeholder="Todos" value={f.estadoId ?? ''} onChange={(e) => editar('estadoId', e.target.value)} />
                  </Campo>
                  <Campo label="Trámite">
                    <Select options={opcionesTramite} placeholder="Todos" value={f.tramiteId ?? ''} onChange={(e) => editar('tramiteId', e.target.value)} />
                  </Campo>
                  <Campo label="Resolución">
                    <Input placeholder="Ej. RES-2026-001" value={f.resolucion ?? ''} onChange={(e) => editar('resolucion', e.target.value)} />
                  </Campo>
                  <Campo label="Fecha desde">
                    <Input type="date" value={f.desde ?? ''} onChange={(e) => editar('desde', e.target.value)} />
                  </Campo>
                  <Campo label="Fecha hasta">
                    <Input type="date" value={f.hasta ?? ''} onChange={(e) => editar('hasta', e.target.value)} />
                  </Campo>
                  <Campo label="Concesión N° desde">
                    <Input inputMode="numeric" placeholder="900" value={f.concesionDesde ?? ''} onChange={(e) => editar('concesionDesde', soloDigitos(e.target.value))} />
                  </Campo>
                  <Campo label="Concesión N° hasta">
                    <Input inputMode="numeric" placeholder="1000" value={f.concesionHasta ?? ''} onChange={(e) => editar('concesionHasta', soloDigitos(e.target.value))} />
                  </Campo>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Datos catastrales (útil para ubicar permisos por el inmueble)</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Campo label="Padrón">
                    <Input placeholder="Ej. 123456" value={f.padron ?? ''} onChange={(e) => editar('padron', e.target.value)} />
                  </Campo>
                  <Campo label="Circunscripción">
                    <Input placeholder="Ej. II" value={f.circunscripcion ?? ''} onChange={(e) => editar('circunscripcion', e.target.value)} />
                  </Campo>
                  <Campo label="Sección">
                    <Input placeholder="Ej. B" value={f.seccion ?? ''} onChange={(e) => editar('seccion', e.target.value)} />
                  </Campo>
                  <Campo label="Parcela">
                    <Input placeholder="Ej. 14b" value={f.parcela ?? ''} onChange={(e) => editar('parcela', e.target.value)} />
                  </Campo>
                  <Campo label="Matrícula">
                    <Input placeholder="Ej. 001-20394" value={f.matricula ?? ''} onChange={(e) => editar('matricula', e.target.value)} />
                  </Campo>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">{consultando ? 'Filtros aplicados.' : 'Sin filtros.'}</span>
              <Button size="sm" variant="ghost" iconLeft="close" disabled={!consultando} onClick={() => setF({})}>
                Limpiar todo
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Resultados</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {resultados.length} expediente{resultados.length === 1 ? '' : 's'} · Ordenado por fecha más reciente
              </p>
            </div>
            {expedientes.isFetching && !expedientes.isPending && <Spinner className="size-4 text-primary" />}
          </div>
          {resultadosTabla()}
        </Card>
      </div>
    </>
  )
}
