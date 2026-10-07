import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SRID_POSGAR, SRID_WGS84 } from './sig.constantes.js';

/** Recuadro del mapa en WGS84: oeste, sur, este, norte. */
export type Recuadro = [number, number, number, number];

/**
 * Columnas de la vista que viajan como propiedades de cada Feature. Mismos nombres que
 * en QGIS, así una persona que ve la tabla de atributos en QGIS reconoce los campos.
 */
const PROPIEDADES = `json_build_object(
    'poligono_id', v.poligono_id, 'concesion_id', v.concesion_id, 'numero', v.numero,
    'estado', v.estado, 'tipo_derecho', v.tipo_derecho, 'origen', v.origen,
    'anio_otorgamiento', v.anio_otorgamiento, 'expediente', v.expediente,
    'oficina_actual', v.oficina_actual, 'titular', v.titular, 'documento', v.documento,
    'cantidad_titulares', v.cantidad_titulares, 'departamento', v.departamento,
    'localidad', v.localidad, 'distrito', v.distrito, 'cuenca', v.cuenca, 'padron', v.padron,
    'matricula_catastral', v.matricula_catastral, 'parcela', v.parcela,
    'superficie_ha', v.superficie_ha, 'caudal_lps', v.caudal_lps, 'caracter', v.caracter,
    'codigo_servicio', v.codigo_servicio, 'usos', v.usos, 'fuente', v.fuente, 'sistema', v.sistema,
    'canal_principal', v.canal_principal, 'origen_poligono', v.origen_poligono, 'poligono_desde', v.poligono_desde)`;

/** Un Feature GeoJSON por fila, con la geometría pasada a WGS84 (7 decimales ≈ 1 cm). */
const FEATURE = `json_build_object(
    'type', 'Feature',
    'id', v.concesion_id,
    'geometry', ST_AsGeoJSON(ST_Transform(v.geom, ${SRID_WGS84}), 7)::json,
    'properties', ${PROPIEDADES})`;

/** Un pozo como Feature: punto en WGS84 con los atributos de sig.v_pozos. */
const FEATURE_POZO = `json_build_object(
    'type', 'Feature',
    'id', v.pozo_id,
    'geometry', ST_AsGeoJSON(ST_Transform(v.geom, ${SRID_WGS84}), 7)::json,
    'properties', json_build_object(
        'pozo_id', v.pozo_id, 'id_interno', v.id_interno, 'alias', v.alias, 'estado', v.estado,
        'origen', v.origen, 'tipo_pozo', v.tipo_pozo, 'jurisdiccion_drh', v.jurisdiccion_drh,
        'profundidad_m', v.profundidad_m, 'nivel_estatico_m', v.nivel_estatico_m,
        'nivel_dinamico_m', v.nivel_dinamico_m, 'caudal_m3h', v.caudal_m3h, 'caudal_lps', v.caudal_lps,
        'coord_x', v.coord_x, 'coord_y', v.coord_y, 'concesion_id', v.concesion_id,
        'concesion_numero', v.concesion_numero, 'titular', v.titular, 'departamento', v.departamento,
        'localidad', v.localidad, 'dentro_de_concesion', v.dentro_de_concesion))`;

/**
 * Capas geográficas para la web, en GeoJSON. Todo el armado lo hace PostgreSQL
 * (json_build_object): no se pasa fila por fila por JavaScript.
 *
 * Para miles de polígonos el paso siguiente son vector tiles (ST_AsMVT); el formato de
 * las propiedades no cambia.
 */
