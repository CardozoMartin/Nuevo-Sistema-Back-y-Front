import { useEffect, type ReactNode } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormMaskedField, FormSelectField, FormTextareaField, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { useCatalogoSuministro } from '@/hooks/useCatalogos'
import { decimalPositivo } from '@/lib/mascaras'
import { getDatosSuministro, NIVELES_CANAL_ADICIONAL, opcionesCanalSiguiente, type UbicacionSeleccionada } from '../suministro'

interface Props {
  prefix: string
  /** Ubicación del inmueble: define qué fuentes, sistemas y canales se ofrecen. */
  ubicacion: UbicacionSeleccionada
}

function Aviso({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Icon name={icon} className="shrink-0" />
      <p>{children}</p>
    </div>
  )
}

/** Fuente de agua, sistema de distribución y canales en cascada según el catálogo de riego. */
export function SuministroFields({ prefix, ubicacion }: Props) {
  const n = (campo: string) => `${prefix}.${campo}`
  const { control, setValue, getValues } = useFormContext()
  const { catalogo, cargando, error } = useCatalogoSuministro()
  const fuentes = useFieldArray({ control, name: n('fuentes') })
  const canales = useFieldArray({ control, name: n('canalesAdicionales') })

  const [principal, secundario, adicionales] = useWatch({
    control,
    name: [n('canalPrincipal'), n('canalSecundario'), n('canalesAdicionales')],
  }) as [string, string, { valor: string }[] | undefined]
  const valoresAdicionales = (adicionales ?? []).map((c) => c.valor)

  const datos = getDatosSuministro(catalogo, ubicacion)
  const opcionesFuente = toOptions(datos?.fuentesAgua ?? [])
  const opcionesSistema = toOptions(datos?.sistemasDistribucion ?? [])
  const opcionesPrincipal = toOptions(Object.keys(datos?.canalesPrincipales ?? {}))
  const opcionesSecundario = toOptions((principal && datos?.canalesPrincipales[principal]) || [])
  const opcionesDesague = toOptions(datos?.desagues ?? [])

  const opcionesAdicional = (i: number) => opcionesCanalSiguiente(datos, principal, secundario, valoresAdicionales.slice(0, i))
  const ultimoElegido = valoresAdicionales.length === 0 ? secundario : valoresAdicionales.at(-1)
  const puedeAgregarCanal =
    canales.fields.length < NIVELES_CANAL_ADICIONAL.length && !!ultimoElegido && opcionesAdicional(valoresAdicionales.length).length > 0

  // Con una sola opción disponible se selecciona sola (igual que el prototipo).
  useEffect(() => {
    if (!datos) return
    const autocompletar = (campo: string, opciones: string[]) => {
      if (opciones.length === 1 && !getValues(n(campo))) setValue(n(campo), opciones[0], { shouldDirty: true })
    }
    autocompletar('fuentes.0.valor', datos.fuentesAgua)
    autocompletar('sistemaDistribucion', datos.sistemasDistribucion)
    autocompletar('canalPrincipal', Object.keys(datos.canalesPrincipales))
    autocompletar('desague', datos.desagues)
  }, [datos]) // solo al cambiar la ubicación / catálogo

  function limpiarCanalesDesde(indice: number) {
    const aQuitar = canales.fields.map((_, i) => i).filter((i) => i >= indice)
    if (aQuitar.length) canales.remove(aQuitar)
  }

  function agregarCanal() {
    const opciones = opcionesAdicional(canales.fields.length)
    canales.append({ valor: opciones.length === 1 ? opciones[0] : '' })
  }

  const ubicacionCompleta = !!(ubicacion.departamento && ubicacion.localidad && ubicacion.distrito)

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {error && <Aviso icon="error">No se pudo cargar el catálogo de suministro de riego.</Aviso>}
      {!error && cargando && <p className="text-sm text-slate-500 md:col-span-2">Cargando catálogo de suministro…</p>}
      {!error && !cargando && !ubicacionCompleta && (
        <Aviso icon="info">Complete la ubicación del inmueble (sección 2) para ver las fuentes y canales disponibles.</Aviso>
      )}
      {!error && !cargando && ubicacionCompleta && !datos && (
        <Aviso icon="warning">
          No hay datos de suministro cargados para {ubicacion.localidad} ({ubicacion.departamento}), distrito {ubicacion.distrito}. Puede
          completar la observación y el caudal asignado.
        </Aviso>
      )}

      {/* Fuentes: principal + adicionales */}
      <div className="flex flex-col gap-3">
        {fuentes.fields.map((field, i) => (
          <div key={field.id} className="flex items-end gap-2">
            <FormSelectField
              name={n(`fuentes.${i}.valor`)}
              label={i === 0 ? 'Fuente de agua' : `Fuente adicional ${i}`}
              hideLabel={i > 0}
              // Obligatoria cuando la ubicación tiene catálogo (sin opciones, solo se cargan observación y caudal).
              required={i === 0 && opcionesFuente.length > 0}
              placeholder="Seleccione una fuente"
              options={opcionesFuente}
              disabled={opcionesFuente.length === 0}
              className="flex-1"
            />
            {i > 0 && <IconButton icon="delete" label="Quitar fuente" tone="danger" className="mb-1" onClick={() => fuentes.remove(i)} />}
          </div>
        ))}
        {opcionesFuente.length > 1 && (
          <div>
            <Button size="sm" variant="ghost" iconLeft="add" onClick={() => fuentes.append({ valor: '' })}>
              Agregar otra fuente
            </Button>
          </div>
        )}
      </div>

      <FormSelectField
        name={n('sistemaDistribucion')}
        label="Sistema de distribución"
        placeholder="Seleccione un sistema"
        options={opcionesSistema}
        disabled={opcionesSistema.length === 0}
      />

      <FormSelectField
        name={n('canalPrincipal')}
        label="Canal principal"
        placeholder="Seleccione un canal principal"
        options={opcionesPrincipal}
        disabled={opcionesPrincipal.length === 0}
        onValueChange={(cp) => {
          const secundarios = datos?.canalesPrincipales[cp] ?? []
          setValue(n('canalSecundario'), secundarios.length === 1 ? secundarios[0] : '', { shouldDirty: true })
          limpiarCanalesDesde(0)
        }}
      />

      <FormSelectField
        name={n('canalSecundario')}
        label="Canal secundario"
        placeholder={principal ? 'Seleccione un canal secundario' : 'Seleccione primero un canal principal'}
        options={opcionesSecundario}
        disabled={opcionesSecundario.length === 0}
        onValueChange={() => limpiarCanalesDesde(0)}
      />

      {/* Canales terciario / cuarto / quinto */}
      {canales.fields.map((field, i) => (
        <FormSelectField
          key={field.id}
          name={n(`canalesAdicionales.${i}.valor`)}
          label={NIVELES_CANAL_ADICIONAL[i]}
          placeholder={`Seleccione ${NIVELES_CANAL_ADICIONAL[i].toLowerCase()}`}
          options={toOptions(opcionesAdicional(i))}
          onValueChange={() => limpiarCanalesDesde(i + 1)}
        />
      ))}
      {puedeAgregarCanal && (
        <div className="flex items-end md:col-span-2">
          <Button size="sm" variant="secondary" iconLeft="add" onClick={agregarCanal}>
            Agregar {NIVELES_CANAL_ADICIONAL[canales.fields.length].toLowerCase()}
          </Button>
        </div>
      )}

      {opcionesDesague.length > 0 && (
        <FormSelectField name={n('desague')} label="Desagüe" placeholder="Seleccione un desagüe" options={opcionesDesague} />
      )}

      <FormMaskedField
        name={n('caudalAsignado')}
        label="Caudal asignado (l/s)"
        mask={decimalPositivo}
        inputMode="decimal"
        placeholder="Ej: 25.50"
        hint="Se calcula desde los usos cargados; puede ajustarse manualmente."
      />

      <FormTextareaField
        name={n('observacion')}
        label="Observación"
        placeholder="Observaciones adicionales sobre el suministro (aclaraciones, condiciones especiales, etc.)."
        className="md:col-span-2"
      />
    </div>
  )
}
