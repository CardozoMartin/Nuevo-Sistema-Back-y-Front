import { ViewColumn, ViewEntity } from 'typeorm';
import type { Point } from 'geojson';
import { VistaConcesion } from './vista-concesion.entity.js';

/**
 * Vista sig.v_puntos: el desagüe y el punto de entrega VIGENTES de cada concesión (con_punto),
 * con la geometría en POSGAR 07 (EPSG:5345). La leen QGIS (clave única: punto_id) y el visor
 * web (GET /api/sig/puntos).
 *
 * `distancia_poligono_m` es un control para la oficina, como `dentro_de_concesion` en los
 * pozos: un desagüe a más de 1 km del polígono suele ser una coordenada mal tipeada. NULL si la
 * concesión todavía no tiene polígono.
 */
@ViewEntity({
  schema: 'sig',
  name: 'v_puntos',
  dependsOn: [VistaConcesion],
  expression: `
    SELECT pt.id                       AS punto_id,
           pt.tipo::text               AS tipo,
           pt.sistema_carga::text      AS sistema_carga,
           pt.coord_x::float8          AS coord_x,
           pt.coord_y::float8          AS coord_y,
           pt.latitud::float8          AS latitud,
           pt.longitud::float8         AS longitud,
           pt.referencia,
           cc.id                       AS concesion_id,
           cc.numero                   AS concesion_numero,
           cc.estado::text             AS concesion_estado,
           c.expediente,
           c.titular,
           c.departamento,
           c.localidad,
           CASE WHEN c.geom IS NULL THEN NULL ELSE round(ST_Distance(pt.geom, c.geom)::numeric)::float8 END AS distancia_poligono_m,
           pt.geom
      FROM con_punto pt
      JOIN con_concesion cc ON cc.id = pt.concesion_id
      LEFT JOIN sig.v_concesiones c ON c.concesion_id = pt.concesion_id
     WHERE pt.vigente
       AND pt.geom IS NOT NULL
       AND cc.estado NOT IN ('ANULADA', 'DENEGADA')
  `,
})
export class VistaPunto {
  @ViewColumn({ name: 'punto_id' }) puntoId: string;
  @ViewColumn() tipo: string;
  @ViewColumn({ name: 'sistema_carga' }) sistemaCarga: string;
  @ViewColumn({ name: 'coord_x' }) coordX: number;
  @ViewColumn({ name: 'coord_y' }) coordY: number;
  @ViewColumn() latitud: number;
  @ViewColumn() longitud: number;
  @ViewColumn() referencia: string | null;
  @ViewColumn({ name: 'concesion_id' }) concesionId: string;
  @ViewColumn({ name: 'concesion_numero' }) concesionNumero: string | null;
  @ViewColumn({ name: 'concesion_estado' }) concesionEstado: string;
  @ViewColumn() expediente: string | null;
  @ViewColumn() titular: string | null;
  @ViewColumn() departamento: string | null;
  @ViewColumn() localidad: string | null;
  @ViewColumn({ name: 'distancia_poligono_m' }) distanciaPoligonoM: number | null;
  @ViewColumn() geom: Point;
}
