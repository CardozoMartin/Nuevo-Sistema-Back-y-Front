import { BadRequestException, Injectable } from '@nestjs/common';
import type { MultiPolygon } from 'geojson';
import { DataSource, type EntityManager } from 'typeorm';
import { errorPuntoConvertido } from '../comun/validadores/posgar-faja3.js';
import { detectarSistema, NOMBRE_SISTEMA, SistemaCoordenadas } from './kml/sistema-coordenadas.js';
import { DISTANCIA_MAX_CAUCE_M, DISTANCIA_MAX_PUNTO_M, LIMITES_TUCUMAN, SRID_POSGAR, SRID_WGS84, TOLERANCIA_SUPERPOSICION_M2 } from './sig.constantes.js';

/** Geometría lista para analizar y guardar: en WGS84, con el sistema en que vino el archivo. */
export interface GeometriaNormalizada {
  geometria: MultiPolygon;
  /** POSGAR_FAJA3, WGS84 o «EPSG:nnnn» si el archivo declaró otro sistema (ej: Campo Inchauspe). */
  sistemaOrigen: string;
  /** Nombre legible del sistema de origen (para mostrarlo). */
  sistemaOrigenNombre: string;
  avisos: string[];
}

/**
 * Un punto cargado a mano (desagüe, punto de entrega, pozo), en uno de los dos sistemas que
 * se aceptan: X/Y POSGAR 2007 faja 3 (metros) o latitud/longitud (grados decimales).
 */
export interface CoordenadaCargada {
  x?: number | null;
  y?: number | null;
  latitud?: number | null;
  longitud?: number | null;
}

/** El punto con sus dos formas: la cargada (tal cual) y la calculada por PostGIS. */
export interface PuntoNormalizado {
  sistema: SistemaCoordenadas;
  /** POSGAR 2007 faja 3, en metros (2 decimales = 1 cm). */
  x: number;
  y: number;
  /** WGS84, en grados (6 decimales ≈ 10 cm). */
  latitud: number;
  longitud: number;
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
  /** Río o canal activo más cercano (capa sig.cauce). null si la capa no está cargada. */
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

const redondear = (n: number | string, decimales: number) => Number(Number(n).toFixed(decimales));

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
  async normalizar(geometria: MultiPolygon, tx: EntityManager = this.dataSource.manager, sridDeclarado?: number): Promise<GeometriaNormalizada> {
    //1.- El archivo declara un sistema que no es ni POSGAR 2007 ni WGS84 (ej: Campo Inchauspe):
    //    se transforma con PostGIS, que conoce todos los sistemas EPSG.
    if (sridDeclarado && sridDeclarado !== SRID_WGS84 && sridDeclarado !== SRID_POSGAR) return this.desdeSistemaDeclarado(geometria, sridDeclarado, tx);

    //2.- Se reconoce el sistema por el tamaño de los números (y se corrigen los ejes invertidos).
    const deteccion = detectarSistema(geometria);

    //3.- Si el archivo declaró POSGAR 2007 o WGS84, los números tienen que coincidir.
    const declarado = sridDeclarado === SRID_POSGAR ? SistemaCoordenadas.POSGAR_FAJA3 : sridDeclarado === SRID_WGS84 ? SistemaCoordenadas.WGS84 : undefined;
    if (declarado && declarado !== deteccion.sistema) {
      throw new BadRequestException(
        `El archivo declara ${NOMBRE_SISTEMA[declarado]}, pero sus coordenadas están en ${NOMBRE_SISTEMA[deteccion.sistema]}. ` +
          'Revise en QGIS el sistema de referencia de la capa antes de exportarla.',
      );
    }

    //4.- WGS84 queda igual; POSGAR se pasa a WGS84.
    const base = { sistemaOrigen: deteccion.sistema, sistemaOrigenNombre: NOMBRE_SISTEMA[deteccion.sistema], avisos: deteccion.avisos };
    if (deteccion.sistema === SistemaCoordenadas.WGS84) return { ...base, geometria: deteccion.geometria };
    const [fila] = await tx.query(
      `SELECT ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_POSGAR}), ${SRID_WGS84}), 10)::json AS geojson`,
      [JSON.stringify(deteccion.geometria)],
    );
    return { ...base, geometria: fila.geojson as MultiPolygon };
  }

  /**
   * Junta las partes de un MultiPolygon que comparten linderos (parcelas vecinas de una misma
   * concesión). PostGIS no acepta un MultiPolygon con dos partes que comparten un borde; unidas,
   * la superficie es la misma. Sirve en cualquier sistema de coordenadas (no transforma nada).
   * Devuelve la geometría y cuántas partes quedaron.
   */
  async unirPartes(geometria: MultiPolygon, tx: EntityManager = this.dataSource.manager): Promise<{ geometria: MultiPolygon; partes: number }> {
    if (geometria.coordinates.length < 2) return { geometria, partes: geometria.coordinates.length };
    const [fila] = await tx.query(
      `SELECT ST_AsGeoJSON(u, 10)::json AS geojson, ST_NumGeometries(u) AS partes
         FROM (SELECT ST_Multi(ST_UnaryUnion(ST_GeomFromGeoJSON($1))) AS u) x`,
      [JSON.stringify(geometria)],
    );
    return { geometria: fila.geojson as MultiPolygon, partes: Number(fila.partes) };
  }

