import { Link } from 'react-router'
import { NAVIGATION, NAVIGATION_FOOTER } from '@/config/navigation'
import { ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { useResumenBandejas } from '@/features/notificaciones/useResumenBandejas'
import { cn } from '@/lib/cn'
import type { NavItem } from '@/types/navigation'
import { SidebarItem, type BadgeItem } from './SidebarItem'

interface SidebarProps {
  /** En pantallas chicas, o siempre si es `flotante` (en desktop normal el sidebar está fijo). */
  open: boolean
  onClose: () => void
  /**
   * Menú desplegable en todos los tamaños de pantalla: está escondido y se abre encima del
   * contenido. Lo usan las pantallas completas (ej: el visor), para dejar todo el ancho al mapa.
   */
  flotante?: boolean
}

export function Sidebar({ open, onClose, flotante = false }: SidebarProps) {
  // TODO(login): filtrar NAVIGATION por item.roles según el rol del usuario.
  const resumen = useResumenBandejas()
  const getBadge = (item: NavItem): BadgeItem | undefined => {
    if (!item.bandejaDe) return undefined
    const r = resumen[item.bandejaDe]
    return { cantidad: r?.pendientes ?? 0, nuevo: (r?.nuevos ?? 0) > 0 }
  }

  return (
    <>
      {/* Fondo oscuro en mobile */}
      <div
        onClick={onClose}
        className={cn('fixed inset-0 z-30 bg-slate-900/40', !flotante && 'lg:hidden', open ? 'block' : 'hidden')}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-surface-dark',
          !flotante && 'lg:static lg:translate-x-0',
          flotante && open && 'shadow-2xl',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link to={ROUTES.dashboard} className="flex shrink-0 items-center gap-3 p-6">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon name="water_drop" filled className="text-2xl! text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-base leading-none font-bold tracking-tight">Sistema DRH</span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recursos Hídricos · Tucumán</span>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
          {NAVIGATION.map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              {section.title && (
                <p className="px-3 pt-4 pb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => (
                <SidebarItem key={item.key} item={item} getBadge={getBadge} />
              ))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800">
          {NAVIGATION_FOOTER.map((item) => (
            <SidebarItem key={item.key} item={item} />
          ))}
        </div>
      </aside>
    </>
  )
}
