import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { errorEjePosgar, type EjePosgar } from './posgar-faja3.js';

/**
 * Decorador para la X o la Y POSGAR 2007 faja 3 de un punto. Aplica la regla compartida con el
 * frontend (posgar-faja3.ts): 7 cifras enteras, hasta 2 decimales y dentro de Tucumán.
 * `contexto` completa el mensaje (ej: «del desagüe»).
 */
export function EjePosgarFaja3(eje: EjePosgar, contexto = '', opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'ejePosgarFaja3',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate: (valor: unknown) => (typeof valor === 'number' || typeof valor === 'string' ? errorEjePosgar(valor, eje, contexto) === null : false),
        defaultMessage: (args: ValidationArguments) =>
          (typeof args.value === 'number' || typeof args.value === 'string' ? errorEjePosgar(args.value, eje, contexto) : null) ??
          `Ingrese la ${eje.toUpperCase()} POSGAR ${contexto} en metros.`.replace(/\s+\./, '.'),
      },
    });
}
