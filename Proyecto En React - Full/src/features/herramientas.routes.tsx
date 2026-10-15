import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const herramientasRoutes: RouteObject[] = [
  { path: 'busqueda', handle: { crumb: 'Búsqueda' }, lazy: lazyPage(() => import('./catastro/pages/BusquedaCatastroPage')) },
  { path: 'visor', handle: { crumb: 'Visor cartográfico', pantallaCompleta: true }, lazy: lazyPage(() => import('./visor/pages/VisorPage')) },
  { path: 'configuracion', handle: { crumb: 'Configuración' }, lazy: lazyPage(() => import('./configuracion/pages/ConfiguracionPage')) },
]
