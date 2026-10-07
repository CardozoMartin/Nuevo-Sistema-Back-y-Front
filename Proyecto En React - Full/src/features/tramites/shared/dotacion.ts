// Cálculo de caudal según el módulo de dotación de cada uso.
// Los módulos (l/s por unidad) vienen de la API (/usos), no están en el código.
//
// Referencia: Art. 32 de la Ley 7139/7140 (Régimen de Aguas de Tucumán). Los valores
// cargados en la demo son ilustrativos.
import type { UsoInfo } from '@/types/domain'

export const redondear2 = (n: number) => Math.round(n * 100) / 100

/** Caudal (l/s) de un uso según su magnitud. */
export function caudalDeUso(uso: UsoInfo | undefined, magnitud: string | number): number {
  const m = Number(magnitud)
  if (!uso || !Number.isFinite(m) || m <= 0) return 0
  return m * uso.dotacion
}

export function caudalTotal(items: { uso: string; magnitud: string }[], buscarUso: (id: string) => UsoInfo | undefined): number {
  return redondear2(items.reduce((acc, i) => acc + caudalDeUso(buscarUso(i.uso), i.magnitud), 0))
}
