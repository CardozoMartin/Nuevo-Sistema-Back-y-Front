import { QueryFailedError } from 'typeorm';

/**
 * PostgreSQL responde con el código 23505 cuando se viola una restricción UNIQUE.
 * Sirve para el caso de dos cargas simultáneas: las dos pasan la validación previa
 * («¿ya existe?») pero la base deja guardar solo una.
 */
export function esViolacionDeUnicidad(error: unknown, restriccion?: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint } = error.driverError as { code?: string; constraint?: string };
  return code === '23505' && (!restriccion || constraint === restriccion);
}
