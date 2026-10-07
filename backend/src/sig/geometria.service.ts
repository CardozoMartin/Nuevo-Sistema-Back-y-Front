import { BadRequestException, Injectable } from '@nestjs/common';
import type { MultiPolygon } from 'geojson';
import { DataSource, type EntityManager } from 'typeorm';
import { detectarSistema, NOMBRE_SISTEMA, SistemaCoordenadas } from './kml/sistema-coordenadas.js';
import { DISTANCIA_MAX_CAUCE_M, LIMITES_TUCUMAN, SRID_POSGAR, SRID_WGS84, TOLERANCIA_SUPERPOSICION_M2 } from './sig.constantes.js';

/** Geometría lista para analizar y guardar: en WGS84, con el sistema en que vino el archivo. */
export interface GeometriaNormalizada {
  geometria: MultiPolygon;
  sistemaOrigen: SistemaCoordenadas;
  /** Nombre legible del sistema de origen (para mostrarlo). */
  sistemaOrigenNombre: string;
  avisos: string[];
}

/** Otra concesión cuyo polígono vigente se superpone con el analizado. */
export interface Superposicion {
  concesionId: string;
  numero: string | null;
  estado: string;
  /** NULL si la concesión es migrada (sin expediente digital). */
  expediente: string | null;
  titular: string | null;
  /** Superficie en común (ha). */
  superficieHa: number;
}

export interface AnalisisGeometria {
  /** La geometría tal como se va a guardar, devuelta en WGS84 para mostrarla en el mapa. */
  geojson: MultiPolygon;
  superficieHa: number;
  perimetroM: number;
  /** Un punto garantizado dentro del polígono (para etiquetas y para centrar el mapa). */
  puntoInterior: { latitud: number; longitud: number };
  /** Coordenadas POSGAR del punto interior (las que usa la oficina en los papeles). */
  puntoInteriorPosgar: { x: number; y: number };
  superposiciones: Superposicion[];
  /** Río o canal más cercano (capa sig.cauce). null si la capa no está cargada. */
  cauceCercano: { nombre: string | null; tipo: 'RIO' | 'CANAL'; distanciaM: number } | null;
}

/**
 * Aviso si la concesión queda lejos de todo río o canal: las concesiones están a la vera de
 * los cauces, así que probablemente el polígono está mal ubicado. null si está bien.
 */
export function avisoLejosDelCauce(analisis: Pick<AnalisisGeometria, 'cauceCercano'>): string | null {
  const c = analisis.cauceCercano;
  if (!c || c.distanciaM <= DISTANCIA_MAX_CAUCE_M) return null;
  const nombre = c.nombre ?? (c.tipo === 'CANAL' ? 'un canal sin nombre' : 'un cauce sin nombre');
  return `El polígono está a ${(c.distanciaM / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km del río o canal más cercano (${nombre}). Las concesiones van a la vera de los cauces: verifique la ubicación.`;
}

/** Traducción de los motivos de invalidez que devuelve GEOS (ST_IsValidDetail). */
const MOTIVOS: [RegExp, string][] = [
  [/self-intersection/i, 'el borde del polígono se cruza consigo mismo (autointersección)'],
  [/ring self-intersection/i, 'un anillo del polígono se toca a sí mismo'],
  [/too few points/i, 'el polígono tiene menos de 3 vértices distintos'],
  [/hole lies outside shell/i, 'un hueco (isla interior) queda fuera del polígono'],
  [/nested holes/i, 'hay huecos dentro de otros huecos'],
  [/interior is disconnected/i, 'el interior del polígono queda dividido en partes'],
  [/nested shells/i, 'hay un polígono dentro de otro en el mismo archivo'],
  [/duplicate rings/i, 'hay anillos repetidos'],
  [/invalid coordinate/i, 'hay coordenadas inválidas'],
  [/ring is not closed/i, 'un anillo no está cerrado (el último vértice no coincide con el primero)'],
];

/**
 * Operaciones geográficas sobre PostGIS. Todo el cálculo lo hace la base (no JavaScript):
 * PostGIS es la referencia, y es lo mismo que va a ver QGIS.
 */
