// Reglas del paso 2 (titulares y domicilios). Funciones puras.
import { BadRequestException } from '@nestjs/common';

/** Un mismo documento no puede figurar dos veces como titular de la concesión. */
export function exigirDocumentosSinRepetir(titulares: { documento: string }[]): void {
  const documentos = titulares.map((t) => t.documento);
  const repetido = documentos.find((d, i) => documentos.indexOf(d) !== i);
  if (repetido) throw new BadRequestException(`El documento ${repetido} está cargado en más de un titular.`);
}
