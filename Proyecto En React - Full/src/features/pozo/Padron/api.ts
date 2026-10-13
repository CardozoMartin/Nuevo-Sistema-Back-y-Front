// Padrón de pozos por origen. PROTOTIPO: lo responde el backend emulado (npm run demo).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'
import type { OrigenPozo, PadronPozos } from './types'

export const padronApi = {
  listar: async (origen: OrigenPozo | null, q: string) =>
    (await backend.get<PadronPozos>('/pozos/padron', { params: { ...(origen ? { origen } : {}), ...(q ? { q } : {}) } })).data,
}

/** Lista del padrón; conserva los resultados mientras se escribe la búsqueda. */
export function usePadronPozos(origen: OrigenPozo | null, q: string) {
  return useQuery({ queryKey: ['backend', 'pozos', 'padron', origen, q], queryFn: () => padronApi.listar(origen, q), placeholderData: keepPreviousData })
}
