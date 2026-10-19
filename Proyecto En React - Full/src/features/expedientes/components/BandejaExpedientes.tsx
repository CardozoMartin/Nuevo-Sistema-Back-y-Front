import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useSesion } from '@/features/auth/context'
import { useDominio } from '@/hooks/useDominio'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import type { EstadoExpedienteBackend, ExpedienteEnBandeja, OficinaBackend, PlazoEnOficina } from '@/features/tramites/AltaDeConcesion/backend.types'
import { useBandeja, useTomarDeBandeja } from '@/features/tramites/AltaDeConcesion/hooks'

/** Pantalla de trabajo de cada trámite que ya circula en el backend real. */
const RUTA_TRABAJO: Record<string, (id: string) => string> = {
  ALTA_CONCESION: ROUTES.tramites.altaConcesion.circuito,
  BAJA_POZO: ROUTES.pozo.baja,
}

const ESTADO: Partial<Record<EstadoExpedienteBackend, { texto: string; color: string }>> = {
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  EN_ESPERA: { texto: 'En espera', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

/** En Recaudación, «en espera» es el «No apto» por deuda: queda pausado hasta que se pague. */
const etiquetaEstado = (e: ExpedienteEnBandeja) =>
  e.estado === 'EN_ESPERA' && e.etapa === 'RECAUDACION' ? { texto: 'No apto · pendiente de pago', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' } : ESTADO[e.estado]

const formatear = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`

const COLOR_PLAZO: Record<PlazoEnOficina['semaforo'], string> = {
  VENCIDO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  POR_VENCER: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EN_PLAZO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function textoPlazo({ restantes }: PlazoEnOficina) {
  if (restantes < 0) return `Vencido hace ${plural(-restantes, 'día')}`
  if (restantes === 0) return 'Vence hoy'
  if (restantes === 1) return 'Vence mañana'
  return `Quedan ${plural(restantes, 'día')}`
}

function Plazo({ plazo }: { plazo: PlazoEnOficina }) {
  const [anio, mes, dia] = plazo.vence.split('-')
  return (
    <span title={`Plazo: ${plural(plazo.dias, 'día')} en la oficina · vence el ${dia}/${mes}/${anio}`} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', COLOR_PLAZO[plazo.semaforo])}>
      {plazo.semaforo !== 'EN_PLAZO' && <Icon name={plazo.semaforo === 'VENCIDO' ? 'error' : 'schedule'} className="text-[14px]!" />}
      {textoPlazo(plazo)}
    </span>
  )
}

/** Aviso arriba de la bandeja: cuántos expedientes tienen el plazo vencido o por vencer. */
function AvisoPlazos({ expedientes }: { expedientes: ExpedienteEnBandeja[] }) {
  const vencidos = expedientes.filter((e) => e.plazo?.semaforo === 'VENCIDO').length
  const porVencer = expedientes.filter((e) => e.plazo?.semaforo === 'POR_VENCER').length
  if (!vencidos && !porVencer) return null
  const partes = [vencidos && `${plural(vencidos, 'expediente')} con el plazo vencido`, porVencer && `${plural(porVencer, 'expediente')} por vencer`].filter(Boolean)
  return (
    <div
      role="alert"
      className={cn(
        'mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm',
        vencidos
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      )}
    >
      <Icon name={vencidos ? 'notification_important' : 'schedule'} className="shrink-0" />
      <p>
        <span className="font-semibold">{partes.join(' y ')}.</span> Están primero en la bandeja.
      </p>
    </div>
  )
}

type Grupo = 'sin-revisar' | 'pendientes'

function Tabla({ grupo, expedientes }: { grupo: Grupo; expedientes: ExpedienteEnBandeja[] }) {
  const navigate = useNavigate()
  const d = useDominio()
  const tomar = useTomarDeBandeja()
  const nombreTramite = (codigo: string) => d.tramites.find((t) => t.codigo === codigo)?.nombre ?? codigo
  const conPlazo = expedientes.some((e) => e.plazo)
  const conDistrito = expedientes.some((e) => e.distrito !== undefined)

  return (
    <>
      {tomar.isError && <Alert className="m-4">{mensajeDeError(tomar.error)}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Expediente</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Trámite</th>
              {conDistrito && <th className="px-4 py-3">Distrito</th>}
              <th className="px-4 py-3">Viene de</th>
              <th className="px-4 py-3">Llegó</th>
              {conPlazo && <th className="px-4 py-3">Plazo</th>}
              {grupo === 'pendientes' && <th className="px-4 py-3">Lo tiene</th>}
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {expedientes.map((e) => {
              const ruta = RUTA_TRABAJO[e.tipoTramite]?.(e.id)
              return (
                <tr key={e.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40', e.plazo?.semaforo === 'VENCIDO' && 'bg-red-50/60 dark:bg-red-500/5')}>
                  <td className="px-4 py-3">
                    <span className="font-semibold whitespace-nowrap text-slate-900 tabular-nums dark:text-white">{e.numero}</span>
                    {etiquetaEstado(e) && <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', etiquetaEstado(e)!.color)}>{etiquetaEstado(e)!.texto}</span>}
                    {e.cursoConDeuda && (
                      <span title="Recaudación le dio curso sin cobrar la deuda: la nota está en el expediente." className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        <Icon name="warning" className="text-[14px]!" />
                        Con deuda
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{e.titular ?? <span className="text-slate-400">Sin titular cargado</span>}</td>
                  <td className="px-4 py-3">
                    {nombreTramite(e.tipoTramite)}
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{e.etapaNombre}</span>
                  </td>
                  {conDistrito && <td className="px-4 py-3 whitespace-nowrap">{e.distrito ?? <span className="text-slate-400">Sin ubicación</span>}</td>}
                  <td className="px-4 py-3">
                    {e.vieneDeNombre ? (
                      <>
                        {e.vieneDeNombre}
                        {e.esDevolucion && <span className="block text-xs font-semibold text-amber-600">devuelto para corregir</span>}
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">Se inició acá</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {e.enLaOficinaDesde ? (
                      <span title={formatear(e.enLaOficinaDesde)}>{haceCuanto(e.enLaOficinaDesde)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {conPlazo && <td className="px-4 py-3">{e.plazo ? <Plazo plazo={e.plazo} /> : <span className="text-slate-400">—</span>}</td>}
                  {grupo === 'pendientes' && <td className="px-4 py-3">{e.tomadoPor}</td>}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!ruta ? (
                      <span className="text-xs text-slate-400">Sin pantalla aún</span>
                    ) : grupo === 'sin-revisar' ? (
                      <Button size="sm" iconLeft="pan_tool" loading={tomar.isPending && tomar.variables === e.id} disabled={tomar.isPending} onClick={() => tomar.mutate(e.id, { onSuccess: () => navigate(ruta) })}>
                        Tomar
                      </Button>
                    ) : (
                      <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ruta)}>
                        Abrir
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Seccion({ grupo, titulo, descripcion, icono, expedientes, vacio }: { grupo: Grupo; titulo: string; descripcion: string; icono: string; expedientes: ExpedienteEnBandeja[]; vacio: string }) {
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name={icono} className="text-[18px]!" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            {titulo}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{expedientes.length}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
        </div>
      </div>
      {expedientes.length ? <Tabla grupo={grupo} expedientes={expedientes} /> : <EmptyState icon="inbox" titulo={vacio} className="py-8" />}
    </Card>
  )
}

/**
 * Bandeja de la oficina (backend real): los expedientes que están en ella, de cualquier trámite,
 * divididos en los que todavía nadie revisó (sin tomar: se toman desde acá) y los pendientes
 * (ya los tiene alguien de la oficina y siguen acá).
 */
export function BandejaExpedientes({ oficina }: { oficina: OficinaBackend }) {
  const bandeja = useBandeja(oficina)
  const { usuario } = useSesion()

  if (bandeja.isPending) return <LoadingState mensaje="Cargando la bandeja…" className="py-10" />
  if (bandeja.isError) return <ErrorState error={bandeja.error} onRetry={() => void bandeja.refetch()} reintentando={bandeja.isFetching} className="mb-6" />

  const sinRevisar = bandeja.data.filter((e) => !e.tomadoPor)
  const pendientes = bandeja.data.filter((e) => e.tomadoPor)
  return (
    <>
      {oficina === 'distrito' && usuario?.distrito && !usuario.esAdministrador && (
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Icon name="location_on" className="text-[18px]! text-primary" />
          Expedientes del <strong>{usuario.distrito.nombre}</strong> (y los que todavía no tienen ubicación cargada).
        </p>
      )}
      <AvisoPlazos expedientes={bandeja.data} />
      <Seccion grupo="sin-revisar" titulo="Sin revisar" descripcion="Llegaron a la oficina y nadie los tomó todavía." icono="move_to_inbox" expedientes={sinRevisar} vacio="No hay expedientes sin revisar" />
      <Seccion grupo="pendientes" titulo="Pendientes" descripcion="Ya los tomó alguien de la oficina y siguen acá." icono="assignment_ind" expedientes={pendientes} vacio="No hay expedientes pendientes" />
    </>
  )
}
