// Teléfono de contacto: el mismo criterio que el frontend (src/lib/validaciones.ts).
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Solo números, espacios, guiones, paréntesis y «+», con entre 7 y 15 números:
 * «(0381) 452-6393», «+54 9 381 123-4567».
 */
export function esTelefonoValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '').length;
  return /^[\d\s()+-]+$/.test(valor) && digitos >= 7 && digitos <= 15;
}

export function EsTelefono(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'esTelefono',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: 'Ingrese un teléfono válido (entre 7 y 15 números, con código de área).', ...opciones },
      validator: {
        validate: (valor: unknown) => typeof valor === 'string' && esTelefonoValido(valor),
      },
    });
}
