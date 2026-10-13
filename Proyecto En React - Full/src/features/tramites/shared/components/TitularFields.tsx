import { useEffect, useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormNumericField, FormSelectField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buscarPersona, personaAFormulario, type PersonaPadron } from '../personas'
import {
  documentoConFormato,
  getReglaDocumento,
  TIPOS_DOCUMENTO,
  TIPOS_PERSONA,
  validarDocumento,
  type TipoDocumento,
  type TipoPersona,
  type TitularForm,
} from '../schemas/titular'

/** Campos que se completan desde el padrón (el tipo de persona y el documento ya los eligió el usuario). */
const CAMPOS_PADRON = ['apellido', 'nombre', 'fechaNacimiento', 'razonSocial', 'fechaConstitucion', 'correo', 'telefono'] as const
/** Los que identifican a la persona: si vinieron del padrón quedan bloqueados, para no escribirla distinto. */
type CampoIdentidad = 'apellido' | 'nombre' | 'fechaNacimiento' | 'razonSocial' | 'fechaConstitucion'

interface Props {
  /** Path del titular dentro del formulario (ej: 'titulares.0'). */
  prefix: string
  /** Correo y teléfono obligatorios (ej: carga final del titular, prototipo CatastroFinalizacion.html). */
  contactoObligatorio?: boolean
}

