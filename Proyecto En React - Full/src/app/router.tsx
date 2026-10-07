import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import { catastroRoutes } from '@/features/catastro/routes'
import { oficinasRoutes } from '@/features/oficinas.routes'
import { tramitesRoutes } from '@/features/tramites/routes'
import { pozoRoutes } from '@/features/pozo/routes'
import { herramientasRoutes } from '@/features/herramientas.routes'

// Cada módulo define sus propias rutas; acá solo se ensamblan.
// Cuando exista el login, `/login` va como hermano de este árbol (fuera de AppLayout)
// y AppLayout se envuelve en una ruta protegida.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    handle: { crumb: 'Inicio' },
    children: [
      { index: true, element: <DashboardPage />, handle: { crumb: 'Dashboard' } },
      ...catastroRoutes,
      ...oficinasRoutes,
      ...tramitesRoutes,
      ...pozoRoutes,
      ...herramientasRoutes,
      { path: '*', element: <NotFoundPage />, handle: { crumb: 'No encontrada' } },
    ],
  },
])
