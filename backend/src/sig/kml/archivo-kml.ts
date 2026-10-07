// Recepción del archivo geográfico subido (multipart/form-data, campo «archivo»).
// Acepta KML (Google Earth) y GeoJSON (QGIS, geojson.io).
import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_BYTES_KML } from '../sig.constantes.js';
import { leerGeoJson } from './leer-geojson.js';
import { leerKml, type KmlLeido } from './leer-kml.js';

/** Archivo tal como lo deja multer en memoria. */
export interface ArchivoSubido {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Interceptor de Nest para un archivo en el campo «archivo», en memoria y con tope de tamaño. */
export const RecibirKml = () => FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_KML, files: 1 } });

/** Extensión con la que se guarda el original. */
export const extensionDe = (archivo: ArchivoSubido) => (/\.(geo)?json$/i.test(archivo.originalname) ? 'geojson' : 'kml');

/**
 * Controla lo básico antes de leerlo: que haya archivo, que sea .kml / .geojson / .json y
 * que no esté vacío. KMZ (KML comprimido) todavía no: TODO cuando la oficina lo necesite.
 */
export function exigirKml(archivo: ArchivoSubido | undefined): ArchivoSubido {
  if (!archivo) throw new BadRequestException('Adjunte el archivo KML o GeoJSON en el campo «archivo».');
  const nombre = archivo.originalname.toLowerCase();
  if (nombre.endsWith('.kmz')) throw new BadRequestException('Los KMZ todavía no se aceptan: exporte el polígono como .kml.');
  if (!/\.(kml|geojson|json)$/.test(nombre)) throw new BadRequestException('El archivo tiene que ser .kml o .geojson.');
  if (!archivo.size) throw new BadRequestException('El archivo está vacío.');
  return archivo;
}

/** Lee el archivo según su tipo. */
export function leerArchivoGeografico(archivo: ArchivoSubido): KmlLeido {
  return extensionDe(archivo) === 'geojson' ? leerGeoJson(archivo.buffer) : leerKml(archivo.buffer);
}
