import { ViewColumn, ViewEntity } from 'typeorm';
import type { Point } from 'geojson';
import { VistaConcesion } from './vista-concesion.entity.js';

/**
 * Vista sig.v_pozos: una fila por pozo no anulado, con la concesión que abastece y la
 * geometría en POSGAR 07 (EPSG:5345). La leen QGIS (clave única: pozo_id) y el visor web
 * (GET /api/sig/pozos).
 *
 * `dentro_de_concesion` es un control para la oficina: un pozo vinculado a una concesión
 * debería caer dentro de su polígono; si da false, hay un error de carga en alguno de los dos.
 */
@ViewEntity({
  schema: 'sig',
  name: 'v_pozos',
  dependsOn: [VistaConcesion],
  expression: `
    SELECT p.id                       AS pozo_id,
           p.id_interno,
           p.alias,
           p.estado::text             AS estado,
           p.origen::text             AS origen,
           p.tipo_pozo,
           p.jurisdiccion_drh,
           p.profundidad_real::float8 AS profundidad_m,
           p.nivel_estatico::float8   AS nivel_estatico_m,
           p.nivel_dinamico::float8   AS nivel_dinamico_m,
           p.caudal_bombeo_m3h::float8 AS caudal_m3h,
           p.caudal_bombeo_lps::float8 AS caudal_lps,
           round(ST_X(p.geom)::numeric, 2)::float8 AS coord_x,
           round(ST_Y(p.geom)::numeric, 2)::float8 AS coord_y,
           p.concesion_id,
           c.numero                   AS concesion_numero,
           c.titular,
           c.departamento,
           c.localidad,
           CASE WHEN c.geom IS NULL THEN NULL ELSE ST_Within(p.geom, c.geom) END AS dentro_de_concesion,
           p.geom
      FROM poz_pozo p
      -- La vista interna: el control «dentro de la concesión» vale también para las altas sin publicar.
      LEFT JOIN con_v_mapa_concesion c ON c.concesion_id = p.concesion_id
     WHERE p.estado <> 'ANULADO'
  `,
})
export class VistaPozo {
  @ViewColumn({ name: 'pozo_id' }) pozoId: string;
  @ViewColumn({ name: 'id_interno' }) idInterno: string;
  @ViewColumn() alias: string | null;
  @ViewColumn() estado: string;
  @ViewColumn() origen: string;
  @ViewColumn({ name: 'tipo_pozo' }) tipoPozo: string | null;
  @ViewColumn({ name: 'jurisdiccion_drh' }) jurisdiccionDrh: boolean;
  @ViewColumn({ name: 'profundidad_m' }) profundidadM: number | null;
  @ViewColumn({ name: 'nivel_estatico_m' }) nivelEstaticoM: number | null;
  @ViewColumn({ name: 'nivel_dinamico_m' }) nivelDinamicoM: number | null;
  @ViewColumn({ name: 'caudal_m3h' }) caudalM3h: number | null;
  @ViewColumn({ name: 'caudal_lps' }) caudalLps: number | null;
  @ViewColumn({ name: 'coord_x' }) coordX: number;
  @ViewColumn({ name: 'coord_y' }) coordY: number;
  @ViewColumn({ name: 'concesion_id' }) concesionId: string | null;
  @ViewColumn({ name: 'concesion_numero' }) concesionNumero: string | null;
  @ViewColumn() titular: string | null;
  @ViewColumn() departamento: string | null;
  @ViewColumn() localidad: string | null;
  @ViewColumn({ name: 'dentro_de_concesion' }) dentroDeConcesion: boolean | null;
  @ViewColumn() geom: Point;
}
