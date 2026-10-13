// Cliente HTTP único de la app. Todas las peticiones pasan por acá para centralizar
// URL base, headers (token cuando exista login), demoras simuladas y errores.
import axios from 'axios'
import { adaptadorDemo } from '../demo/adaptador'
import { MODO_DEMO } from '../demo/modo'
import { toApiError } from './errors'

const DEMORA_MS = import.meta.env.DEV ? Number(import.meta.env.VITE_API_DELAY_MS ?? 400) : 0

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Demora artificial en desarrollo para que se vean los estados de carga en la demo.
if (DEMORA_MS > 0) {
  api.interceptors.request.use((config) => new Promise((resolve) => setTimeout(() => resolve(config), DEMORA_MS)))
}

// Modo demo: lo geográfico (/sig/*, backend real) lo responde el emulador; lo demás sigue en json-server.
if (MODO_DEMO) api.defaults.adapter = adaptadorDemo((url) => url.startsWith('/sig/'))

// TODO(login): agregar el token de sesión.
// api.interceptors.request.use((config) => { config.headers.Authorization = `Bearer ${token}`; return config })

// Todos los errores salen como ApiError con un mensaje listo para mostrar.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
)
