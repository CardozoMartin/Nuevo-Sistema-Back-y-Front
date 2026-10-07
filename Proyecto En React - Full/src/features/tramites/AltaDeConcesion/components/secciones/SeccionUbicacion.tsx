import { useFormContext } from 'react-hook-form'
import { CascadaUbicacionFields, KmlUploadField, suministroVacio } from '../../../shared'
import type { PreCargaForm } from '../../schemas'

/** Sección 2: ubicación del inmueble y KML de la concesión. */
export function SeccionUbicacion() {
  const { getValues, setValue } = useFormContext<PreCargaForm>()

  // Las opciones de suministro dependen de la ubicación: si cambia, se reinicia
  // esa sección (conservando el caudal, que sale de los usos).
  function reiniciarSuministro() {
    setValue('suministro', suministroVacio(getValues('suministro.caudalAsignado')))
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CascadaUbicacionFields prefix="ubicacion" required onUbicacionChange={reiniciarSuministro} />
      </div>
      <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
        <KmlUploadField name="ubicacion.poligono" />
      </div>
    </div>
  )
}
