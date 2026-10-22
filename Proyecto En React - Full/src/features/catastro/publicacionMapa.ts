// Publicación de los polígonos en el mapa público (Argenmap). Backend real: /api/mapa/publicacion.
// Una concesión se publica recién con resolución y verificada por alguien con el permiso
// «Publicar en el mapa»; los usuarios internos la ven siempre en el visor del sistema.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sigKeys } from '@/features/visor/hooks'
import { api } from '@/services/api/client'

export type EstadoPublicacion = 'PENDIENTE' | 'OBSERVADO' | 'PUBLICADO'

export interface PoligonoParaPublicar {
  poligonoId: string
  concesionId: string
  numero: string | null
  expedienteId: string | null
  expediente: string | null
  expedienteEstado: string | null
  titular: string | null
  departamento: string | null
  distrito: string | null
  superficieHa: number
  publicacion: EstadoPublicacion
  /** La nota de quien lo observó (o lo publicó). */
  nota: string | null
  usuario: string | null
  fecha: string | null
  /** «12/2026» si ya tiene resolución. */
  resolucion: string | null
  resolucionFecha: string | null
  listoParaPublicar: boolean
}

export const ESTADOS_PUBLICACION: Record<EstadoPublicacion, { nombre: string; clases: string }> = {
  PENDIENTE: { nombre: 'Sin publicar', clases: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  OBSERVADO: { nombre: 'Observado', clases: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  PUBLICADO: { nombre: 'Publicado en Argenmap', clases: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
}

const publicacionApi = {
  async listar(estado?: EstadoPublicacion): Promise<PoligonoParaPublicar[]> {
    const { data } = await api.get<PoligonoParaPublicar[]>('/mapa/publicacion', { params: estado ? { estado } : undefined })
    return data
  },
  async publicar(poligonoId: string, observaciones?: string) {
    await api.post(`/mapa/publicacion/${poligonoId}/publicar`, { observaciones: observaciones || undefined })
  },
  async observar(poligonoId: string, observaciones: string) {
    await api.post(`/mapa/publicacion/${poligonoId}/observar`, { observaciones })
  },
  async reemplazar(poligonoId: string, archivo: File): Promise<{ poligonoId: string; avisos: string[] }> {
    const datos = new FormData()
    datos.append('archivo', archivo)
    const { data } = await api.post<{ poligonoId: string; avisos: string[] }>(`/mapa/publicacion/${poligonoId}/reemplazar`, datos)
    return data
  },
}

const CLAVE = ['mapa', 'publicacion'] as const

export function usePoligonosParaPublicar(estado?: EstadoPublicacion) {
  return useQuery({ queryKey: [...CLAVE, estado ?? 'pendientes'], queryFn: () => publicacionApi.listar(estado) })
}

/** Publicar, observar o reemplazar: refresca la lista y las capas del visor. */
export function useAccionPublicacion() {
  const qc = useQueryClient()
  const alTerminar = () => {
    void qc.invalidateQueries({ queryKey: CLAVE })
    void qc.invalidateQueries({ queryKey: sigKeys.all })
  }
  return {
    publicar: useMutation({ mutationFn: (p: { poligonoId: string; observaciones?: string }) => publicacionApi.publicar(p.poligonoId, p.observaciones), onSuccess: alTerminar }),
    observar: useMutation({ mutationFn: (p: { poligonoId: string; observaciones: string }) => publicacionApi.observar(p.poligonoId, p.observaciones), onSuccess: alTerminar }),
    reemplazar: useMutation({ mutationFn: (p: { poligonoId: string; archivo: File }) => publicacionApi.reemplazar(p.poligonoId, p.archivo), onSuccess: alTerminar }),
  }
}
