// Controles para no cargar dos veces la misma concesión. Los usan el alta y, más adelante,
// subdivisión y reubicación.
import type { EntityManager } from 'typeorm';

/** Una concesión que sigue existiendo (no anulada ni denegada) cuenta para los duplicados. */
const ACTIVA = `c.estado NOT IN ('ANULADA', 'DENEGADA')`;

export interface ConcesionExistente {
  id: string;
  numero: string | null;
  estado: string;
  expediente: string | null;
}

const describir = (c: ConcesionExistente) =>
  c.numero ? `la concesión ${c.numero}` : c.expediente ? `el alta en trámite del expediente ${c.expediente}` : `la concesión ${c.id}`;

/**
 * Otra concesión activa sobre la misma matrícula catastral (la misma parcela).
 * Devuelve el mensaje de error o null.
 */
export async function matriculaEnUso(tx: EntityManager, matricula: string, excluirConcesionId: string): Promise<string | null> {
  const [c]: ConcesionExistente[] = await tx.query(
    `SELECT c.id::text, c.numero, c.estado, e.numero || '/' || e.reparticion || '-' || e.anio AS expediente
       FROM con_inmueble i
       JOIN con_concesion c ON c.id = i.concesion_id
       LEFT JOIN exp_expediente e ON e.id = c.expediente_id
      WHERE i.vigente AND upper(trim(i.matricula_catastral)) = upper(trim($1)) AND c.id <> $2 AND ${ACTIVA}
      LIMIT 1`,
    [matricula, excluirConcesionId],
  );
  return c ? `La matrícula catastral ${matricula} ya corresponde a ${describir(c)}: no se puede cargar una concesión duplicada.` : null;
}

/**
 * Porcentaje de superposición a partir del cual dos polígonos se consideran LA MISMA
 * concesión (y no dos vecinas que se pisan un poco, que solo se informan).
 */
export const UMBRAL_DUPLICADO = 0.9;

/**
 * Otra concesión activa cuyo polígono coincide casi por completo con el de esta
 * (≥ 90 % de la superficie de cualquiera de los dos). Devuelve el mensaje de error o null.
 */
export async function poligonoDuplicado(tx: EntityManager, concesionId: string, poligonoId?: string): Promise<string | null> {
  const [c]: (ConcesionExistente & { porcentaje: number })[] = await tx.query(
    `SELECT c.id::text, c.numero, c.estado, e.numero || '/' || e.reparticion || '-' || e.anio AS expediente,
            round((100 * ST_Area(ST_Intersection(p.geom, o.geom)) / LEAST(ST_Area(p.geom), ST_Area(o.geom)))::numeric, 1)::float8 AS porcentaje
       FROM con_poligono p
       JOIN con_poligono o ON o.vigente AND o.concesion_id <> p.concesion_id AND o.geom && p.geom AND ST_Intersects(o.geom, p.geom)
       JOIN con_concesion c ON c.id = o.concesion_id
       LEFT JOIN exp_expediente e ON e.id = c.expediente_id
      -- El vigente de la concesión, o uno puntual (una corrección propuesta, que no es vigente).
      WHERE p.concesion_id = $1 AND ($3::bigint IS NULL AND p.vigente OR p.id = $3::bigint) AND ${ACTIVA}
        AND ST_Area(ST_Intersection(p.geom, o.geom)) >= $2 * LEAST(ST_Area(p.geom), ST_Area(o.geom))
      ORDER BY porcentaje DESC
      LIMIT 1`,
    [concesionId, UMBRAL_DUPLICADO, poligonoId ?? null],
  );
  return c
    ? `El polígono coincide en un ${c.porcentaje} % con ${describir(c)}: parece la misma concesión. Si es un error de dibujo, corrija el KML.`
    : null;
}
