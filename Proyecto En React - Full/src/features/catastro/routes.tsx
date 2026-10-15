import { Navigate, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { deOficina } from '@/features/auth/components/RutaDeOficina'

export const catastroRoutes: RouteObject[] = [
  {
    path: 'catastro',
    handle: { crumb: 'Catastro' },
    children: [
      // Lo de trabajo de Catastro, solo sus usuarios. La búsqueda y la consulta, para todos.
      deOficina('catastro', [
        { index: true, element: <Navigate to="tramites" replace /> },
        { path: 'bandeja', handle: { crumb: 'Bandeja' }, lazy: lazyPage(() => import('./pages/BandejaCatastroPage')) },
        { path: 'tramites', handle: { crumb: 'Trámites' }, lazy: lazyPage(() => import('./pages/TramitesPage')) },
        { path: 'pendientes', handle: { crumb: 'Seguimiento' }, lazy: lazyPage(() => import('./pages/PendientesPage')) },
      ]),
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
