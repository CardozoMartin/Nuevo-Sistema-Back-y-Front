// Hooks de datos del Alta de Concesión (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
//
// Cada acción del circuito devuelve el alta actualizada: se guarda en la caché y se
// refrescan el historial y las bandejas (el expediente cambió de oficina o de estado).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaConcesionApi } from './api'
import type { AltaBackend, OficinaBackend } from './backend.types'

export const altaKeys = {
  all: ['backend', 'altas'] as const,
  situaciones: () => [...altaKeys.all, 'situaciones-legales'] as const,
  enCarga: () => [...altaKeys.all, 'en-carga'] as const,
  alta: (id: string) => [...altaKeys.all, 'alta', id] as const,
  historial: (id: string) => [...altaKeys.all, 'historial', id] as const,
  bandejas: () => [...altaKeys.all, 'bandeja'] as const,
  bandeja: (oficina: OficinaBackend) => [...altaKeys.bandejas(), oficina] as const,
  deudas: (personaId: string) => [...altaKeys.all, 'deudas', personaId] as const,
}

// --- Consultas ---------------------------------------------------------------------

export function useSituacionesLegales() {
  return useQuery({ queryKey: altaKeys.situaciones(), queryFn: altaConcesionApi.situacionesLegales, staleTime: Infinity })
}

export function useAltasEnCarga() {
  return useQuery({ queryKey: altaKeys.enCarga(), queryFn: altaConcesionApi.listarEnCarga })
}

export function useAlta(id: string | undefined) {
  return useQuery({ queryKey: altaKeys.alta(id ?? ''), queryFn: () => altaConcesionApi.obtener(id!), enabled: !!id })
}

export function useHistorial(id: string | undefined) {
  return useQuery({ queryKey: altaKeys.historial(id ?? ''), queryFn: () => altaConcesionApi.historial(id!), enabled: !!id })
}

/** Bandeja de una oficina; se refresca sola cada 30 s (hasta que haya eventos en vivo del backend). */
export function useBandeja(oficina: OficinaBackend) {
  return useQuery({ queryKey: altaKeys.bandeja(oficina), queryFn: () => altaConcesionApi.bandeja(oficina), refetchInterval: 30_000 })
}

export function useDeudas(personaId: string | undefined) {
  return useQuery({ queryKey: altaKeys.deudas(personaId ?? ''), queryFn: () => altaConcesionApi.deudas(personaId!), enabled: !!personaId })
}

// --- Acciones ----------------------------------------------------------------------

/** Después de cualquier acción: el alta nueva a la caché y el resto, a refrescar. */
function useAlActualizar(id: string) {
  const qc = useQueryClient()
  return (alta?: AltaBackend) => {
    if (alta) qc.setQueryData(altaKeys.alta(id), alta)
    else void qc.invalidateQueries({ queryKey: altaKeys.alta(id) })
    void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
    void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    void qc.invalidateQueries({ queryKey: altaKeys.enCarga() })
  }
}

export function useIniciarAlta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: altaConcesionApi.iniciar,
    onSuccess: (alta) => {
      qc.setQueryData(altaKeys.alta(alta.id), alta)
      void qc.invalidateQueries({ queryKey: altaKeys.enCarga() })
    },
  })
}

/** Acción genérica sobre un alta: recibe la llamada a la API y actualiza la caché al terminar. */
export function useAccionAlta<TInput, TOutput = unknown>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const alActualizar = useAlActualizar(id)
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input: TInput) => accion(id, input),
    // Las acciones del alta devuelven el alta actualizada (con «circuito»); tomar devuelve otra cosa.
    onSuccess: (respuesta) => alActualizar(respuesta && typeof respuesta === 'object' && 'circuito' in respuesta ? (respuesta as unknown as AltaBackend) : undefined),
  })
}

export function useTomar(id: string) {
  return useAccionAlta<void>(id, (i) => altaConcesionApi.tomar(i))
}

export function useCancelarDeuda(id: string) {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar(id)
  return useMutation({
    mutationFn: ({ deudaId, comprobante }: { deudaId: string; comprobante?: string }) => altaConcesionApi.cancelarDeuda(deudaId, comprobante),
    onSuccess: () => {
      alActualizar()
      void qc.invalidateQueries({ queryKey: [...altaKeys.all, 'deudas'] })
    },
  })
}
