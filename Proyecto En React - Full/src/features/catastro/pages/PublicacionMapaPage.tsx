import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { usePuede } from '@/features/auth/components/RutaDeOficina'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { ESTADOS_PUBLICACION, useAccionPublicacion, usePoligonosParaPublicar, type EstadoPublicacion, type PoligonoParaPublicar } from '../publicacionMapa'

const formatoHa = (ha: number) => `${ha.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`
const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR')

type Accion = { tipo: 'publicar' | 'observar'; poligono: PoligonoParaPublicar }

/** Publicar (nota optativa) u observar / retirar del mapa (nota obligatoria). */
function DialogoAccion({ accion, onCerrar }: { accion: Accion | null; onCerrar: () => void }) {
  const { publicar, observar } = useAccionPublicacion()
  const [nota, setNota] = useState('')
  const mutacion = accion?.tipo === 'publicar' ? publicar : observar
  const p = accion?.poligono
  const retirar = accion?.tipo === 'observar' && p?.publicacion === 'PUBLICADO'
  const notaValida = accion?.tipo === 'publicar' || nota.trim().length >= 5

  function cerrar() {
    setNota('')
    publicar.reset()
    observar.reset()
    onCerrar()
  }

  function confirmar() {
    if (!accion) return
    const datos = { poligonoId: accion.poligono.poligonoId, observaciones: nota.trim() }
    const opciones = { onSuccess: cerrar }
    if (accion.tipo === 'publicar') publicar.mutate(datos, opciones)
    else observar.mutate(datos, opciones)
  }

  return (
    <Modal
      open={!!accion}
      onClose={cerrar}
      bloqueado={mutacion.isPending}
      size="md"
      icon={accion?.tipo === 'publicar' ? 'public' : 'report'}
      title={accion?.tipo === 'publicar' ? 'Publicar en el mapa' : retirar ? 'Retirar del mapa público' : 'Observar el polígono'}
      description={p ? `${p.numero ? `Concesión ${p.numero}` : `Exp. ${p.expediente}`} · ${p.titular ?? ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={cerrar} disabled={mutacion.isPending}>
            Cancelar
          </Button>
          <Button
            variant={accion?.tipo === 'publicar' ? 'primary' : 'danger'}
            iconLeft={accion?.tipo === 'publicar' ? 'public' : 'report'}
            loading={mutacion.isPending}
            disabled={!notaValida}
            onClick={confirmar}
          >
            {accion?.tipo === 'publicar' ? 'Publicar' : retirar ? 'Retirar' : 'Observar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {accion?.tipo === 'publicar'
            ? 'Verificó que el polígono coincide con la resolución: desde ahora se ve en Argenmap, fuera de la repartición.'
            : retirar
              ? 'Deja de verse en Argenmap. Catastro va a ver la nota y puede subir el KML corregido.'
              : 'No se publica. Catastro va a ver la nota y puede subir el KML corregido; después vuelve a quedar para publicar.'}
        </p>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {accion?.tipo === 'publicar' ? 'Nota (optativa)' : 'Qué hay que corregir'}
          <textarea rows={3} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} className={controlClass({})} />
        </label>
        {mutacion.isError && <Alert>{mensajeDeError(mutacion.error)}</Alert>}
      </div>
    </Modal>
  )
}

/** Catastro sube el KML corregido de un polígono observado. */
function ReemplazarKml({ poligono }: { poligono: PoligonoParaPublicar }) {
  const { reemplazar } = useAccionPublicacion()
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept=".kml,.geojson,.json"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) reemplazar.mutate({ poligonoId: poligono.poligonoId, archivo })
        }}
      />
      <Button size="sm" variant="secondary" iconLeft="upload_file" loading={reemplazar.isPending} onClick={() => entrada.current?.click()}>
        Subir KML corregido
      </Button>
      {reemplazar.isError && <Alert className="basis-full">{mensajeDeError(reemplazar.error)}</Alert>}
      {reemplazar.isSuccess && reemplazar.data.avisos.length > 0 && (
        <Alert tone="info" className="basis-full">
          {reemplazar.data.avisos.join(' ')}
        </Alert>
      )}
    </>
  )
}

function Fila({ p, onAccion }: { p: PoligonoParaPublicar; onAccion: (a: Accion) => void }) {
  const puede = usePuede()
  const estado = ESTADOS_PUBLICACION[p.publicacion]
  return (
    <li className="flex flex-col gap-3 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
            {p.numero ? `Concesión ${p.numero}` : `Alta en trámite · Exp. ${p.expediente}`}
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clases)}>{estado.nombre}</span>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {[p.titular, p.departamento, p.distrito && `Distrito ${p.distrito}`, formatoHa(p.superficieHa)].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {p.resolucion ? (
              <>
                <Icon name="gavel" className="mr-1 align-middle text-[14px]!" />
                Resolución {p.resolucion}
                {p.resolucionFecha && ` del ${formatoFecha(p.resolucionFecha)}`}
              </>
            ) : (
              'Sin resolución todavía: se puede publicar cuando pase por Recaudación, Distrito, Jurídico y Secretaría General.'
            )}
            {p.usuario && p.fecha && ` · ${p.publicacion === 'PUBLICADO' ? 'Publicó' : 'Observó'} ${p.usuario} el ${formatoFecha(p.fecha)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={ROUTES.visorConcesion(p.concesionId)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
            <Icon name="map" className="text-[16px]!" />
            Ver en el visor
          </Link>
          {p.expedienteId && (
            <Link
              to={ROUTES.tramites.altaConcesion.circuito(p.expedienteId)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Icon name="folder_open" className="text-[16px]!" />
              Expediente
            </Link>
          )}
        </div>
      </div>

      {p.publicacion === 'OBSERVADO' && p.nota && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span className="font-semibold">Observación: </span>
          {p.nota}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {puede('MAPA_PUBLICAR') && p.publicacion !== 'PUBLICADO' && (
          <Button size="sm" iconLeft="public" disabled={!p.listoParaPublicar} onClick={() => onAccion({ tipo: 'publicar', poligono: p })}>
            Publicar en el mapa
          </Button>
        )}
        {puede('MAPA_PUBLICAR') && p.publicacion !== 'OBSERVADO' && (
          <Button size="sm" variant="secondary" iconLeft="report" onClick={() => onAccion({ tipo: 'observar', poligono: p })}>
            {p.publicacion === 'PUBLICADO' ? 'Retirar del mapa' : 'Observar'}
          </Button>
        )}
        {p.publicacion === 'OBSERVADO' && puede('KML_CARGAR') && <ReemplazarKml poligono={p} />}
      </div>
    </li>
  )
}

const VISTAS: { id: EstadoPublicacion | undefined; nombre: string }[] = [
  { id: undefined, nombre: 'Por revisar' },
  { id: 'PUBLICADO', nombre: 'Publicadas' },
]

/**
 * Concesiones para publicar en el mapa público (Argenmap). Adentro de la DRH se ven siempre en el
 * visor; afuera, recién cuando alguien con el permiso «Publicar en el mapa» verifica el polígono
 * de una concesión con resolución.
 */
export default function PublicacionMapaPage() {
  const [vista, setVista] = useState<EstadoPublicacion | undefined>(undefined)
  const [accion, setAccion] = useState<Accion | null>(null)
  const lista = usePoligonosParaPublicar(vista)

  function contenido() {
    if (lista.isPending) return <LoadingState mensaje="Cargando concesiones…" />
    if (lista.isError) return <ErrorState error={lista.error} onRetry={() => void lista.refetch()} reintentando={lista.isFetching} className="m-6" />
    if (lista.data.length === 0) {
      return (
        <EmptyState
          icon="public"
          titulo={vista ? 'No hay concesiones publicadas desde el sistema' : 'No hay concesiones para revisar'}
          descripcion={vista ? 'Las que se publiquen acá van a aparecer en esta lista.' : 'Las altas con polígono cargado aparecen acá hasta que se publiquen.'}
          className="m-6"
        />
      )
    }
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {lista.data.map((p) => (
          <Fila key={p.poligonoId} p={p} onAccion={setAccion} />
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        title="Publicación en el mapa"
        description="Una concesión se ve en Argenmap recién cuando tiene resolución y alguien con el permiso «Publicar en el mapa» verifica su polígono. Mientras tanto la ven solo los usuarios internos, en el visor."
      />
      <Card>
        <div className="flex gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
          {VISTAS.map((v) => (
            <button
              key={v.nombre}
              type="button"
              onClick={() => setVista(v.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                vista === v.id ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
              )}
            >
              {v.nombre}
            </button>
          ))}
        </div>
        {contenido()}
      </Card>
      <DialogoAccion accion={accion} onCerrar={() => setAccion(null)} />
    </>
  )
}
