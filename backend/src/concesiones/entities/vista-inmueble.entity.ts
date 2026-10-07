import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * Vista con_v_inmueble: el inmueble VIGENTE de cada concesión con los nombres del catálogo
 * (departamento, localidad, distrito, cuenca) en lugar de los ids.
 *
 * Existe para que las consultas de lectura (visor y QGIS, pozos, personas, baja de pozo)
 * no repitan los mismos JOIN contra cat_*: hacen `LEFT JOIN con_v_inmueble i ON
 * i.concesion_id = c.id` y leen i.departamento, i.localidad… como texto.
 */
@ViewEntity({
  name: 'con_v_inmueble',
  expression: `
    SELECT i.id                  AS inmueble_id,
           i.concesion_id,
           d.nombre              AS departamento,
           l.nombre              AS localidad,
           di.codigo             AS distrito,
           cu.nombre             AS cuenca,
           i.padron,
           i.matricula_catastral,
           i.circunscripcion,
           i.seccion,
           i.parcela,
           i.lamina,
           i.orden,
           i.desde
      FROM con_inmueble i
      LEFT JOIN cat_departamento d  ON d.id  = i.departamento_id
      LEFT JOIN cat_localidad   l   ON l.id  = i.localidad_id
      LEFT JOIN cat_distrito    di  ON di.id = i.distrito_id
      LEFT JOIN cat_cuenca      cu  ON cu.id = i.cuenca_id
     WHERE i.vigente
  `,
})
export class VistaInmueble {
  @ViewColumn({ name: 'inmueble_id' }) inmuebleId: string;
  @ViewColumn({ name: 'concesion_id' }) concesionId: string;
  @ViewColumn() departamento: string | null;
  @ViewColumn() localidad: string | null;
  @ViewColumn() distrito: string | null;
  @ViewColumn() cuenca: string | null;
  @ViewColumn() padron: string | null;
  @ViewColumn({ name: 'matricula_catastral' }) matriculaCatastral: string | null;
  @ViewColumn() circunscripcion: string | null;
  @ViewColumn() seccion: string | null;
  @ViewColumn() parcela: string | null;
  @ViewColumn() lamina: string | null;
  @ViewColumn() orden: string | null;
  @ViewColumn() desde: string | null;
}
