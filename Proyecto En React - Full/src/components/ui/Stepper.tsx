import { cn } from '@/lib/cn'
import { Icon } from './Icon'

export interface Step {
  key: string
  label: string
}

interface StepperProps {
  steps: readonly Step[]
  /** Índice del paso actual. */
  current: number
  /** Último paso al que se llegó; se puede volver a cualquiera hasta ese. */
  maxReached: number
  onSelect: (index: number) => void
}

/** Pasos de un formulario largo con barra de avance. */
export function Stepper({ steps, current, maxReached, onSelect }: StepperProps) {
  const progreso = Math.round((current / Math.max(steps.length - 1, 1)) * 100)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progreso}%` }} />
        </div>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{progreso}% completado</span>
      </div>

      <ol className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        {steps.map((step, i) => {
          const activo = i === current
          const completo = i < maxReached && !activo
          const habilitado = i <= maxReached
          return (
            <li key={step.key} className="flex-1">
              <button
                type="button"
                disabled={!habilitado}
                onClick={() => onSelect(i)}
                aria-current={activo ? 'step' : undefined}
                className={cn(
                  '-mb-px flex w-full items-center justify-center gap-1.5 border-b-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                  activo && 'border-primary bg-primary/5 font-semibold text-primary',
                  !activo && habilitado && 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-primary dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/40',
                  !habilitado && 'cursor-not-allowed border-transparent text-slate-400 dark:text-slate-600',
                )}
              >
                {completo ? <Icon name="check_circle" filled className="text-lg! text-green-600" /> : <span>{i + 1}.</span>}
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
