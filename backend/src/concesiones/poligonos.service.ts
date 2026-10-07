import { Injectable } from '@nestjs/common';
import type { MultiPolygon } from 'geojson';
import type { EntityManager } from 'typeorm';
import { SRID_POSGAR, SRID_WGS84 } from '../sig/sig.constantes.js';
import type { OrigenPoligono } from './concesiones.constantes.js';

export interface NuevoPoligono {
  concesionId: string;
  /** Expediente del trámite que lo generó. NULL en los polígonos migrados. */
  expedienteId: string | null;
  origen: OrigenPoligono;
  /** En WGS84, tal como sale del KML (ya validada por GeometriaService.analizar). */
  geometria: MultiPolygon;
  /** KML original. NULL si el polígono no vino de un archivo (importado, dibujado). */
  archivo: { nombre: string; ruta: string; sha256: string; bytes: number } | null;
  /** Sistema de coordenadas en que vino el archivo (SistemaCoordenadas). */
  sistemaOrigen?: string | null;
  usuarioId: string;
}

/** Polígono vigente de una concesión, listo para mostrar (geometría en WGS84). */
export interface PoligonoVigente {
  id: string;
  geojson: MultiPolygon;
  superficieHa: number;
  perimetroM: number;
  puntoInterior: { latitud: number; longitud: number };
  origen: string;
  archivo: { nombre: string; bytes: number } | null;
  desde: Date;
}

/**
 * Escritura y lectura de con_poligono. Va con SQL directo porque la geometría entra en
 * WGS84 y se guarda transformada a POSGAR (ST_Transform), cosa que el ORM no hace solo.
 */
@Injectable()
export class PoligonosService {
  /**
   * Inserta el polígono como vigente. La superficie y el perímetro los calcula PostGIS en
   * el mismo INSERT, sobre la geometría ya transformada (lo que queda guardado es lo que se mide).
   */
  async insertar(tx: EntityManager, p: NuevoPoligono): Promise<string> {
    const [fila] = await tx.query(
      `WITH g AS (SELECT ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($3), ${SRID_WGS84}), ${SRID_POSGAR})) AS geom)
       INSERT INTO con_poligono
              (concesion_id, expediente_id, geom, superficie_ha, perimetro_m, origen,
               archivo_nombre, archivo_ruta, archivo_sha256, archivo_bytes, sistema_origen, vigente, creado_usuario_id)
       SELECT $1, $2, g.geom, ST_Area(g.geom) / 10000, ST_Perimeter(g.geom), $4,
              $5, $6, $7, $8, $10, true, $9
         FROM g
       RETURNING id`,
      [
        p.concesionId,
        p.expedienteId,
        JSON.stringify(p.geometria),
        p.origen,
        p.archivo?.nombre ?? null,
        p.archivo?.ruta ?? null,
        p.archivo?.sha256 ?? null,
        p.archivo?.bytes ?? null,
        p.usuarioId,
        p.sistemaOrigen ?? null,
      ],
    );
    return String(fila.id);
  }

  /**
   * Mientras el alta está en carga, el polígono es un borrador: al cargar otro KML se
   * borra el anterior. Una vez otorgada la concesión NO se usa esto: los trámites
   * posteriores llaman a `cerrarVigente` y conservan el histórico.
   */
  async borrarBorrador(tx: EntityManager, concesionId: string): Promise<void> {
    await tx.query(`DELETE FROM con_poligono WHERE concesion_id = $1`, [concesionId]);
  }

  /** Deja el polígono vigente como histórico (vigente = false, hasta = ahora). */
  async cerrarVigente(tx: EntityManager, concesionId: string): Promise<void> {
    await tx.query(`UPDATE con_poligono SET vigente = false, hasta = now() WHERE concesion_id = $1 AND vigente`, [concesionId]);
  }

  async vigente(tx: EntityManager, concesionId: string): Promise<PoligonoVigente | null> {
    const [f] = await tx.query(
      `SELECT id, superficie_ha, perimetro_m, origen, archivo_nombre, archivo_bytes, creado_en,
              ST_AsGeoJSON(ST_Transform(geom, ${SRID_WGS84}), 7)::json AS geojson,
              ST_Y(ST_Transform(ST_PointOnSurface(geom), ${SRID_WGS84})) AS lat,
              ST_X(ST_Transform(ST_PointOnSurface(geom), ${SRID_WGS84})) AS lon
         FROM con_poligono
        WHERE concesion_id = $1 AND vigente`,
      [concesionId],
    );
    if (!f) return null;
    return {
      id: String(f.id),
      geojson: f.geojson,
      superficieHa: Number(f.superficie_ha),
      perimetroM: Number(f.perimetro_m),
      puntoInterior: { latitud: Number(f.lat), longitud: Number(f.lon) },
      origen: f.origen,
      archivo: f.archivo_nombre ? { nombre: f.archivo_nombre, bytes: Number(f.archivo_bytes) } : null,
      desde: f.creado_en,
    };
  }
}
