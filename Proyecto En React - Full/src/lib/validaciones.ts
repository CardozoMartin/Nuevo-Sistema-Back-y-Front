const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/** Valida el dígito verificador de un CUIT/CUIL (11 dígitos, sin guiones). */
export function esCuitValido(valor: string): boolean {
  if (!/^\d{11}$/.test(valor)) return false
  const digitos = [...valor].map(Number)
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * digitos[i], 0)
  const resto = 11 - (suma % 11)
  const verificador = resto === 11 ? 0 : resto
  return verificador !== 10 && verificador === digitos[10]
}

/** 'AAAA-MM-DD' (valor de <input type="date">) posterior a hoy. */
export function esFechaFutura(fecha: string): boolean {
  return fecha > new Date().toISOString().slice(0, 10)
}

/**
 * Coordenadas POSGAR 2007 faja 3 (EPSG:5345) válidas para Tucumán, en metros. Mismo rango que
 * el backend (RANGO_POSGAR de concesiones.constantes.ts).
 */
export const RANGO_POSGAR_TUCUMAN = { x: { min: 3_400_000, max: 3_750_000 }, y: { min: 6_800_000, max: 7_200_000 } } as const

const miles = (n: number) => n.toLocaleString('es-AR')

/** Valida una X o Y POSGAR (metros, hasta 2 decimales). Devuelve el mensaje de error o null. */
export function validarPosgar(valor: string, eje: 'x' | 'y', contexto: string): string | null {
  const nombre = eje.toUpperCase()
  if (!valor) return `Ingrese la ${nombre} POSGAR ${contexto}.`
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) return `La ${nombre} POSGAR va en metros, sin puntos de miles (hasta 2 decimales).`
  const n = Number(valor)
  const { min, max } = RANGO_POSGAR_TUCUMAN[eje]
  if (n < min || n > max) {
    const otra = RANGO_POSGAR_TUCUMAN[eje === 'x' ? 'y' : 'x']
    if (n >= otra.min && n <= otra.max) return `Ese valor parece la ${eje === 'x' ? 'Y' : 'X'}: ¿están invertidas?`
    return `La ${nombre} POSGAR (faja 3) en Tucumán va de ${miles(min)} a ${miles(max)}.`
  }
  return null
}
