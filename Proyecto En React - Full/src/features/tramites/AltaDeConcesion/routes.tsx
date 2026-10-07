import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const altaDeConcesionRoute: RouteObject = {
  path: 'alta-concesion',
  handle: { crumb: 'Alta de Concesión' },
  children: [
    // Catastro: inicio y pre carga
    { index: true, lazy: lazyPage(() => import('./pages/InicioAltaPage')) },
    {
      path: ':borradorId/datos',
      handle: { crumb: 'Pre carga de datos' },
      lazy: lazyPage(() => import('./pages/PreCargaDatosPage')),
    },
    // Circuito en el backend real: dónde está, qué hace cada oficina e historial.
    {
      path: 'circuito/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/CircuitoAltaPage')),
    },
    // Circuito de las altas viejas de json-server (datos de demo anteriores al backend real).
    {
      path: 'expediente/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/GestionExpedientePage')),
    },
  ],
}
