// Detección del sistema de coordenadas de un archivo geográfico.
//
// La oficina trabaja en POSGAR 2007 / Argentina faja 3 (EPSG:5345): X (este) empieza con 3 e
// Y (norte) con 7, en metros. Es lo que exportan sus programas y lo que figura en los papeles.
// El estándar KML (y GeoJSON) en cambio exige latitud/longitud WGS84. Se aceptan los dos: el
// sistema se reconoce por el tamaño de los números, que no se pueden confundir:
//
//   POSGAR faja 3   X ≈ 3.400.000 a 3.750.000     Y ≈ 6.800.000 a 7.200.000   (Tucumán)
//   WGS84           longitud ≈ -66 a -64          latitud ≈ -28 a -26
//
// También se reconocen los dos errores más comunes: X e Y invertidas (Y primero) y latitud y
// longitud invertidas. En esos casos se corrige y se avisa.
import { BadRequestException } from '@nestjs/common';
import type { MultiPolygon, Position } from 'geojson';

export enum SistemaCoordenadas {
  POSGAR_FAJA3 = 'POSGAR_FAJA3',
  WGS84 = 'WGS84',
}

export const NOMBRE_SISTEMA: Record<SistemaCoordenadas, string> = {
  [SistemaCoordenadas.POSGAR_FAJA3]: 'POSGAR 2007 – Gauss-Krüger faja 3 (EPSG:5345)',
  [SistemaCoordenadas.WGS84]: 'latitud/longitud WGS84 (EPSG:4326)',
};

/** Rangos para reconocer cada sistema (con margen alrededor de Tucumán). */
const POSGAR = { x: [3_000_000, 4_000_000], y: [6_000_000, 8_000_000] } as const;
const GRADOS_TUCUMAN = { lon: [-70, -60], lat: [-32, -22] } as const;

const entre = (v: number, [min, max]: readonly [number, number]) => v >= min && v <= max;

type Forma = 'posgar' | 'posgar_invertido' | 'wgs84' | 'wgs84_invertido' | 'desconocido';

function formaDe([a, b]: Position): Forma {
  if (entre(a, POSGAR.x) && entre(b, POSGAR.y)) return 'posgar';
  if (entre(a, POSGAR.y) && entre(b, POSGAR.x)) return 'posgar_invertido';
  if (entre(a, GRADOS_TUCUMAN.lon) && entre(b, GRADOS_TUCUMAN.lat)) return 'wgs84';
  if (entre(a, GRADOS_TUCUMAN.lat) && entre(b, GRADOS_TUCUMAN.lon)) return 'wgs84_invertido';
  return 'desconocido';
}

export interface Deteccion {
  sistema: SistemaCoordenadas;
  /** La geometría con los ejes en el orden correcto (X/longitud primero), todavía en su sistema. */
  geometria: MultiPolygon;
  avisos: string[];
}

/**
 * Reconoce el sistema de coordenadas de un MultiPolygon y corrige el orden de los ejes si
 * venían invertidos. Todos los vértices tienen que estar en el mismo sistema.
 */
export function detectarSistema(geometria: MultiPolygon): Deteccion {
  const vertices = geometria.coordinates.flat(2);
  const formas = new Set(vertices.map(formaDe));

  if (formas.has('desconocido')) {
    const [x, y] = vertices.find((v) => formaDe(v) === 'desconocido')!;
    throw new BadRequestException(
      `Las coordenadas del archivo no están en POSGAR 2007 faja 3 (X ≈ 3.500.000, Y ≈ 7.000.000) ni en latitud/longitud (ej: un vértice vale ${x}, ${y}). ` +
        'Revise en QGIS el sistema de referencia del archivo y expórtelo en EPSG:5345.',
    );
  }
  if (formas.size > 1) throw new BadRequestException('El archivo mezcla coordenadas en distintos sistemas (o con los ejes invertidos en algunos vértices).');

  const [forma] = formas as Set<Forma>;
  const invertir = forma === 'posgar_invertido' || forma === 'wgs84_invertido';
  const sistema = forma.startsWith('posgar') ? SistemaCoordenadas.POSGAR_FAJA3 : SistemaCoordenadas.WGS84;
  const avisos = invertir
    ? [sistema === SistemaCoordenadas.POSGAR_FAJA3 ? 'Las coordenadas venían como Y, X (invertidas): se tomaron como X, Y.' : 'Las coordenadas venían como latitud, longitud (invertidas): se corrigieron.']
    : [];
  return {
    sistema,
    geometria: invertir ? { type: 'MultiPolygon', coordinates: geometria.coordinates.map((p) => p.map((anillo) => anillo.map(([a, b]) => [b, a]))) } : geometria,
    avisos,
  };
}
