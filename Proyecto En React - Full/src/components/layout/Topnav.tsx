import { Link } from 'react-router'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { useTheme } from '@/hooks/useTheme'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { CampanaNotificaciones } from '@/features/notificaciones/components/CampanaNotificaciones'
import { SelectorUsuario } from './SelectorUsuario'

interface TopnavProps {
  onOpenSidebar: () => void
  /** Mostrar el botón de menú también en desktop (cuando el menú lateral es desplegable). */
  menuSiempre?: boolean
}

export function Topnav({ onOpenSidebar, menuSiempre = false }: TopnavProps) {
  const crumbs = useBreadcrumbs()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 md:px-6 dark:border-slate-800 dark:bg-surface-dark">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className={cn('rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50', !menuSiempre && 'lg:hidden')}
          aria-label="Abrir menú"
        >
          <Icon name="menu" />
        </button>

        <nav aria-label="Ruta de navegación" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-400">
          {crumbs.map((crumb, i) =>
            i === crumbs.length - 1 ? (
              <span key={crumb.path} className="truncate font-semibold text-slate-700 dark:text-white">
                {crumb.label}
              </span>
            ) : (
              <span key={crumb.path} className="flex items-center gap-1.5">
                <Link to={crumb.path} className="truncate transition-colors hover:text-primary">
                  {crumb.label}
                </Link>
                <Icon name="chevron_right" className="text-base!" />
              </span>
            ),
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <CampanaNotificaciones />
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
          aria-label={theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}
        >
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
        </button>

        {/* TODO(login): pasa a mostrar el usuario autenticado */}
        <SelectorUsuario />
      </div>
    </header>
  )
}