/** Campos de un titular. Cambian según sea persona física o jurídica. */
export function TitularFields({ prefix, contactoObligatorio }: Props) {
  const { control, getValues, setValue, getFieldState, trigger } = useFormContext()
  const n = (campo: string) => `${prefix}.${campo}`

  const [tipoPersona, tipoDocumento, documento] = useWatch({ control, name: [n('tipoPersona'), n('tipoDocumento'), n('documento')] }) as [
    TipoPersona,
    TipoDocumento,
    string | undefined,
  ]
  const regla = getReglaDocumento(tipoPersona, tipoDocumento)
  const esJuridica = tipoPersona === 'juridica'

  // --- Búsqueda en el padrón de personas ---------------------------------------------
  const [encontrada, setEncontrada] = useState<PersonaPadron | null>(null)
  /** Documento con el que se encontró (puede ser el DNI de alguien cargado con CUIL, o al revés). */
  const [buscadoCon, setBuscadoCon] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(false)
  // Lo que ya estaba al montar (un borrador que se retoma) no se vuelve a buscar.
  const ultimaBusqueda = useRef(`${regla.label}:${documento ?? ''}`)

  useEffect(() => {
    const doc = documento ?? ''
    const clave = `${regla.label}:${doc}`
    if (clave === ultimaBusqueda.current) return
    ultimaBusqueda.current = clave

    //1.- Si cambió el documento de una persona encontrada, sus datos ya no corresponden: se limpian.
    if (encontrada && buscadoCon !== doc) {
      for (const campo of CAMPOS_PADRON) setValue(n(campo), '')
      setEncontrada(null)
      setCorrigiendo(false)
    }
    if (validarDocumento(doc, regla) || (encontrada && buscadoCon === doc)) return

    //2.- Documento válido: si la persona ya está cargada, se completa el formulario; si no, nada.
    let vigente = true
    setBuscando(true)
    void buscarPersona(doc).then((persona) => {
      if (!vigente) return
      setBuscando(false)
      if (!persona) return
      const datos = personaAFormulario(persona)
      for (const [campo, valor] of Object.entries(datos)) setValue(n(campo), valor, { shouldDirty: true })
      void trigger(CAMPOS_PADRON.map(n))
      setEncontrada(persona)
      setBuscadoCon(doc)
      setCorrigiendo(false)
    })
    return () => {
      vigente = false
      setBuscando(false)
    }
    // Se busca solo cuando cambia el documento o su tipo (no al cambiar los demás datos).
  }, [documento, regla.label])

  /** Dato que vino del padrón: se muestra bloqueado (salvo que el usuario elija corregirlo). */
  const bloqueado = (campo: CampoIdentidad) => !!encontrada && !corrigiendo && !!(personaAFormulario(encontrada) as Partial<TitularForm>)[campo]

  /** Al cambiar el tipo, el documento se recorta al nuevo largo máximo y se revalida si ya tenía error. */
  function ajustarDocumento(persona: TipoPersona, doc: TipoDocumento) {
    const { max } = getReglaDocumento(persona, doc)
    const actual: string = getValues(n('documento')) ?? ''
    if (actual.length > max) setValue(n('documento'), actual.slice(0, max))
    if (getFieldState(n('documento')).isTouched) void trigger(n('documento'))
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {encontrada && (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm md:col-span-2 dark:border-sky-500/30 dark:bg-sky-500/10">
          <Icon name="how_to_reg" className="text-sky-700 dark:text-sky-300" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Esta persona ya está cargada en el sistema.</p>
            <p className="text-slate-600 dark:text-slate-300">
              Se completaron sus datos.
              {encontrada.documento && encontrada.documento !== buscadoCon && encontrada.tipoDocumento && (
                <>
                  {' '}
                  Figura con {documentoConFormato({ tipoPersona: 'fisica', tipoDocumento: encontrada.tipoDocumento.toLowerCase() as TipoDocumento, documento: encontrada.documento })}
                  {encontrada.documento.length === 11 ? ' (se mantiene ese dato).' : ' (se actualiza con el documento ingresado).'}
                </>
              )}
              {encontrada.denominacion && !encontrada.apellido && !encontrada.razonSocial && (
                <> En el padrón anterior figura como «{encontrada.denominacion}»: complete los datos que faltan.</>
              )}
              {corrigiendo && ' Los cambios actualizan la ficha de la persona en todos sus trámites.'}
            </p>
          </div>
          {!corrigiendo && (
            <Button size="sm" variant="secondary" iconLeft="edit" onClick={() => setCorrigiendo(true)}>
              Corregir datos
            </Button>
          )}
        </div>
      )}
      <FormSelectField
        name={n('tipoPersona')}
        label="Tipo de persona"
        options={TIPOS_PERSONA}
        onValueChange={(v) => ajustarDocumento(v as TipoPersona, tipoDocumento)}
      />
      {!esJuridica && (
        <FormSelectField
          name={n('tipoDocumento')}
          label="Tipo de documento"
          options={TIPOS_DOCUMENTO}
          onValueChange={(v) => ajustarDocumento(tipoPersona, v as TipoDocumento)}
        />
      )}
      <FormNumericField
        name={n('documento')}
        label={regla.label}
        required
        maxLength={regla.max}
        placeholder={regla.placeholder}
        hint={buscando ? 'Buscando en el padrón de personas…' : regla.label === 'DNI' ? undefined : 'Sin guiones.'}
      />
      <FormTextField
        name={n('correo')}
        label="Correo electrónico"
        required={contactoObligatorio}
        type="email"
        placeholder="nombre@ejemplo.com"
        hint={contactoObligatorio ? 'Se enviarán notificaciones del trámite a esta dirección.' : undefined}
      />

      {esJuridica ? (
        <>
          <FormTextField name={n('razonSocial')} readOnly={bloqueado('razonSocial')} label="Razón social" required placeholder="Razón social" className="md:col-span-2" />
          <FormTextField name={n('fechaConstitucion')} readOnly={bloqueado('fechaConstitucion')} label="Fecha de constitución" required type="date" />
        </>
      ) : (
        <>
          <FormTextField name={n('apellido')} readOnly={bloqueado('apellido')} label="Apellido" required placeholder="Apellido" />
          <FormTextField name={n('nombre')} readOnly={bloqueado('nombre')} label="Nombre" required placeholder="Nombre" />
          <FormTextField name={n('fechaNacimiento')} readOnly={bloqueado('fechaNacimiento')} label="Fecha de nacimiento" required type="date" />
        </>
      )}

      <FormTextField name={n('telefono')} label="Teléfono de contacto" required={contactoObligatorio} type="tel" placeholder="(0381) 123-4567" />
    </div>
  )
}
