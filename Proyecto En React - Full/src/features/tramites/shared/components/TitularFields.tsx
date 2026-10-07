import { useFormContext, useWatch } from 'react-hook-form'
import { FormNumericField, FormSelectField, FormTextField } from '@/components/form'
import { getReglaDocumento, TIPOS_DOCUMENTO, TIPOS_PERSONA, type TipoDocumento, type TipoPersona } from '../schemas/titular'

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

  const [tipoPersona, tipoDocumento] = useWatch({ control, name: [n('tipoPersona'), n('tipoDocumento')] }) as [
    TipoPersona,
    TipoDocumento,
  ]
  const regla = getReglaDocumento(tipoPersona, tipoDocumento)
  const esJuridica = tipoPersona === 'juridica'

  /** Al cambiar el tipo, el documento se recorta al nuevo largo máximo y se revalida si ya tenía error. */
  function ajustarDocumento(persona: TipoPersona, doc: TipoDocumento) {
    const { max } = getReglaDocumento(persona, doc)
    const actual: string = getValues(n('documento')) ?? ''
    if (actual.length > max) setValue(n('documento'), actual.slice(0, max))
    if (getFieldState(n('documento')).isTouched) void trigger(n('documento'))
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
        hint={regla.label === 'DNI' ? undefined : 'Sin guiones.'}
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
          <FormTextField name={n('razonSocial')} label="Razón social" required placeholder="Razón social" className="md:col-span-2" />
          <FormTextField name={n('fechaConstitucion')} label="Fecha de constitución" required type="date" />
        </>
      ) : (
        <>
          <FormTextField name={n('apellido')} label="Apellido" required placeholder="Apellido" />
          <FormTextField name={n('nombre')} label="Nombre" required placeholder="Nombre" />
          <FormTextField name={n('fechaNacimiento')} label="Fecha de nacimiento" required type="date" />
        </>
      )}

      <FormTextField name={n('telefono')} label="Teléfono de contacto" required={contactoObligatorio} type="tel" placeholder="(0381) 123-4567" />
    </div>
  )
}
