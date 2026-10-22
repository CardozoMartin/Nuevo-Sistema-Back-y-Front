import { ViewColumn, ViewEntity } from 'typeorm';
import type { MultiPolygon } from 'geojson';
import { VistaInmueble } from '../../concesiones/entities/vista-inmueble.entity.js';

/**
 * Vista con_v_mapa_concesion (INTERNA): una fila por concesión con polígono vigente, con sus
 * datos principales, si está publicada en el mapa público, y la geometría en POSGAR 07 (EPSG:5345).
 * Incluye las altas en trámite y las que esperan publicarse.
 *
 * La usan el visor del sistema (GET /api/sig/concesiones, solo usuarios con sesión) y los
 * controles de superposición. Está en el esquema public: el lector de mapas (drh_lector_sig) no
 * la ve. Lo que sale para afuera (GeoServer → Argenmap, QGIS) es sig.v_concesiones, más abajo:
 * solo las PUBLICADAS. TypeORM las recrea en cada synchronize.
 */
@ViewEntity({
  name: 'con_v_mapa_concesion',
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
           COALESCE(p.desde, p.creado_en::date)         AS poligono_desde,
           p.publicacion::text                          AS publicacion,
           p.publicacion_en,
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
  /** Desde cuándo rige el polígono (la resolución que lo aprobó; mientras está en trámite, la fecha de carga). */
  @ViewColumn({ name: 'poligono_desde' }) poligonoDesde: string;
  @ViewColumn() publicacion: string;
  @ViewColumn({ name: 'publicacion_en' }) publicacionEn: Date | null;
  @ViewColumn() geom: MultiPolygon;
}

/**
 * Vista sig.v_concesiones (PÚBLICA): las concesiones PUBLICADAS en el mapa, es decir, con resolución
 * y verificadas por quien tiene el permiso «Publicar en el mapa» (más las migradas, que ya estaban
 * otorgadas). Es la capa que leen GeoServer / Argenmap y QGIS con el usuario drh_lector_sig
 * (clave única: poligono_id). Lo que todavía no se aprobó no sale de la DRH.
 *
 * Sin el documento del titular ni la oficina en que está el expediente: son datos internos.
 */
@ViewEntity({
  schema: 'sig',
  name: 'v_concesiones',
  dependsOn: [VistaConcesion],
  expression: `
    SELECT poligono_id, concesion_id, numero, estado, tipo_derecho, origen, anio_otorgamiento, expediente,
           titular, cantidad_titulares, departamento, localidad, distrito, cuenca, padron,
           matricula_catastral, parcela, superficie_ha, caudal_lps, caracter, codigo_servicio, usos,
           fuente, sistema, canal_principal, origen_poligono, poligono_desde, publicacion_en AS publicado_en, geom
      FROM con_v_mapa_concesion
     WHERE publicacion = 'PUBLICADO'
  `,
})
export class VistaConcesionPublica {
  @ViewColumn({ name: 'poligono_id' }) poligonoId: string;
  @ViewColumn({ name: 'concesion_id' }) concesionId: string;
  @ViewColumn() numero: string | null;
  @ViewColumn({ name: 'publicado_en' }) publicadoEn: Date | null;
  @ViewColumn() geom: MultiPolygon;
}
