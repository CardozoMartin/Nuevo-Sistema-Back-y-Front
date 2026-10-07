// Reglas del paso 5 (usos, magnitudes, desagüe y punto de entrega). Funciones puras.
import { BadRequestException } from '@nestjs/common';
import type { TipoUso } from '../../../catalogos/entities/tipo-uso.entity.js';

/** El fin del período no puede ser anterior al inicio. */
export function exigirPeriodoValido(inicio?: string, fin?: string): void {
  if (inicio && fin && fin < inicio) throw new BadRequestException('El fin del período no puede ser anterior al inicio.');
}

/** Cada tipo de uso se carga una sola vez. */
export function exigirUsosSinRepetir(codigos: string[]): void {
  const repetido = codigos.find((c, i) => codigos.indexOf(c) !== i);
  if (repetido) throw new BadRequestException(`El uso ${repetido} está cargado más de una vez.`);
}

/** Todos los usos tienen que existir en el catálogo (y estar activos). `tipos` es lo que encontró el catálogo. */
export function exigirUsosDelCatalogo(codigos: string[], tipos: Map<string, TipoUso>): void {
  const desconocidos = codigos.filter((c) => !tipos.has(c));
  if (desconocidos.length) throw new BadRequestException(`Usos inexistentes: ${desconocidos.join(', ')}.`);
}

/**
 * Si algún uso lo exige (ej: pecuario), el punto de entrega es obligatorio.
 * Devuelve los usos que lo exigen (vacío si ninguno).
 */
export function exigirPuntoEntregaSiCorresponde(tipos: TipoUso[], hayPuntoEntrega: boolean): TipoUso[] {
  const exigen = tipos.filter((t) => t.requierePuntoEntrega);
  if (exigen.length && !hayPuntoEntrega) {
    throw new BadRequestException(`Ingrese el punto de entrega del agua (lo exige el uso ${exigen.map((t) => t.nombre).join(', ')}).`);
  }
  return exigen;
}
