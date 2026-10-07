// Reglas del paso 6 (suministro). Funciones puras.
import { BadRequestException } from '@nestjs/common';

/**
 * La cascada se completa en orden: no hay canal secundario sin principal, ni terciario (o
 * siguientes) sin secundario.
 */
export function exigirCascadaEnOrden(s: { canalPrincipal?: string; canalSecundario?: string; canalesAdicionales?: string[] }): void {
  if (s.canalSecundario && !s.canalPrincipal) {
    throw new BadRequestException('Seleccione el canal principal antes que el secundario.');
  }
  if (s.canalesAdicionales?.length && !s.canalSecundario) {
    throw new BadRequestException('Seleccione el canal secundario antes que los canales siguientes.');
  }
}
