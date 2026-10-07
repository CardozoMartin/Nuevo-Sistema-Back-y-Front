import { Card } from '@/components/ui/Card'
import type { AltaBackend } from '../backend.types'

/** Datos del paso 1 y dónde está el trámite, como contexto fijo arriba del formulario. */
export function ResumenBorrador({ alta }: { alta: AltaBackend }) {
  const items = [
    ['Expediente', alta.numeroExpediente],
    ['Situación legal', alta.situacionLegal?.nombre ?? '—'],
    ['Documentación presentada', String(alta.documentacionPresentada.length)],
    ['Etapa', alta.circuito.etapaNombre],
    ['Lo tiene', alta.circuito.tomadoPor?.nombre ?? 'Nadie (hay que tomarlo)'],
  ]

  return (
    <Card className="flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
      {items.map(([label, valor]) => (
        <span key={label}>
          <span className="text-slate-500 dark:text-slate-400">{label}: </span>
          <strong className="text-slate-900 dark:text-white">{valor}</strong>
        </span>
      ))}
    </Card>
  )
}
