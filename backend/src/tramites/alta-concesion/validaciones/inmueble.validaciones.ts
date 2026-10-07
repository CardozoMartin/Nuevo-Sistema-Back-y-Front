// Reglas del paso 4 (datos catastrales y registro de dominio). Funciones puras.
import { BadRequestException } from '@nestjs/common';

/** El año de inscripción del dominio no puede ser futuro (el mínimo, 1900, lo controla el DTO). */
export function exigirAnioDominioNoFuturo(anio: number | undefined, hoy = new Date()): void {
  if (anio && anio > hoy.getFullYear()) throw new BadRequestException('El año de dominio no puede ser futuro.');
}
