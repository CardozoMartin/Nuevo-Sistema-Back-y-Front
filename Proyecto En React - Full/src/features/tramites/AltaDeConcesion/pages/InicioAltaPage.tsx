import { FormProvider, useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormRadioCardGroup } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { toApiError } from '@/services/api/errors'
import type { SituacionLegalInfo } from '@/types/domain'
import { AltasEnCurso } from '../components/AltasEnCurso'
import { DocumentacionRequerida } from '../components/DocumentacionRequerida'
import { NumeroExpedienteFields } from '../../shared/components/NumeroExpedienteFields'
import { expedienteVacio } from '../../shared/schemas/expediente'
import { useIniciarAlta, useSituacionesLegales } from '../hooks'
import { inicioAltaSchema, type InicioAltaCampos, type InicioAltaForm } from '../schemas'

/**
 * Paso 1 del alta (Catastro): número del expediente en papel, situación legal y papeles
 * presentados. El backend valida que el expediente no exista (409) y lo registra tomado
 * por el usuario actual.
 */
export default function InicioAltaPage() {
  const navigate = useNavigate()
  const situaciones = useSituacionesLegales()
  const iniciar = useIniciarAlta()
  const form = useForm<InicioAltaCampos, unknown, InicioAltaForm>({
    resolver: zodResolver(inicioAltaSchema),
    defaultValues: { expediente: expedienteVacio(), situacionLegalId: '', documentacionPresentada: [] },
    mode: 'onTouched',
  })
  const documentacion = useController({ control: form.control, name: 'documentacionPresentada' })

  // El checklist muestra las descripciones; al enviar se pasan a los ids del catálogo.
  const elegida = situaciones.data?.find((s) => s.codigo === form.watch('situacionLegalId'))
  const situacion: SituacionLegalInfo | undefined = elegida && {
    id: elegida.codigo,
    nombre: elegida.nombre,
    titulo: elegida.titulo,
    documentacion: elegida.documentos.map((d) => d.descripcion),
  }

  async function onSubmit(values: InicioAltaForm) {
    const { numero, reparticion, anio } = form.getValues('expediente')
    const ids = elegida?.documentos.filter((d) => values.documentacionPresentada.includes(d.descripcion)).map((d) => d.id) ?? []
    try {
      const alta = await iniciar.mutateAsync({
        expediente: { numero, reparticion, anio: Number(anio) },
        situacionLegal: values.situacionLegalId,
        documentacionPresentada: ids,
      })
      navigate(ROUTES.tramites.altaConcesion.datos(alta.id))
    } catch (e) {
      // Número ya registrado: se muestra en el campo.
      if (toApiError(e).status === 409) form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
    }
  }

  function togglePapel(papel: string) {
    const actuales = documentacion.field.value
    documentacion.field.onChange(actuales.includes(papel) ? actuales.filter((p) => p !== papel) : [...actuales, papel])
  }

  const errorGeneral = iniciar.error && toApiError(iniciar.error).status !== 409 ? iniciar.error : null

  return (
    <>
      <PageHeader
        title="Alta de Concesión"
        description="Inicie el proceso de registro para una nueva concesión. Necesitará el número de expediente físico para validar la solicitud."
      />

      <div className="flex flex-col gap-6">
        <Card>
          {situaciones.isPending ? (
            <LoadingState mensaje="Cargando situaciones legales…" />
          ) : situaciones.isError ? (
            <ErrorState error={situaciones.error} onRetry={() => void situaciones.refetch()} reintentando={situaciones.isFetching} className="m-6" />
          ) : (
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-7 p-6 md:p-10">
                <NumeroExpedienteFields />

                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-slate-700">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Situación legal del solicitante</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Seleccione una opción para ver los papeles requeridos antes de continuar el expediente.
                    </p>
                  </div>

                  <FormRadioCardGroup
                    name="situacionLegalId"
                    options={situaciones.data.map((s) => ({ value: s.codigo, label: s.nombre }))}
                    // Por defecto todos los papeles se marcan como presentados; el operador desmarca los faltantes.
                    onValueChange={(v) =>
                      form.setValue('documentacionPresentada', situaciones.data.find((s) => s.codigo === v)?.documentos.map((d) => d.descripcion) ?? [])
                    }
                  />

                  {situacion && <DocumentacionRequerida situacion={situacion} presentados={documentacion.field.value} onToggle={togglePapel} />}
                </div>

                {errorGeneral && <Alert>{toApiError(errorGeneral).message}</Alert>}

                <div className="pt-2">
                  <Button type="submit" iconRight="arrow_forward" loading={iniciar.isPending} className="w-full md:w-auto">
                    {iniciar.isPending ? 'Validando…' : 'Iniciar Alta'}
                  </Button>
                </div>
              </form>
            </FormProvider>
          )}
        </Card>

        <AltasEnCurso />
      </div>
    </>
  )
}