@Injectable()
export class GeometriaService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Lleva una geometría leída de un archivo a WGS84, que es lo que reciben `analizar` y el
   * guardado (ellos la pasan a POSGAR para medir y guardar).
   *   - POSGAR 2007 faja 3 (EPSG:5345), el sistema de la oficina: PostGIS la transforma.
   *   - WGS84 (el estándar de KML/GeoJSON): queda igual.
   *   - Con los ejes invertidos: se corrigen y se avisa.
   * La ida y vuelta POSGAR → WGS84 → POSGAR conserva la posición con error de décimas de mm.
   */
  async normalizar(geometria: MultiPolygon, tx: EntityManager = this.dataSource.manager): Promise<GeometriaNormalizada> {
    const deteccion = detectarSistema(geometria);
    const base = { sistemaOrigen: deteccion.sistema, sistemaOrigenNombre: NOMBRE_SISTEMA[deteccion.sistema], avisos: deteccion.avisos };
    if (deteccion.sistema === SistemaCoordenadas.WGS84) return { ...base, geometria: deteccion.geometria };
    const [fila] = await tx.query(
      `SELECT ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_POSGAR}), ${SRID_WGS84}), 10)::json AS geojson`,
      [JSON.stringify(deteccion.geometria)],
    );
    return { ...base, geometria: fila.geojson as MultiPolygon };
  }

  /**
   * Analiza un polígono que entra en WGS84 (el de un KML):
   *   1. Validez geométrica (si no es válido, 400 con el motivo y el lugar).
   *   2. Que caiga dentro de Tucumán (detecta coordenadas invertidas u otro sistema).
   *   3. Superficie y perímetro, calculados en POSGAR 07 (metros reales).
   *   4. Superposición con los polígonos vigentes de otras concesiones.
   *
   * No guarda nada. `excluirConcesionId`: la propia concesión (si se está reemplazando su polígono).
   */
  async analizar(geometria: MultiPolygon, excluirConcesionId?: string, tx: EntityManager = this.dataSource.manager): Promise<AnalisisGeometria> {
    const geojson = JSON.stringify(geometria);

    // Paso 1: validez.
    const [validez] = await tx.query(
      `SELECT (d).valid AS valida, (d).reason AS motivo, ST_X((d).location) AS lon, ST_Y((d).location) AS lat
         FROM (SELECT ST_IsValidDetail(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84})) AS d) x`,
      [geojson],
    );
    if (!validez.valida) {
      const motivo = MOTIVOS.find(([patron]) => patron.test(validez.motivo ?? ''))?.[1] ?? `geometría inválida (${validez.motivo})`;
      const lugar = validez.lat !== null ? ` cerca de ${Number(validez.lat).toFixed(6)}, ${Number(validez.lon).toFixed(6)}` : '';
      throw new BadRequestException(`El polígono no es válido: ${motivo}${lugar}. Corríjalo en Google Earth o QGIS y vuelva a cargarlo.`);
    }

    // Pasos 2 y 3: ubicación, superficie y perímetro (en POSGAR).
    const { oeste, sur, este, norte } = LIMITES_TUCUMAN;
    const [medidas] = await tx.query(
      `WITH g AS (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84})) AS wgs),
            p AS (SELECT wgs, ST_Transform(wgs, ${SRID_POSGAR}) AS posgar FROM g)
       SELECT ST_Within(wgs, ST_MakeEnvelope($2, $3, $4, $5, ${SRID_WGS84})) AS en_tucuman,
              ST_Area(posgar) / 10000 AS hectareas,
              ST_Perimeter(posgar) AS perimetro,
              ST_AsGeoJSON(wgs, 7)::json AS geojson,
              ST_Y(ST_PointOnSurface(wgs)) AS lat, ST_X(ST_PointOnSurface(wgs)) AS lon,
              ST_X(ST_PointOnSurface(posgar)) AS x, ST_Y(ST_PointOnSurface(posgar)) AS y
         FROM p`,
      [geojson, oeste, sur, este, norte],
    );
    if (!medidas.en_tucuman) {
      throw new BadRequestException(
        `El polígono cae fuera de la provincia de Tucumán (punto interior: ${Number(medidas.lat).toFixed(5)}, ${Number(medidas.lon).toFixed(5)}). ` +
          'Revise que el KML esté en latitud/longitud WGS84 y que las coordenadas no estén invertidas.',
      );
    }
    if (Number(medidas.hectareas) <= 0) throw new BadRequestException('El polígono no tiene superficie.');

    // Paso 4: superposiciones.
    const superposiciones = await this.superposiciones(tx, geojson, excluirConcesionId);

    // Paso 5: río o canal más cercano (las concesiones van a la vera de los cauces).
    const [cauce] = await tx.query(
      `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84}), ${SRID_POSGAR}) AS geom)
       SELECT c.nombre, c.tipo, ST_Distance(c.geom, g.geom) AS m FROM sig.cauce c, g ORDER BY ST_Distance(c.geom, g.geom) LIMIT 1`,
      [geojson],
    );

    return {
      geojson: medidas.geojson,
      superficieHa: Number(Number(medidas.hectareas).toFixed(4)),
      perimetroM: Number(Number(medidas.perimetro).toFixed(2)),
      puntoInterior: { latitud: Number(medidas.lat), longitud: Number(medidas.lon) },
      puntoInteriorPosgar: { x: Number(Number(medidas.x).toFixed(2)), y: Number(Number(medidas.y).toFixed(2)) },
      superposiciones,
      cauceCercano: cauce ? { nombre: cauce.nombre, tipo: cauce.tipo, distanciaM: Math.round(Number(cauce.m)) } : null,
    };
  }

  /** Superposiciones del polígono vigente YA GUARDADO de una concesión (para mostrarlas al consultarla). */
  async superposicionesDeConcesion(concesionId: string, tx: EntityManager = this.dataSource.manager): Promise<Superposicion[]> {
    const filas: Record<string, unknown>[] = await tx.query(
      `SELECT v.concesion_id, v.numero, v.estado, v.expediente, v.titular,
              ST_Area(ST_Intersection(v.geom, p.geom)) AS m2
         FROM con_poligono p
         JOIN sig.v_concesiones v ON v.geom && p.geom AND ST_Intersects(v.geom, p.geom)
        WHERE p.concesion_id = $1 AND p.vigente
          AND v.concesion_id <> $1
          AND ST_Area(ST_Intersection(v.geom, p.geom)) > $2
        ORDER BY m2 DESC`,
      [concesionId, TOLERANCIA_SUPERPOSICION_M2],
    );
    return filas.map(aSuperposicion);
  }

  /**
   * Concesiones (no anuladas) cuyo polígono vigente se superpone con la geometría dada.
   * `&&` usa el índice espacial para descartar rápido; ST_Intersection mide lo compartido.
   * Bordes que solo se tocan (área 0) no cuentan.
   */
  private async superposiciones(tx: EntityManager, geojson: string, excluirConcesionId?: string): Promise<Superposicion[]> {
    const filas: Record<string, unknown>[] = await tx.query(
      `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84}), ${SRID_POSGAR}) AS geom)
       SELECT v.concesion_id, v.numero, v.estado, v.expediente, v.titular,
              ST_Area(ST_Intersection(v.geom, g.geom)) AS m2
         FROM sig.v_concesiones v, g
        WHERE v.geom && g.geom
          AND ST_Intersects(v.geom, g.geom)
          AND ($2::bigint IS NULL OR v.concesion_id <> $2::bigint)
          AND ST_Area(ST_Intersection(v.geom, g.geom)) > $3
        ORDER BY m2 DESC`,
      [geojson, excluirConcesionId ?? null, TOLERANCIA_SUPERPOSICION_M2],
    );
    return filas.map(aSuperposicion);
  }
}

const aSuperposicion = (f: Record<string, unknown>): Superposicion => ({
  concesionId: String(f.concesion_id),
  numero: (f.numero as string | null) ?? null,
  estado: String(f.estado),
  expediente: (f.expediente as string | null) ?? null,
  titular: (f.titular as string | null) ?? null,
  superficieHa: Number((Number(f.m2) / 10000).toFixed(4)),
});
