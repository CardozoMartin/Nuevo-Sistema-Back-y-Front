import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Recuadro } from './capas.service.js';
import { SRID_POSGAR, SRID_WGS84 } from './sig.constantes.js';

/** Un cauce como viene en el archivo de carga (recursos/sig/cauces-osm.json). Línea en WGS84 ([lon, lat]). */
export interface CauceArchivo {
  nombre: string | null;
  tipo: 'RIO' | 'CANAL';
  linea: [number, number][];
}

/**
 * Capa de ríos y canales (sig.cauce): la carga desde un archivo y la publica para el visor.
 * Para el visor se simplifica la línea (10 m de tolerancia): a la escala del mapa no se nota y
 * pesa mucho menos.
 */
@Injectable()
export class CaucesService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Reemplaza los cauces de una fuente por los del archivo, en una transacción. Las líneas
   * entran en WGS84 y se guardan en POSGAR 07 (EPSG:5345). Devuelve cuántos se cargaron.
   */
  async cargar(cauces: CauceArchivo[], fuente: string): Promise<number> {
    if (!Array.isArray(cauces) || !cauces.length) throw new BadRequestException('El archivo no tiene cauces.');
    return this.dataSource.transaction(async (tx) => {
      await tx.query(`DELETE FROM sig.cauce WHERE fuente = $1`, [fuente]);
      let cargados = 0;
      for (const c of cauces) {
        if (!Array.isArray(c.linea) || c.linea.length < 2) continue;
        await tx.query(
          `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84}), ${SRID_POSGAR}) AS geom)
           INSERT INTO sig.cauce (nombre, tipo, fuente, geom, largo_km)
           SELECT $2, $3, $4, geom, round((ST_Length(geom) / 1000)::numeric, 2) FROM g`,
          [JSON.stringify({ type: 'LineString', coordinates: c.linea }), c.nombre ?? null, c.tipo === 'CANAL' ? 'CANAL' : 'RIO', fuente],
        );
        cargados++;
      }
      return cargados;
    });
  }

  /** Cauces dentro del recuadro (o todos), como FeatureCollection de líneas en WGS84. */
  async capa(recuadro?: Recuadro): Promise<unknown> {
    const [fila] = await this.dataSource.query(
      `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(json_build_object(
                    'type', 'Feature',
                    'id', c.id,
                    'geometry', ST_AsGeoJSON(ST_Transform(ST_Simplify(c.geom, 10), ${SRID_WGS84}), 6)::json,
                    'properties', json_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'fuente', c.fuente, 'largo_km', c.largo_km::float8)
                  ) ORDER BY c.tipo, c.nombre), '[]'::json)
              ) AS capa
         FROM sig.cauce c
        WHERE $1::float8 IS NULL
           OR c.geom && ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, ${SRID_WGS84}), ${SRID_POSGAR})`,
      recuadro ?? [null, null, null, null],
    );
    return fila.capa;
  }
}
