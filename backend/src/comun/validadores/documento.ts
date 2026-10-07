import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { esCuitValido } from './cuit.js';

/**
 * Decorador para el número de documento de un titular. Lee del mismo objeto
 * `tipoPersona` y `tipoDocumento`, y aplica la regla que corresponde:
 *   - Persona jurídica: siempre CUIT.
 *   - DNI: 7 u 8 dígitos.
 *   - CUIL / CUIT: 11 dígitos con dígito verificador correcto.
 * Devuelve un mensaje distinto según qué falló.
 */
export function DocumentoValido(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'documentoValido',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate(valor: unknown, args: ValidationArguments) {
          return mensajeDeError(valor, args.object as Persona) === null;
        },
        defaultMessage(args: ValidationArguments) {
          return mensajeDeError(args.value, args.object as Persona) ?? 'Documento inválido.';
        },
      },
    });
}

interface Persona {
  tipoPersona?: string;
  tipoDocumento?: string;
}

function mensajeDeError(valor: unknown, { tipoPersona, tipoDocumento: tipo = 'DNI' }: Persona): string | null {
  if (tipoPersona === 'JURIDICA' && tipo !== 'CUIT') return 'Una persona jurídica se identifica con CUIT.';
  if (typeof valor !== 'string' || valor === '') return `Ingrese el ${tipo}.`;
  if (!/^\d+$/.test(valor)) return `El ${tipo} solo admite números (sin puntos ni guiones).`;
  if (tipo === 'DNI') return /^\d{7,8}$/.test(valor) ? null : 'El DNI debe tener 7 u 8 números.';
  if (valor.length !== 11) return `El ${tipo} debe tener 11 números.`;
  return esCuitValido(valor) ? null : `El ${tipo} no es válido (dígito verificador incorrecto).`;
}
