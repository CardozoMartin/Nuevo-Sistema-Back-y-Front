// Padrón de personas (per_persona del backend): una sola por documento. Al cargar un titular
// se busca su documento; si ya está cargado, el formulario se completa con sus datos y así no
// se carga dos veces a la misma persona (ni con el nombre escrito distinto).
import { backend } from '@/services/api/backend'
import { esNoEncontrado } from '@/services/api/errors'
import { queryClient } from '@/lib/queryClient'
import type { TitularBackend } from '../AltaDeConcesion/backend.types'
import type { TitularForm } from './schemas/titular'

/** `denominacion`: nombre del padrón anterior, solo en personas migradas (pueden no tener apellido y nombre). */
export type PersonaPadron = Omit<TitularBackend, 'personaId'> & { id: string; denominacion?: string | null }

/**
 * GET /personas?documento= — la persona o null si no está cargada (o si no se pudo consultar).
 * Una persona física se encuentra también por el documento equivalente: con su DNI aparece si
 * está cargada con CUIL / CUIT y al revés. Por eso su `documento` puede no ser el buscado.
 */
async function pedirPersona(documento: string): Promise<PersonaPadron | null> {
  try {
    const { data } = await backend.get<{ persona: PersonaPadron }>('/personas', { params: { documento } })
    return data.persona
  } catch (e) {
    // Sin el backend (o con un error) se sigue con la carga normal: la búsqueda es una ayuda.
    if (!esNoEncontrado(e)) console.warn('No se pudo consultar el padrón de personas.', e)
    return null
  }
}

export const buscarPersona = (documento: string) =>
  queryClient.fetchQuery({ queryKey: ['personas', documento], queryFn: () => pedirPersona(documento), staleTime: 60_000 })

/**
 * Los datos de la persona tal como los usa el formulario del titular. El tipo y el número de
 * documento quedan como los escribió el usuario (el backend se queda con el más completo).
 */
export function personaAFormulario(p: PersonaPadron): Partial<TitularForm> {
  const juridica = p.tipoPersona === 'JURIDICA'
  return {
    tipoPersona: juridica ? 'juridica' : 'fisica',
    apellido: p.apellido ?? '',
    nombre: p.nombre ?? '',
    fechaNacimiento: p.fechaNacimiento ?? '',
    razonSocial: p.razonSocial ?? '',
    fechaConstitucion: p.fechaConstitucion ?? '',
    correo: p.email ?? '',
    telefono: p.telefono ?? '',
  }
}
