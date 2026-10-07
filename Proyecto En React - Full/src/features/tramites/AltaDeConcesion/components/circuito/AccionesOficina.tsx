import { useState, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { useUsuarioActualId } from '@/services/sesion'
import { altaConcesionApi, type ResultadoDictamen } from '../../api'
import type { AltaBackend } from '../../backend.types'
import { altaKeys, useAccionAlta, useCancelarDeuda, useTomar } from '../../hooks'

const hoy = () => new Date().toISOString().slice(0, 10)

// Campo, Observaciones y Opciones se exportan: los usan también otros circuitos (ej: baja de pozo).
export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-slate-500 dark:text-slate-400">{ayuda}</span>}
    </label>
  )
}

export function Observaciones({ valor, onChange, obligatorio, placeholder }: { valor: string; onChange: (v: string) => void; obligatorio?: boolean; placeholder?: string }) {
  return (
    <Campo etiqueta={obligatorio ? 'Observaciones (obligatorio)' : 'Observaciones'}>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={controlClass({ className: 'resize-y' })} />
    </Campo>
  )
}

/** Opciones tipo tarjeta (apto / observado / no apto, sin deuda / con deuda). */
export function Opciones<T extends string>({ valor, onChange, opciones }: { valor: T | ''; onChange: (v: T) => void; opciones: { valor: T; texto: string; icono: string; color: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={cn(
            'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
            valor === o.valor ? o.color : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
          )}
        >
          <Icon name={o.icono} className="text-[20px]!" />
          {o.texto}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recaudación
// ---------------------------------------------------------------------------

function AccionRecaudacion({ alta }: { alta: AltaBackend }) {
  const [resultado, setResultado] = useState<'SIN_DEUDA' | 'CON_DEUDA' | ''>('')
  const [deuda, setDeuda] = useState({ personaId: alta.titulares[0]?.personaId ?? '', detalle: '', monto: '' })
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, altaConcesionApi.recaudacion)

  function enviar() {
    accion.mutate({
      resultado: resultado as 'SIN_DEUDA' | 'CON_DEUDA',
      deudas: resultado === 'CON_DEUDA' && deuda.detalle ? [{ personaId: deuda.personaId, detalle: deuda.detalle, monto: deuda.monto ? Number(deuda.monto) : undefined }] : undefined,
      observaciones: observaciones || undefined,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">¿Alguno de los titulares tiene deuda con la DRH?</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'SIN_DEUDA', texto: 'Sin deuda', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'CON_DEUDA', texto: 'Con deuda', icono: 'payments', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
        ]}
      />
      {resultado === 'CON_DEUDA' && (
        <div className="grid gap-3 rounded-lg bg-amber-50/60 p-3 sm:grid-cols-3 dark:bg-amber-500/5">
          <Campo etiqueta="Titular que debe">
            <select value={deuda.personaId} onChange={(e) => setDeuda({ ...deuda, personaId: e.target.value })} className={controlClass({})}>
              {alta.titulares.map((t) => (
                <option key={t.personaId} value={t.personaId}>
                  {t.tipoPersona === 'JURIDICA' ? t.razonSocial : `${t.apellido}, ${t.nombre}`}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Qué debe">
            <input value={deuda.detalle} onChange={(e) => setDeuda({ ...deuda, detalle: e.target.value })} placeholder="Ej: canon 2025 impago" className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Monto ($)">
            <input type="number" min={0} value={deuda.monto} onChange={(e) => setDeuda({ ...deuda, monto: e.target.value })} className={controlClass({})} />
          </Campo>
          <p className="text-xs text-amber-800 sm:col-span-3 dark:text-amber-300">
            El expediente queda en espera en Recaudación hasta que se registre el pago. La deuda queda a nombre del titular.
          </p>
        </div>
      )}
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="send" disabled={!resultado || (resultado === 'CON_DEUDA' && !deuda.detalle)} loading={accion.isPending} onClick={enviar}>
          {resultado === 'CON_DEUDA' ? 'Registrar deuda y pausar' : 'Sin deuda: pasar a Distrito'}
        </Button>
      </div>
    </div>
  )
}

/** Expediente en espera por deuda: las deudas pendientes de los titulares, para registrar el pago. */
function DeudasPendientes({ alta }: { alta: AltaBackend }) {
  const consultas = useQueries({
    queries: alta.titulares.map((t) => ({ queryKey: altaKeys.deudas(t.personaId), queryFn: () => altaConcesionApi.deudas(t.personaId) })),
  })
  const pendientes = consultas.flatMap((c) => c.data ?? []).filter((d) => d.estado === 'PENDIENTE')
  const cancelar = useCancelarDeuda(alta.id)
  const [comprobante, setComprobante] = useState<Record<string, string>>({})

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info">El expediente está en espera: se reanuda solo cuando ningún titular tiene deudas pendientes.</Alert>
      {pendientes.map((d) => (
        <div key={d.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.persona.nombre}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {d.detalle}
              {d.monto !== null && ` · $ ${d.monto.toLocaleString('es-AR')}`}
            </p>
          </div>
          <input
            placeholder="N° de recibo / comprobante"
            value={comprobante[d.id] ?? ''}
            onChange={(e) => setComprobante({ ...comprobante, [d.id]: e.target.value })}
            className={controlClass({ className: 'w-56 py-2' })}
          />
          <Button size="sm" iconLeft="paid" loading={cancelar.isPending && cancelar.variables?.deudaId === d.id} onClick={() => cancelar.mutate({ deudaId: d.id, comprobante: comprobante[d.id] || undefined })}>
            Registrar pago
          </Button>
        </div>
      ))}
      {!pendientes.length && consultas.every((c) => c.isSuccess) && <p className="text-sm text-slate-500">No quedan deudas pendientes.</p>}
      {cancelar.error && <Alert>{mensajeDeError(cancelar.error)}</Alert>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Distrito y Jurídico
// ---------------------------------------------------------------------------

function AccionDictamen({ alta, oficina }: { alta: AltaBackend; oficina: 'distrito' | 'juridico' }) {
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionAlta(alta.id, (id, dto: { resultado: ResultadoDictamen; observaciones?: string }) => altaConcesionApi.dictaminar(id, oficina, dto))
  const siguiente = oficina === 'distrito' ? 'Jurídico' : 'Secretaría General'
  const pregunta =
    oficina === 'distrito' ? '¿Hay agua disponible y la concesión es viable técnicamente?' : '¿La documentación y los aspectos legales están en regla?'

  const enviar = () => accion.mutate({ resultado: resultado as ResultadoDictamen, observaciones: observaciones || undefined })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{pregunta}</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'APTO', texto: 'Apto', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'OBSERVADO', texto: 'Observado (corregir)', icono: 'edit_note', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
          { valor: 'NO_APTO', texto: 'No apto', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />
      <Observaciones
        valor={observaciones}
        onChange={setObservaciones}
        obligatorio={resultado === 'OBSERVADO' || resultado === 'NO_APTO'}
        placeholder={resultado === 'OBSERVADO' ? 'Qué tiene que corregir Catastro' : resultado === 'NO_APTO' ? 'Motivo por el que no es apto' : undefined}
      />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button
          iconRight="send"
          disabled={!resultado || (resultado !== 'APTO' && !observaciones.trim())}
          loading={accion.isPending}
          onClick={() => (resultado === 'NO_APTO' ? setConfirmar(true) : enviar())}
        >
          {resultado === 'APTO' ? `Apto: pasar a ${siguiente}` : resultado === 'OBSERVADO' ? 'Devolver a Catastro' : resultado === 'NO_APTO' ? 'Dictaminar no apto' : 'Registrar'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Dictaminar no apto?"
        message="El trámite termina: el expediente queda rechazado y la concesión no se otorga. No se puede deshacer."
        confirmLabel="Sí, no apto"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          enviar()
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Secretaría General
// ---------------------------------------------------------------------------

function AccionSecretaria({ alta }: { alta: AltaBackend }) {
  const numero = useAccionAlta(alta.id, (id, _: void) => altaConcesionApi.numeroConcesion(id))
  const resolucion = useAccionAlta(alta.id, altaConcesionApi.resolucion)
  const [datos, setDatos] = useState({ numero: '', anio: String(new Date().getFullYear()), fecha: hoy(), observaciones: '' })
  const asignado = alta.concesion.numero

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">1. Número de concesión</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{asignado ? 'Asignado. Va en la resolución.' : 'Se asigna el siguiente número libre (correlativo).'}</p>
        </div>
        {asignado ? (
          <span className="rounded-lg bg-green-50 px-4 py-2 text-lg font-bold text-green-700 dark:bg-green-500/10 dark:text-green-300">N° {asignado}</span>
        ) : (
          <Button iconLeft="pin" loading={numero.isPending} onClick={() => numero.mutate()}>
            Solicitar número
          </Button>
        )}
      </div>
      {numero.error && <Alert>{mensajeDeError(numero.error)}</Alert>}

      <div className={cn('flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700', !asignado && 'opacity-50')}>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">2. Resolución que otorga la concesión</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Número">
            <input value={datos.numero} disabled={!asignado} onChange={(e) => setDatos({ ...datos, numero: e.target.value.replace(/\D/g, '') })} className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Año">
            <input value={datos.anio} disabled={!asignado} onChange={(e) => setDatos({ ...datos, anio: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Fecha">
            <input type="date" value={datos.fecha} disabled={!asignado} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className={controlClass({})} />
          </Campo>
        </div>
        <Observaciones valor={datos.observaciones} onChange={(v) => setDatos({ ...datos, observaciones: v })} />
        {resolucion.error && <Alert>{mensajeDeError(resolucion.error)}</Alert>}
        <div>
          <Button
            iconRight="send"
            disabled={!asignado || !datos.numero || datos.anio.length !== 4 || !datos.fecha}
            loading={resolucion.isPending}
            onClick={() => resolucion.mutate({ numero: datos.numero, anio: Number(datos.anio), fecha: datos.fecha, observaciones: datos.observaciones || undefined })}
          >
            Registrar resolución y pasar a Catastro
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catastro: cierre
// ---------------------------------------------------------------------------

function AccionCierre({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, (id, obs: string | undefined) => altaConcesionApi.verificacionFinal(id, obs))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Resolución {alta.concesion.resolucion?.numero}/{alta.concesion.resolucion?.anio} · Concesión N° {alta.concesion.numero}. Complete los datos que falten y haga la verificación final: después el trámite queda esperando el padrón de Rentas.
      </p>
      <div>
        <Button variant="secondary" iconLeft="edit" onClick={() => navigate(ROUTES.tramites.altaConcesion.datos(alta.id))}>
          Completar o revisar datos
        </Button>
      </div>
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="task_alt" loading={accion.isPending} onClick={() => accion.mutate(observaciones || undefined)}>
          Verificación final: esperar padrón
        </Button>
      </div>
    </div>
  )
}

function AccionPadron({ alta }: { alta: AltaBackend }) {
  const [padron, setPadron] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, altaConcesionApi.padron)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Cuando Rentas informe el número de padrón (suele demorar 30 a 60 días), cárguelo para finalizar el trámite. La concesión queda vigente.
      </p>
      <Campo etiqueta="Número de padrón de Rentas">
        <input value={padron} onChange={(e) => setPadron(e.target.value)} className={controlClass({ className: 'max-w-xs' })} />
      </Campo>
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="verified" disabled={!padron.trim()} loading={accion.isPending} onClick={() => accion.mutate({ padron: padron.trim(), observaciones: observaciones || undefined })}>
          Cargar padrón y finalizar
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Lo que puede hacer la oficina donde está el expediente:
 *   1. Si nadie lo tomó: «Tomar» (queda registrado quién y cuándo).
 *   2. Si lo tiene el usuario actual: el formulario de la etapa.
 *   3. Si lo tiene otra persona: quién.
 * El backend valida todo igual (oficina, etapa, tomado); acá solo se guía al usuario.
 */
export function AccionesOficina({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const usuarioId = useUsuarioActualId()
  const tomar = useTomar(alta.id)
  const { circuito } = alta

  if (circuito.estado === 'FINALIZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-500/10 dark:text-green-300">
        <Icon name="verified" filled className="text-[28px]!" />
        <div>
          <p className="font-bold">Trámite finalizado: concesión N° {alta.concesion.numero} vigente.</p>
          <p className="text-sm">
            Resolución {alta.concesion.resolucion?.numero}/{alta.concesion.resolucion?.anio} · Padrón {alta.inmueble?.catastral.padron}
          </p>
        </div>
      </div>
    )
  }
  if (circuito.estado === 'RECHAZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <Icon name="block" className="text-[28px]!" />
        <div>
          <p className="font-bold">Trámite rechazado: la concesión no se otorgó.</p>
          <p className="text-sm">El motivo está en el historial.</p>
        </div>
      </div>
    )
  }

  // Paso 1: tomar el expediente.
  if (!circuito.tomadoPor) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          El expediente llegó a <strong>{circuito.oficinaNombre}</strong>. Para trabajarlo, alguien de la oficina tiene que tomarlo: queda registrado en el historial quién lo recibió y cuándo.
        </p>
        {tomar.error && <Alert>{mensajeDeError(tomar.error)}</Alert>}
        <div>
          <Button iconLeft="back_hand" loading={tomar.isPending} onClick={() => tomar.mutate()}>
            Tomar expediente
          </Button>
        </div>
      </div>
    )
  }
  // Lo tiene otra persona (el administrador «Sistema» puede actuar igual: lo controla el backend).
  if (circuito.tomadoPor.id !== usuarioId && usuarioId !== '1') {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Icon name="person" className="text-[18px]!" />
        Lo está trabajando <strong>{circuito.tomadoPor.nombre}</strong> ({circuito.oficinaNombre}).
      </p>
    )
  }

  switch (circuito.etapa) {
    case 'CARGA':
    case 'CORRECCION':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {circuito.etapa === 'CARGA' ? 'Catastro está cargando los datos del expediente.' : 'Distrito o Jurídico observaron el expediente: hay que corregirlo y reenviarlo.'}
          </p>
          <div>
            <Button iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.altaConcesion.datos(alta.id))}>
              {circuito.etapa === 'CARGA' ? 'Continuar la carga' : 'Corregir y reenviar'}
            </Button>
          </div>
        </div>
      )
    case 'RECAUDACION':
      return circuito.estado === 'EN_ESPERA' ? <DeudasPendientes alta={alta} /> : <AccionRecaudacion alta={alta} />
    case 'DISTRITO':
      return <AccionDictamen alta={alta} oficina="distrito" />
    case 'JURIDICO':
      return <AccionDictamen alta={alta} oficina="juridico" />
    case 'SECRETARIA_GENERAL':
      return <AccionSecretaria alta={alta} />
    case 'CIERRE':
      return <AccionCierre alta={alta} />
    case 'ESPERA_PADRON':
      return <AccionPadron alta={alta} />
  }
}