@Injectable()
export class CapasService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Concesiones dentro del recuadro (o todas si no hay recuadro), como FeatureCollection.
   * `&&` compara contra el índice espacial: solo se leen los polígonos de la zona visible.
   */
  async concesiones(recuadro?: Recuadro): Promise<unknown> {
    const [fila] = await this.dataSource.query(
      `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(${FEATURE} ORDER BY v.concesion_id), '[]'::json)
              ) AS capa
         FROM sig.v_concesiones v
        WHERE $1::float8 IS NULL
           OR v.geom && ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, ${SRID_WGS84}), ${SRID_POSGAR})`,
      recuadro ?? [null, null, null, null],
    );
    return fila.capa;
  }

  /** Pozos dentro del recuadro (o todos), como FeatureCollection de puntos. */
  async pozos(recuadro?: Recuadro): Promise<unknown> {
    const [fila] = await this.dataSource.query(
      `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(${FEATURE_POZO} ORDER BY v.pozo_id), '[]'::json)
              ) AS capa
         FROM sig.v_pozos v
        WHERE $1::float8 IS NULL
           OR v.geom && ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, ${SRID_WGS84}), ${SRID_POSGAR})`,
      recuadro ?? [null, null, null, null],
    );
    return fila.capa;
  }

  /** Una concesión como Feature (404 si no tiene polígono vigente). */
  async concesion(concesionId: string): Promise<unknown> {
    const [fila] = await this.dataSource.query(`SELECT ${FEATURE} AS feature FROM sig.v_concesiones v WHERE v.concesion_id = $1`, [concesionId]);
    if (!fila) throw new NotFoundException('La concesión no existe o no tiene polígono cargado.');
    return fila.feature;
  }

  /**
   * Datos del archivo original de un polígono (el KML / GeoJSON que se presentó), para
   * descargarlo. 404 si el polígono no existe o no vino de un archivo (ej: migrado).
   */
  async archivoPoligono(poligonoId: string): Promise<{ nombre: string; ruta: string; sha256: string }> {
    const [f] = await this.dataSource.query(`SELECT archivo_nombre, archivo_ruta, archivo_sha256 FROM con_poligono WHERE id = $1`, [poligonoId]);
    if (!f) throw new NotFoundException('No se encontró el polígono.');
    if (!f.archivo_ruta) throw new NotFoundException('Este polígono no se cargó desde un archivo (por ejemplo, vino del padrón anterior).');
    return { nombre: f.archivo_nombre, ruta: f.archivo_ruta, sha256: f.archivo_sha256 };
  }

  /**
   * El polígono vigente de una concesión como KML (WGS84), para abrirlo en Google Earth o en
   * un GPS. Lleva los datos principales en la descripción. 404 si no tiene polígono.
   */
  async kmlConcesion(concesionId: string): Promise<{ nombre: string; kml: string }> {
    const [f] = await this.dataSource.query(
      `SELECT v.numero, v.expediente, v.titular, v.superficie_ha, ST_AsKML(ST_Transform(v.geom, ${SRID_WGS84}), 7) AS kml
         FROM sig.v_concesiones v WHERE v.concesion_id = $1`,
      [concesionId],
    );
    if (!f) throw new NotFoundException('La concesión no existe o no tiene polígono cargado.');
    const titulo = f.numero ? `Concesión ${f.numero}` : `Alta en trámite (expediente ${f.expediente})`;
    const detalle = [f.titular && `Titular: ${f.titular}`, f.expediente && `Expediente: ${f.expediente}`, `Superficie: ${Number(f.superficie_ha).toLocaleString('es-AR')} ha`]
      .filter(Boolean)
      .join(' · ');
    const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      nombre: f.numero ? `concesion-${f.numero}.kml` : `concesion-id-${concesionId}.kml`,
      kml:
        `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(titulo)}</name>` +
        `<Placemark><name>${xml(titulo)}</name><description>${xml(detalle)}</description>${f.kml}</Placemark></Document></kml>\n`,
    };
  }

  /** Lee "oeste,sur,este,norte" de la query string. */
  static leerRecuadro(texto?: string): Recuadro | undefined {
    if (!texto) return undefined;
    const valores = texto.split(',').map(Number);
    if (valores.length !== 4 || valores.some((v) => !Number.isFinite(v))) {
      throw new BadRequestException('bbox debe ser "oeste,sur,este,norte" en grados decimales.');
    }
    const [oeste, sur, este, norte] = valores;
    if (oeste >= este || sur >= norte) throw new BadRequestException('bbox inválido: oeste < este y sur < norte.');
    return [oeste, sur, este, norte];
  }
}
