// Modo demo: la app funciona entera en el navegador, sin el backend real (NestJS + PostGIS).
//
// Se prende con VITE_MODO_DEMO=true: `npm run demo` (usa .env.demo). Los módulos que ya hablan con el backend
// real (Alta de Concesión, Baja de Pozo, visor y SIG, usuarios) pasan a responderse con un
// backend EMULADO (services/demo/servidor): mismas rutas, misma forma de las respuestas y las
// mismas reglas principales del circuito, con los datos guardados en el navegador.
//
// Las pantallas y los api.ts no cambian: solo se cambia el «adaptador» de los clientes HTTP
// (services/api/client.ts y backend.ts). Al apagarlo, todo vuelve al backend real.
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true'
