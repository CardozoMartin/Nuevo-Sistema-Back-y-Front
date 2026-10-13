import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { MODO_DEMO } from '@/services/demo/modo'
import { ESTADO_POZO, formatoFecha, formatoNumero } from '../../BajaDePozo/estilos'
import { usePadronPozos } from '../api'
import { MarcaOrigen } from '../components/MarcaOrigen'
import { ORIGEN_POZO } from '../estilos'
import type { OrigenPozo, PozoEnPadron } from '../types'

const SOLAPAS: { origen: OrigenPozo | null; texto: string }[] = [
  { origen: 'OFICIO', texto: 'De oficio' },
  { origen: 'AUTORIZACION', texto: 'Con autorización' },
  { origen: 'MIGRACION', texto: 'Padrón anterior' },
  { origen: null, texto: 'Todos' },
]

/** Espera a que el usuario deje de escribir para buscar. */
function useDemorado<T>(valor: T, ms = 300) {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return demorado
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
    </div>
  )
}

/** Detalle de la fila: el registro de oficio (o lo que se sabe del migrado) y las coordenadas. */
function Detalle({ p }: { p: PozoEnPadron }) {
  const r = p.registro
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {r ? (
        <>
          <Dato etiqueta="Registro de oficio" valor={r.expediente} />
          <Dato etiqueta="Circuito" valor={r.circuito.estado === 'FINALIZADO' ? 'Finalizado' : r.circuito.estado === 'RECHAZADO' ? 'Rechazado' : `${r.circuito.oficinaNombre} · ${r.circuito.etapaNombre}`} />
          <Dato etiqueta="Motivo" valor={r.motivo} />
          <Dato etiqueta="Fecha de ingreso" valor={formatoFecha(r.fechaIngreso)} />
          <Dato etiqueta="Registró" valor={`${r.registradoPor} · ${formatoFecha(r.registradoEn)}`} />
          <Dato etiqueta="Causante" valor={r.causante} />
          <Dato etiqueta="CUIT / DNI" valor={r.documento} />
          <Dato etiqueta="Asunto" valor={r.asunto} />
          <Dato etiqueta="Monitoreos" valor={`${r.monitoreos.hidraulicos} hidráulico${r.monitoreos.hidraulicos === 1 ? '' : 's'} · ${r.monitoreos.quimicos} químico${r.monitoreos.quimicos === 1 ? '' : 's'}`} />
        </>
      ) : (
        <>
          <Dato etiqueta="Concesión" valor={p.concesion?.numero} />
          <Dato etiqueta="Titular" valor={p.concesion?.titular} />
        </>
      )}
      <Dato etiqueta="Profundidad" valor={p.profundidadM !== null ? `${formatoNumero(p.profundidadM)} m` : null} />
      <Dato etiqueta="Caudal" valor={p.caudalLps !== null ? `${formatoNumero(p.caudalLps, 2)} l/s` : null} />
      <Dato etiqueta="POSGAR 07 faja 3" valor={`X ${formatoNumero(p.coordX, 2)} · Y ${formatoNumero(p.coordY, 2)}${r?.sistemaCoordenada === 'POSGAR_FAJA3' ? ' (cargada)' : ''}`} />
      <Dato etiqueta="Latitud / longitud" valor={`${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}${r?.sistemaCoordenada === 'WGS84' ? ' (cargada)' : ''}`} />
      <Dato etiqueta="Jurisdicción DRH" valor={p.jurisdiccionDrh ? 'Sí' : 'No'} />
    </dl>
  )
}

/**
 * Pozos registrados, separados por cómo entraron al padrón: de oficio (sin autorización
 * previa), con autorización de perforación o del padrón anterior. Los de oficio llevan su
 * marca en todas las listas para diferenciarlos del resto. La solapa y la búsqueda quedan en
 * la URL (?origen=…&q=…).
 * PROTOTIPO: funciona con el backend emulado (npm run demo).
 */
