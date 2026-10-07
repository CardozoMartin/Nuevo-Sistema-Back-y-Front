// Usuario con el que se actúa en el backend real.
//
// TODO(login): mientras no haya login, se elige en la barra superior entre los usuarios de
// prueba del backend (uno por oficina) y viaja en el encabezado X-Usuario-Id. Con el login,
// este módulo pasa a leer el usuario de la sesión y el resto de la app no cambia.
import { useSyncExternalStore } from 'react'

const CLAVE = 'drh_usuario_actual'
/** Sin usuario elegido, el backend usa «Sistema» (administrador: puede actuar en cualquier oficina). */
export const USUARIO_SISTEMA = '1'

const suscriptores = new Set<() => void>()

function leer(): string {
  try {
    return localStorage.getItem(CLAVE) ?? USUARIO_SISTEMA
  } catch {
    return USUARIO_SISTEMA
  }
}

let actual = leer()

export function usuarioActualId(): string {
  return actual
}

export function cambiarUsuario(id: string): void {
  actual = id
  try {
    localStorage.setItem(CLAVE, id)
  } catch {
    /* sin almacenamiento: queda solo en memoria */
  }
  suscriptores.forEach((avisar) => avisar())
}

function suscribir(avisar: () => void) {
  suscriptores.add(avisar)
  return () => suscriptores.delete(avisar)
}

/** Id del usuario actual; el componente se vuelve a dibujar cuando cambia. */
export function useUsuarioActualId(): string {
  return useSyncExternalStore(suscribir, usuarioActualId)
}
