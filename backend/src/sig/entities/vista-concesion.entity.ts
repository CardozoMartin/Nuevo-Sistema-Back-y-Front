import { ViewColumn, ViewEntity } from 'typeorm';
import type { MultiPolygon } from 'geojson';
import { VistaInmueble } from '../../concesiones/entities/vista-inmueble.entity.js';

/**
 * Vista sig.v_concesiones: una fila por concesión con polígono vigente, con sus datos
 * principales y la geometría en POSGAR 07 (EPSG:5345).
 *
 * Es la capa que consumen:
 *   - QGIS, conectándose directo a PostGIS (ver docs/qgis.md). Clave única: poligono_id.
 *   - El visor web, a través de GET /api/sig/concesiones (que la devuelve en WGS84).
 *   - Más adelante, un servidor de mapas (GeoServer, pg_featureserv) para WMS/WFS.
 *
 * Está en un esquema propio («sig») para dar permiso de lectura solo a esto, sin exponer
 * las tablas de trabajo. TypeORM la recrea en cada synchronize.
 */
@ViewEntity({
  schema: 'sig',
  name: 'v_concesiones',
  // Lee la vista con_v_inmueble: tiene que existir antes.
  dependsOn: [VistaInmueble],
  expression: `
    SELECT p.id                                         AS poligono_id,
           c.id                                         AS concesion_id,
           c.numero,
           c.estado::text                               AS estado,
           c.tipo_derecho::text                         AS tipo_derecho,
           c.origen::text                               AS origen,
           c.anio_otorgamiento,
           e.numero || '/' || e.reparticion || '-' || e.anio AS expediente,
           e.oficina_actual::text                       AS oficina_actual,
           t.titular,
           t.documento,
           t.cantidad_titulares::int                    AS cantidad_titulares,
           i.departamento,
           i.localidad,
           i.distrito,
           i.cuenca,
           i.padron,
           i.matricula_catastral,
           i.parcela,
           p.superficie_ha::float8                      AS superficie_ha,
           cd.caudal_lps::float8                        AS caudal_lps,
           cd.caracter::text                            AS caracter,
           cd.codigo_servicio,
           u.usos,
           s.fuente_principal                           AS fuente,
           s.sistema_distribucion                       AS sistema,
           s.canal_principal,
           p.origen::text                               AS origen_poligono,
           p.creado_en                                  AS poligono_desde,
           p.geom
      FROM con_poligono p
      JOIN con_concesion c   ON c.id = p.concesion_id
      -- LEFT: las concesiones migradas no tienen expediente digital.
      LEFT JOIN exp_expediente e  ON e.id = c.expediente_id
      -- Inmueble, condiciones y suministro VIGENTES (las tablas guardan también el historial).
      LEFT JOIN con_v_inmueble i  ON i.concesion_id = c.id
      LEFT JOIN con_condicion cd  ON cd.concesion_id = c.id AND cd.vigente
      LEFT JOIN con_suministro s  ON s.concesion_id = c.id AND s.vigente
      LEFT JOIN LATERAL (
            -- Persona jurídica: razón social. Física: «Apellido, Nombre», o la denominación
            -- tal como venía en el padrón anterior si es un titular migrado.
            SELECT string_agg(CASE WHEN pe.tipo_persona = 'JURIDICA' THEN pe.razon_social
                                   ELSE COALESCE(pe.apellido || ', ' || pe.nombre, pe.denominacion) END,
                              ' / ' ORDER BY ct.orden) AS titular,
                   (array_agg(pe.documento ORDER BY ct.orden))[1]                                   AS documento,
                   count(*)                                                                          AS cantidad_titulares
              FROM con_titular ct
              JOIN per_persona pe ON pe.id = ct.persona_id
             WHERE ct.concesion_id = c.id AND ct.vigente) t ON true
      LEFT JOIN LATERAL (
            SELECT string_agg(tu.nombre, ', ' ORDER BY cu.orden) AS usos
              FROM con_uso cu
              JOIN cat_tipo_uso tu ON tu.codigo = cu.tipo_uso_codigo
             WHERE cu.concesion_id = c.id AND cu.vigente) u ON true
     WHERE p.vigente
       AND c.estado NOT IN ('ANULADA', 'DENEGADA')
  `,
})
export class VistaConcesion {
  @ViewColumn({ name: 'poligono_id' }) poligonoId: string;
  @ViewColumn({ name: 'concesion_id' }) concesionId: string;
  @ViewColumn() numero: string | null;
  @ViewColumn() estado: string;
  @ViewColumn({ name: 'tipo_derecho' }) tipoDerecho: string;
  @ViewColumn() origen: string;
  @ViewColumn({ name: 'anio_otorgamiento' }) anioOtorgamiento: number | null;
  @ViewColumn() expediente: string | null;
  @ViewColumn({ name: 'oficina_actual' }) oficinaActual: string | null;
  @ViewColumn() cuenca: string | null;
  @ViewColumn({ name: 'codigo_servicio' }) codigoServicio: number | null;
  @ViewColumn() fuente: string | null;
  @ViewColumn() sistema: string | null;
  @ViewColumn({ name: 'canal_principal' }) canalPrincipal: string | null;
  @ViewColumn() titular: string | null;
  @ViewColumn() documento: string | null;
  @ViewColumn({ name: 'cantidad_titulares' }) cantidadTitulares: number | null;
  @ViewColumn() departamento: string | null;
  @ViewColumn() localidad: string | null;
  @ViewColumn() distrito: string | null;
  @ViewColumn() padron: string | null;
  @ViewColumn({ name: 'matricula_catastral' }) matriculaCatastral: string | null;
  @ViewColumn() parcela: string | null;
  @ViewColumn({ name: 'superficie_ha' }) superficieHa: number;
  @ViewColumn({ name: 'caudal_lps' }) caudalLps: number | null;
  @ViewColumn() caracter: string | null;
  @ViewColumn() usos: string | null;
  @ViewColumn({ name: 'origen_poligono' }) origenPoligono: string;
  @ViewColumn({ name: 'poligono_desde' }) poligonoDesde: Date;
  @ViewColumn() geom: MultiPolygon;
}
