// Lectura de archivos GeoJSON (exportados de QGIS, AutoCAD Map, geojson.io…) con el mismo
// resultado que leerKml: todos los polígonos en un MultiPolygon 2D, con avisos de lo que se ignoró.
//
// Sistema de coordenadas:
//   - Si el archivo DECLARA su sistema (miembro «crs», lo agrega QGIS al exportar en POSGAR),
//     se respeta: queda en `sridDeclarado` y GeometriaService lo transforma con PostGIS.
//     Así un archivo en Campo Inchauspe (el sistema viejo) no se confunde con POSGAR 2007:
//     en Tucumán están corridos unos 225 m y los números se parecen.
//   - Si no declara nada, se asume lo que diga el tamaño de los números (POSGAR o lat/long).
import { BadRequestException } from '@nestjs/common';
import type { Geometry, GeoJSON, Position } from 'geojson';
import type { KmlLeido } from './leer-kml.js';
import { sridDeclarado } from './sistema-coordenadas.js';

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
  //1.- JSON.
  let dato: GeoJSON & { crs?: unknown };
  try {
    dato = JSON.parse(contenido.toString('utf8')) as GeoJSON & { crs?: unknown };
  } catch {
    throw new BadRequestException('El archivo no es un GeoJSON válido (el JSON está dañado o incompleto).');
  }

  //2.- El sistema de coordenadas que declara (si declara uno).
  const srid = sridDeclarado(dato?.crs);

  //3.- FeatureCollection → Feature → Geometry.
  const features =
    dato?.type === 'FeatureCollection' ? dato.features : dato?.type === 'Feature' ? [dato] : dato?.type ? [{ type: 'Feature', geometry: dato as Geometry, properties: {} }] : [];

  //4.- Se juntan los polígonos, sus nombres y los números de concesión que traiga cada uno.
  const poligonos: Position[][][] = [];
  const nombres: string[] = [];
  const numerosConcesion = new Set<string>();
  const ignorados: string[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    const antes = poligonos.length;
    ignorados.push(...juntar(f.geometry, poligonos));
    if (poligonos.length === antes) continue;
    const propiedades = (f.properties ?? {}) as Record<string, unknown>;
    // Las capas de la DRH traen el número en la propiedad «concesion» (ej: C.2480.geojson).
    const numero = propiedades.concesion ?? propiedades.CONCESION;
    if (numero != null && String(numero).trim()) numerosConcesion.add(String(numero).trim().replace(/^0+(?=\d)/, ''));
    // Nombre del polígono: «name» (QGIS, geojson.io), «nombre», o el número de concesión.
    const nombre = propiedades.name ?? propiedades.nombre ?? (numero != null ? `Concesión ${numero}` : undefined);
    if (typeof nombre === 'string' && nombre.trim()) nombres.push(nombre.trim());
  }

  //5.- Avisos de lo que se ignoró.
  if (!poligonos.length) throw new BadRequestException('El GeoJSON no tiene ningún polígono.');
  const avisos: string[] = [];
  if (ignorados.length) avisos.push(`Se ignoraron ${ignorados.length} elemento(s) que no son polígonos (${[...new Set(ignorados)].join(', ')}).`);
  if (poligonos.length > 1) avisos.push(`El archivo tiene ${poligonos.length} polígonos: se guardan juntos como una concesión de varias partes.`);
  return { geometria: { type: 'MultiPolygon', coordinates: poligonos }, nombres, avisos, sridDeclarado: srid, numerosConcesion: [...numerosConcesion] };
}
