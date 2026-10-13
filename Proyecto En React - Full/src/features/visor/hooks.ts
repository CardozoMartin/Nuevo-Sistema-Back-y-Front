import { useQuery } from '@tanstack/react-query'
import { sigApi } from './api'

export const sigKeys = {
  all: ['sig'] as const,
  concesiones: () => [...sigKeys.all, 'concesiones'] as const,
  pozos: () => [...sigKeys.all, 'pozos'] as const,
  puntos: () => [...sigKeys.all, 'puntos'] as const,
  cauces: () => [...sigKeys.all, 'cauces'] as const,
}

/** Capa de concesiones del visor. Se refresca al volver a la pestaña (otro usuario pudo cargar un KML). */
export function useCapaConcesiones() {
  return useQuery({
    queryKey: sigKeys.concesiones(),
    queryFn: () => sigApi.concesiones(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Capa de pozos del visor. */
export function useCapaPozos() {
  return useQuery({
    queryKey: sigKeys.pozos(),
    queryFn: () => sigApi.pozos(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Capa de desagües y puntos de entrega del visor. */
export function useCapaPuntos() {
  return useQuery({
    queryKey: sigKeys.puntos(),
    queryFn: () => sigApi.puntos(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Ríos y canales: cambian muy poco (se recargan con «npm run sig:cauces» en el backend). */
export function useCapaCauces() {
  return useQuery({ queryKey: sigKeys.cauces(), queryFn: () => sigApi.cauces(), staleTime: Infinity })
}
