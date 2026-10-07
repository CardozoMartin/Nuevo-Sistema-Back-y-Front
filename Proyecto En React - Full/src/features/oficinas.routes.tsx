// Rutas de inicio de las oficinas intermedias del circuito. Cuando alguna crezca
// (bandeja, detalle de expediente, etc.) se mueve a su propio features/<oficina>/routes.tsx.
import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const oficinasRoutes: RouteObject[] = [
  {
    path: 'recaudacion',
    handle: { crumb: 'Recaudación' },
    lazy: lazyPage(() => import('./recaudacion/pages/RecaudacionInicioPage')),
  },
  {
    path: 'distrito',
    handle: { crumb: 'Distrito' },
    lazy: lazyPage(() => import('./distrito/pages/DistritoInicioPage')),
  },
  {
    path: 'juridico',
    handle: { crumb: 'Jurídico' },
    lazy: lazyPage(() => import('./juridico/pages/JuridicoInicioPage')),
  },
  {
    path: 'secretaria-general',
    handle: { crumb: 'Secretaría General' },
    lazy: lazyPage(() => import('./secretaria-general/pages/SecretariaGeneralInicioPage')),
  },
]
