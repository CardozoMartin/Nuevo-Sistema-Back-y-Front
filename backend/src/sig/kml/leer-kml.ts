// Lectura de archivos KML (Google Earth, QGIS, GPS…) y extracción de los polígonos.
//
// Pasos:
//   1. Se parsea el XML. Si no es un XML válido, el archivo está dañado.
//   2. togeojson convierte cada Placemark a un Feature GeoJSON.
//   3. Se juntan todos los polígonos (Polygon, MultiPolygon, o dentro de un MultiGeometry)
//      en un solo MultiPolygon: una concesión puede tener varias partes separadas.
//   4. Se descarta la altura (Z) que suelen traer los KML: la geometría se guarda en 2D.
//   5. Puntos y líneas no son la concesión: se ignoran y se avisa.
//
// La validez geométrica (anillos cerrados, sin autointersecciones…) NO se controla acá:
// la controla PostGIS en GeometriaService, que lo hace mejor.
import { BadRequestException } from '@nestjs/common';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import type { Geometry, MultiPolygon, Position } from 'geojson';

export interface KmlLeido {
  /** Todos los polígonos del archivo en un solo MultiPolygon (WGS84, 2D). */
  geometria: MultiPolygon;
  /** Nombres de los Placemark de donde salieron los polígonos. */
  nombres: string[];
  /** Cosas que se ignoraron y conviene que el usuario sepa. */
  avisos: string[];
}

/** Quita la altura: [lon, lat, z] → [lon, lat]. */
const a2D = (p: Position): Position => [p[0], p[1]];

/** Agrega a `destino` los polígonos de una geometría (recorre las colecciones). Devuelve los tipos ignorados. */
function juntarPoligonos(geometria: Geometry, destino: Position[][][]): string[] {
  switch (geometria.type) {
    case 'Polygon':
      destino.push(geometria.coordinates.map((anillo) => anillo.map(a2D)));
      return [];
    case 'MultiPolygon':
      destino.push(...geometria.coordinates.map((poligono) => poligono.map((anillo) => anillo.map(a2D))));
      return [];
    case 'GeometryCollection':
      return geometria.geometries.flatMap((g) => juntarPoligonos(g, destino));
    default:
      return [geometria.type];
  }
}

export function leerKml(contenido: Buffer): KmlLeido {
  // Paso 1: XML. xmldom avisa los errores graves con una excepción.
  let documento: ReturnType<DOMParser['parseFromString']>;
  try {
    documento = new DOMParser({ onError: (nivel, mensaje) => { if (nivel !== 'warning') throw new Error(mensaje); } })
      .parseFromString(contenido.toString('utf8'), 'text/xml');
  } catch {
    throw new BadRequestException('El archivo no es un KML válido (el XML está dañado o incompleto).');
  }
  if (!documento.getElementsByTagName('kml').length && !documento.getElementsByTagName('Placemark').length) {
    throw new BadRequestException('El archivo no es un KML: no tiene elementos <kml> ni <Placemark>.');
  }

  // Paso 2: GeoJSON.
  const colecciones = kml(documento);

  // Pasos 3 y 4: polígonos en 2D.
  const poligonos: Position[][][] = [];
  const nombres: string[] = [];
  const ignorados: string[] = [];
  for (const feature of colecciones.features) {
    if (!feature.geometry) continue;
    const antes = poligonos.length;
    ignorados.push(...juntarPoligonos(feature.geometry, poligonos));
    const nombre = feature.properties?.name;
    if (poligonos.length > antes && typeof nombre === 'string' && nombre.trim()) nombres.push(nombre.trim());
  }

  if (!poligonos.length) {
    throw new BadRequestException('El KML no tiene ningún polígono. Dibuje la concesión como polígono (no como línea o punto).');
  }

  // Paso 5: avisos.
  const avisos: string[] = [];
  if (ignorados.length) avisos.push(`Se ignoraron ${ignorados.length} elemento(s) que no son polígonos (${[...new Set(ignorados)].join(', ')}).`);
  if (poligonos.length > 1) avisos.push(`El archivo tiene ${poligonos.length} polígonos: se guardan juntos como una concesión de varias partes.`);

  return { geometria: { type: 'MultiPolygon', coordinates: poligonos }, nombres, avisos };
}
