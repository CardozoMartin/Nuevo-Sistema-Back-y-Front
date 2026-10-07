// Lectura de archivos GeoJSON (exportados de QGIS, geojson.io…) con el mismo resultado que
// leerKml: todos los polígonos en un MultiPolygon 2D, con avisos de lo que se ignoró.
//
// Se asume WGS84 (lo exige el estándar GeoJSON, RFC 7946). Si el archivo trae otro sistema
// (por ejemplo POSGAR exportado de QGIS sin reproyectar), la validación de «dentro de
// Tucumán» lo detecta porque las coordenadas son millones de metros.
import { BadRequestException } from '@nestjs/common';
import type { Geometry, GeoJSON, Position } from 'geojson';
import type { KmlLeido } from './leer-kml.js';

const a2D = (p: Position): Position => [p[0], p[1]];

function juntar(g: Geometry, destino: Position[][][]): string[] {
  switch (g.type) {
    case 'Polygon':
      destino.push(g.coordinates.map((anillo) => anillo.map(a2D)));
      return [];
    case 'MultiPolygon':
      destino.push(...g.coordinates.map((p) => p.map((anillo) => anillo.map(a2D))));
      return [];
    case 'GeometryCollection':
      return g.geometries.flatMap((x) => juntar(x, destino));
    default:
      return [g.type];
  }
}

export function leerGeoJson(contenido: Buffer): KmlLeido {
  let dato: GeoJSON;
  try {
    dato = JSON.parse(contenido.toString('utf8')) as GeoJSON;
  } catch {
    throw new BadRequestException('El archivo no es un GeoJSON válido (el JSON está dañado o incompleto).');
  }

  // FeatureCollection → Feature → Geometry.
  const features =
    dato?.type === 'FeatureCollection' ? dato.features : dato?.type === 'Feature' ? [dato] : dato?.type ? [{ type: 'Feature', geometry: dato as Geometry, properties: {} }] : [];

  const poligonos: Position[][][] = [];
  const nombres: string[] = [];
  const ignorados: string[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    const antes = poligonos.length;
    ignorados.push(...juntar(f.geometry, poligonos));
    const propiedades = (f.properties ?? {}) as Record<string, unknown>;
    // Nombre del polígono: «name» (QGIS, geojson.io), «nombre», o el número de concesión que
    // traen las capas de la DRH (propiedad «concesion»).
    const nombre = propiedades.name ?? propiedades.nombre ?? (propiedades.concesion != null ? `Concesión ${propiedades.concesion}` : undefined);
    if (poligonos.length > antes && typeof nombre === 'string' && nombre.trim()) nombres.push(nombre.trim());
  }

  if (!poligonos.length) throw new BadRequestException('El GeoJSON no tiene ningún polígono.');
  const avisos: string[] = [];
  if (ignorados.length) avisos.push(`Se ignoraron ${ignorados.length} elemento(s) que no son polígonos (${[...new Set(ignorados)].join(', ')}).`);
  if (poligonos.length > 1) avisos.push(`El archivo tiene ${poligonos.length} polígonos: se guardan juntos como una concesión de varias partes.`);
  return { geometria: { type: 'MultiPolygon', coordinates: poligonos }, nombres, avisos };
}