  /**
   * Geometría en un sistema declarado por el archivo, distinto de POSGAR 2007 y de WGS84.
   *   1. Tiene que ser un sistema que PostGIS conozca (spatial_ref_sys).
   *   2. Se transforma a WGS84 con el cambio de datum que corresponda (Campo Inchauspe → ~225 m).
   *   3. Si los números no tenían nada que ver con ese sistema, lo detecta después
   *      `analizar` (el polígono cae fuera de Tucumán).
   */
  private async desdeSistemaDeclarado(geometria: MultiPolygon, srid: number, tx: EntityManager): Promise<GeometriaNormalizada> {
    const [sistema] = await tx.query(`SELECT split_part(srtext, '"', 2) AS nombre FROM spatial_ref_sys WHERE srid = $1`, [srid]);
    if (!sistema) throw new BadRequestException(`El archivo declara el sistema EPSG:${srid}, que no se reconoce. Expórtelo en EPSG:5345 (POSGAR 2007 faja 3).`);
    const [fila] = await tx.query(`SELECT ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), $2::int), ${SRID_WGS84}), 10)::json AS geojson`, [
      JSON.stringify(geometria),
      srid,
    ]);
    const nombre = `${sistema.nombre} (EPSG:${srid})`;
    return {
      geometria: fila.geojson as MultiPolygon,
      sistemaOrigen: `EPSG:${srid}`,
      sistemaOrigenNombre: nombre,
      avisos: [`El archivo está en ${nombre}: se transformó a POSGAR 2007 faja 3, el sistema oficial.`],
    };
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
       SELECT c.nombre, c.tipo, ST_Distance(c.geom, g.geom) AS m FROM sig.cauce c, g WHERE c.activo ORDER BY ST_Distance(c.geom, g.geom) LIMIT 1`,
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

  /**
   * Un punto cargado a mano en X/Y POSGAR o en latitud/longitud → las dos formas, para
   * guardarlas juntas. La conversión la hace PostGIS (la misma que usa QGIS). Es el criterio
   * único para todos los puntos del sistema: desagüe, punto de entrega y pozos.
   */
  async normalizarPunto(c: CoordenadaCargada, tx: EntityManager = this.dataSource.manager): Promise<PuntoNormalizado> {
    const tieneXY = c.x != null || c.y != null;
    const tieneGrados = c.latitud != null || c.longitud != null;

    //1.- Se valida que venga un solo sistema y completo.
    if (tieneXY && tieneGrados) throw new BadRequestException('Cargue la coordenada en X/Y POSGAR o en latitud/longitud, no en las dos.');
    if (tieneGrados ? c.latitud == null || c.longitud == null : c.x == null || c.y == null) {
      throw new BadRequestException('Falta una de las dos coordenadas del punto.');
    }

    //2.- PostGIS calcula la otra forma.
    if (tieneGrados) {
      const [f] = await tx.query(`SELECT ST_X(p) AS x, ST_Y(p) AS y FROM ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), ${SRID_WGS84}), ${SRID_POSGAR}) AS p`, [c.longitud, c.latitud]);
      return { sistema: SistemaCoordenadas.WGS84, x: redondear(f.x, 2), y: redondear(f.y, 2), latitud: redondear(c.latitud!, 6), longitud: redondear(c.longitud!, 6) };
    }
    const [f] = await tx.query(`SELECT ST_Y(p) AS lat, ST_X(p) AS lon FROM ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), ${SRID_POSGAR}), ${SRID_WGS84}) AS p`, [c.x, c.y]);

    //3.- Lo convertido tiene que caer en Tucumán (regla compartida con el frontend).
    const fuera = errorPuntoConvertido(Number(f.lat), Number(f.lon));
    if (fuera) throw new BadRequestException(fuera);
    return { sistema: SistemaCoordenadas.POSGAR_FAJA3, x: c.x!, y: c.y!, latitud: redondear(f.lat, 6), longitud: redondear(f.lon, 6) };
  }

  /**
   * Desagüe y punto de entrega lejos del polígono de la concesión: casi siempre es una
   * coordenada mal tipeada. Devuelve un aviso por punto (vacío si están bien o si todavía no
   * hay polígono). Se mide en POSGAR (metros); 0 si el punto está dentro del polígono.
   */
  async avisosPuntosLejanos(concesionId: string, tx: EntityManager = this.dataSource.manager): Promise<string[]> {
    const filas: { tipo: string; x: string; y: string; m: number }[] = await tx.query(
      `SELECT pt.tipo, pt.coord_x AS x, pt.coord_y AS y, ST_Distance(pt.geom, p.geom) AS m
         FROM con_punto pt
         JOIN con_poligono p ON p.concesion_id = pt.concesion_id AND p.vigente
        WHERE pt.concesion_id = $1 AND pt.vigente AND pt.geom IS NOT NULL
          AND ST_Distance(pt.geom, p.geom) > $2
        ORDER BY pt.tipo`,
      [concesionId, DISTANCIA_MAX_PUNTO_M],
    );
    const km = (m: number) => (m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 });
    return filas.map(
      (f) =>
        `El ${f.tipo === 'DESAGUE' ? 'punto de desagüe' : 'punto de entrega'} (X ${Number(f.x).toLocaleString('es-AR')}, Y ${Number(f.y).toLocaleString('es-AR')}) ` +
        `está a ${km(Number(f.m))} km del polígono de la concesión: verifique las coordenadas.`,
    );
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
