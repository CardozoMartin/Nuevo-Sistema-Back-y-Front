// Validación del dígito verificador de CUIT / CUIL (algoritmo módulo 11 de AFIP/ARCA).
// Es el mismo algoritmo que usa el frontend en src/lib/validaciones.ts.

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** true si son 11 dígitos (sin guiones) y el último es el verificador correcto. */
export function esCuitValido(valor: string): boolean {
  if (!/^\d{11}$/.test(valor)) return false;
  const digitos = [...valor].map(Number);

  // Paso 1: se multiplica cada uno de los primeros 10 dígitos por su peso y se suma.
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * digitos[i], 0);

  // Paso 2: el verificador es 11 menos el resto de dividir por 11.
  //   resto 11 → verificador 0; resto 10 → el número no es válido.
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === digitos[10];
}

/** Deja solo los dígitos: "30-71234567-8" → "30712345678". */
export const soloDigitos = (valor: string) => valor.replace(/\D/g, '');
