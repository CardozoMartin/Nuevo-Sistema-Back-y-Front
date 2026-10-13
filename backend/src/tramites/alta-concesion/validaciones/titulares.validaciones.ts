// Reglas del paso 2 (titulares y domicilios). Funciones puras.
import { BadRequestException } from '@nestjs/common';
import { claveDeDocumento } from '../../../comun/validadores/cuit.js';

/**
 * Un mismo documento no puede figurar dos veces como titular de la concesión. Cuenta como el
 * mismo un DNI y el CUIL / CUIT que lo contiene (es la misma persona).
 */
export function exigirDocumentosSinRepetir(titulares: { documento: string }[]): void {
  const vistos = new Map<string, string>();
  for (const { documento } of titulares) {
    const clave = claveDeDocumento(documento);
    const anterior = vistos.get(clave);
    if (anterior === documento) throw new BadRequestException(`El documento ${documento} está cargado en más de un titular.`);
    if (anterior) throw new BadRequestException(`Los documentos ${anterior} y ${documento} son de la misma persona: está cargada en más de un titular.`);
    vistos.set(clave, documento);
  }
}
