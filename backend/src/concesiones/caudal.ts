// Cálculo de caudal según el módulo de dotación de cada uso (Art. 32, Ley 7139/7140).
// Lo usan el alta y, más adelante, la ampliación / reducción.

/** Redondeo a n decimales sin los errores de coma flotante de toFixed (1.005 → 1.01). */
export function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

/** Caudal (l/s) de un uso: magnitud × dotación, con 3 decimales (lo que guarda la columna). */
export function caudalDeUso(magnitud: number, dotacion: number): number {
  return redondear(magnitud * dotacion, 3);
}

/** Suma de los caudales de los usos, con 2 decimales (igual que muestra el formulario). */
export function caudalTotal(caudales: number[]): number {
  return redondear(caudales.reduce((acc, c) => acc + c, 0), 2);
}
