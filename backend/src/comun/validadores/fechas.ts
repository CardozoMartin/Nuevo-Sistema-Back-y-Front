import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Hoy en formato AAAA-MM-DD, en la hora de Tucumán (no en UTC, que adelanta 3 horas). */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Tucuman' }).format(new Date());
}

/**
 * Decorador para DTOs: la fecha (AAAA-MM-DD) no puede ser posterior a hoy.
 * Se usa en fecha de nacimiento y de constitución de los titulares.
 */
export function NoEsFechaFutura(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'noEsFechaFutura',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: 'La fecha no puede ser futura.', ...opciones },
      validator: {
        validate: (valor: unknown) => typeof valor !== 'string' || valor <= hoyISO(),
      },
    });
}
