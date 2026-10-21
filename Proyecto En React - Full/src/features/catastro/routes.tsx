import { Navigate, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { ROUTES } from '@/config/routes'
import { deOficina } from '@/features/auth/components/RutaDeOficina'

export const catastroRoutes: RouteObject[] = [
  {
    path: 'catastro',
    handle: { crumb: 'Catastro' },
    children: [
      // Lo de trabajo de Catastro, solo sus usuarios. La búsqueda es general (Herramientas).
      deOficina('catastro', [
        { index: true, element: <Navigate to="tramites" replace /> },
        { path: 'bandeja', handle: { crumb: 'Bandeja' }, lazy: lazyPage(() => import('./pages/BandejaCatastroPage')) },
        { path: 'tramites', handle: { crumb: 'Trámites' }, lazy: lazyPage(() => import('./pages/TramitesPage')) },
        { path: 'pendientes', handle: { crumb: 'Seguimiento' }, lazy: lazyPage(() => import('./pages/PendientesPage')) },
        { path: 'concesiones', handle: { crumb: 'Consulta de concesiones' }, lazy: lazyPage(() => import('./pages/ConsultaConcesionesPage')) },
      ]),
      // Dirección vieja del buscador: ahora es la búsqueda general.
      { path: 'busqueda/*', element: <Navigate to={ROUTES.busqueda} replace /> },
    ],
  },
]
