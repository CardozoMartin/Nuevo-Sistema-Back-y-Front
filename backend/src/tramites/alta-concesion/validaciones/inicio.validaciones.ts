// Reglas del paso 1 (inicio del alta). Funciones puras: reciben datos y lanzan un 400 si no se cumple.
import { BadRequestException } from '@nestjs/common';
import type { SituacionLegal } from '../../../catalogos/entities/situacion-legal.entity.js';

/** El expediente tiene que ser del año en curso (decisión D5). */
export function exigirAnioEnCurso(anio: number, hoy = new Date()): void {
  if (anio !== hoy.getFullYear()) throw new BadRequestException('El expediente tiene que ser del año en curso.');
}

/** Los papeles marcados en el checklist tienen que ser de la situación legal elegida (y estar activos). */
export function exigirDocumentosDeLaSituacion(situacion: SituacionLegal, documentosMarcados: number[]): void {
  const idsValidos = new Set(situacion.documentos.filter((d) => d.activo).map((d) => d.id));
  const ajenos = documentosMarcados.filter((id) => !idsValidos.has(id));
  if (ajenos.length) {
    throw new BadRequestException(`Los documentos ${ajenos.join(', ')} no corresponden a la situación legal ${situacion.nombre}.`);
  }
}
