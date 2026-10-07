import { z } from 'zod'
import { validarPosgar } from '@/lib/validaciones'

const usoItemSchema = z.object({
  uso: z.string(), // id de /usos
  magnitud: z.string(),
})

/**
 * Usos y magnitudes de la concesión (carácter, período, desagüe, usos, punto de entrega).
 * Es una fábrica porque qué usos exigen punto de entrega lo define la API
 * (/usos → requierePuntoEntrega).
 */
export function crearUsosSchema(usosConPuntoEntrega: string[]) {
  return z
    .object({
      caracter: z.string(), // id de /caracteres
      codigoServicio: z.string(), // id de /codigosServicio
      periodoInicio: z.string(),
      periodoFin: z.string(),
      /** Coordenadas POSGAR 2007 faja 3 (EPSG:5345), en metros. */
      desagueX: z.string().trim(),
      desagueY: z.string().trim(),
      items: z.array(usoItemSchema),
      /** Punto de entrega de agua; solo se exige si algún uso lo requiere. */
      pecuario: z.object({
        x: z.string().trim(),
        y: z.string().trim(),
        referencia: z.string().trim(),
      }),
    })
    .superRefine((u, ctx) => {
      const issue = (path: (string | number)[], message: string | null) => {
        if (message) ctx.addIssue({ code: 'custom', path, message })
      }

      issue(['desagueX'], validarPosgar(u.desagueX, 'x', 'del desagüe'))
      issue(['desagueY'], validarPosgar(u.desagueY, 'y', 'del desagüe'))

      if (u.periodoInicio && u.periodoFin && u.periodoFin < u.periodoInicio) {
        issue(['periodoFin'], 'El fin del período no puede ser anterior al inicio.')
      }

      if (!u.items.some((i) => i.uso)) issue(['items', 0, 'uso'], 'Seleccione al menos un uso.')
      const vistos = new Set<string>()
      u.items.forEach((item, i) => {
        if (!item.uso) {
          if (item.magnitud) issue(['items', i, 'uso'], 'Seleccione el uso.')
          return
        }
        if (vistos.has(item.uso)) issue(['items', i, 'uso'], 'Este uso ya está cargado.')
        vistos.add(item.uso)
        if (!(Number(item.magnitud) > 0)) issue(['items', i, 'magnitud'], 'Ingrese una magnitud mayor a 0.')
      })

      if (u.items.some((i) => usosConPuntoEntrega.includes(i.uso))) {
        issue(['pecuario', 'x'], validarPosgar(u.pecuario.x, 'x', 'del punto de entrega'))
        issue(['pecuario', 'y'], validarPosgar(u.pecuario.y, 'y', 'del punto de entrega'))
      }
    })
}

export type UsosForm = z.infer<ReturnType<typeof crearUsosSchema>>

export const usoItemVacio = () => ({ uso: '', magnitud: '' })

export const usosVacio = (): UsosForm => ({
  caracter: '',
  codigoServicio: '',
  periodoInicio: '',
  periodoFin: '',
  desagueX: '',
  desagueY: '',
  items: [usoItemVacio()],
  pecuario: { x: '', y: '', referencia: '' },
})
