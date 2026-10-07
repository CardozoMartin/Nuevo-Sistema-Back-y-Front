import { Navigate, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const catastroRoutes: RouteObject[] = [
  {
    path: 'catastro',
    handle: { crumb: 'Catastro' },
    children: [
      { index: true, element: <Navigate to="tramites" replace /> },
      { path: 'bandeja', handle: { crumb: 'Bandeja' }, lazy: lazyPage(() => import('./pages/BandejaCatastroPage')) },
      { path: 'tramites', handle: { crumb: 'Trámites' }, lazy: lazyPage(() => import('./pages/TramitesPage')) },
      { path: 'pendientes', handle: { crumb: 'Seguimiento' }, lazy: lazyPage(() => import('./pages/PendientesPage')) },
      {
        path: 'busqueda',
        handle: { crumb: 'Búsqueda' },
        children: [
          { index: true, lazy: lazyPage(() => import('./pages/BusquedaCatastroPage')) },
          { path: 'concesion/:concesionId', handle: { crumb: 'Historial de la concesión' }, lazy: lazyPage(() => import('./pages/HistorialConcesionPage')) },
          { path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/ExpedienteDetallePage')) },
        ],
      },
    ],
  },
]