export default function PozosRegistradosPage() {
  const [parametros, setParametros] = useSearchParams()
  const origenUrl = parametros.get('origen')
  const origen: OrigenPozo | null = origenUrl === 'TODOS' ? null : ((origenUrl as OrigenPozo | null) ?? 'OFICIO')
  const [texto, setTexto] = useState(parametros.get('q') ?? '')
  const q = useDemorado(texto.trim())
  const padron = usePadronPozos(origen, q)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    setParametros((p) => {
      const n = new URLSearchParams(p)
      if (q) n.set('q', q)
      else n.delete('q')
      return n
    }, { replace: true })
  }, [q, setParametros])

  const elegir = (o: OrigenPozo | null) => setParametros((p) => {
    const n = new URLSearchParams(p)
    n.set('origen', o ?? 'TODOS')
    return n
  })

  function tabla() {
    if (padron.isPending) return <LoadingState mensaje="Cargando el padrón de pozos…" className="py-10" />
    if (padron.isError) return <ErrorState error={padron.error} onRetry={() => void padron.refetch()} className="py-10" />
    const { pozos } = padron.data
    if (!pozos.length) {
      return (
        <EmptyState
          icon={q ? 'search_off' : 'water_pump'}
          titulo={q ? 'No se encontró ningún pozo' : origen === 'OFICIO' ? 'No hay pozos registrados de oficio' : 'No hay pozos con este origen'}
          descripcion={q ? 'Pruebe con menos palabras.' : origen === 'AUTORIZACION' ? 'Aparecen cuando se registre un pozo con autorización de perforación (trámite pendiente).' : undefined}
          className="py-10"
        />
      )
    }
    return (
      <div className={cn('overflow-x-auto', padron.isFetching && 'opacity-60')}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
            <tr>
              <th className="w-10" />
              <th className="px-3 py-3">Pozo</th>
              <th className="px-3 py-3">Origen</th>
              <th className="px-3 py-3">Registro / concesión</th>
              <th className="px-3 py-3">Causante / titular</th>
              <th className="px-3 py-3">Ubicación</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {pozos.map((p) => {
              const desplegado = abierto === p.id
              return (
                <Fragment key={p.id}>
                  <tr className={cn('align-top', p.origen === 'OFICIO' && 'bg-amber-50/50 dark:bg-amber-500/5')}>
                    <td className="px-2 py-2">
                      <IconButton icon={desplegado ? 'expand_less' : 'expand_more'} label={desplegado ? 'Ocultar detalle' : 'Ver detalle'} onClick={() => setAbierto(desplegado ? null : p.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{p.idInterno}</p>
                      {p.alias && <p className="text-xs text-slate-500">{p.alias}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <MarcaOrigen origen={p.origen} />
                      {p.registro && <p className="mt-1 text-xs text-slate-500">{p.registro.motivo.charAt(0) + p.registro.motivo.slice(1).toLowerCase()}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {p.registro && <p className="font-medium">{p.registro.expediente}</p>}
                      <p className={cn(p.registro && 'text-xs text-slate-500')}>{p.concesion?.numero ? `Concesión ${p.concesion.numero}` : 'Sin concesión'}</p>
                    </td>
                    <td className="px-3 py-3">{p.registro?.causante ?? p.concesion?.titular ?? '—'}</td>
                    <td className="px-3 py-3">
                      {[p.localidad, p.departamento].filter(Boolean).join(', ') || '—'}
                      {p.distrito && <p className="text-xs text-slate-500">Distrito {p.distrito}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', ESTADO_POZO[p.estado].color)}>{ESTADO_POZO[p.estado].texto}</span>
                    </td>
                  </tr>
                  {desplegado && (
                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                      <td />
                      <td colSpan={6} className="px-3 py-4">
                        <Detalle p={p} />
                        <div className="mt-3 flex flex-wrap gap-4">
                          <Link to={ROUTES.visor} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="map" className="text-[18px]!" /> Ver en el visor
                          </Link>
                          <Link to={ROUTES.pozo.monitoreos(p.id)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="monitoring" className="text-[18px]!" /> Monitoreos
                          </Link>
                          {p.registro && (
                            <Link to={ROUTES.pozo.registroExpediente(p.registro.expedienteId)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                              <Icon name="folder_open" className="text-[18px]!" /> Ver el expediente
                            </Link>
                          )}
                          <Link to={ROUTES.pozo.bajaPozo(p.id)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <Icon name="water_pump" className="text-[18px]!" /> Ficha del pozo
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const totales = padron.data?.totales
  return (
    <>
      <PageHeader
        title="Pozos registrados"
        description="Padrón de pozos separado por cómo se registraron: de oficio, con autorización de perforación o del padrón anterior."
        actions={
          <Link to={ROUTES.pozo.registro}>
            <Button iconLeft="add">Registrar pozo</Button>
          </Link>
        }
      />
      {!MODO_DEMO && (
        <div className="mb-4">
          <Alert tone="info">Pantalla de prototipo: el padrón de pozos por origen todavía no está en el backend. Para probarla, use el modo demo (npm run demo).</Alert>
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {SOLAPAS.map((s) => {
              const activa = s.origen === origen
              const n = totales?.[s.origen ?? 'TODOS']
              return (
                <button
                  key={s.texto}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => elegir(s.origen)}
                  className={cn('flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold', activa ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
                >
                  {s.origen && <Icon name={ORIGEN_POZO[s.origen].icono} className="text-[18px]!" />}
                  {s.texto}
                  {n !== undefined && <span className={cn('rounded-full px-1.5 text-xs', activa ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800')}>{n}</span>}
                </button>
              )
            })}
          </div>
          <div className="relative w-full py-2 sm:w-80">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl! text-slate-400" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="ID, registro, causante, CUIT, localidad…"
              aria-label="Buscar pozos"
              className={controlClass({ iconLeft: true, className: 'py-2' })}
            />
          </div>
        </div>
        {tabla()}
      </Card>
    </>
  )
}
