import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { SRID_WGS84 } from '../sig/sig.constantes.js';
import { BAJAS_ABIERTAS } from './pozos.constantes.js';

/** Un pozo con los datos que necesitan la búsqueda y la ficha (y la concesión que abastece). */
export interface FichaPozo {
  id: string;
  idInterno: string;
  alias: string | null;
  estado: string;
  origen: string;
  tipoPozo: string | null;
  jurisdiccionDrh: boolean;
  profundidadM: number | null;
  caudalM3h: number | null;
  caudalLps: number | null;
  /** POSGAR 07 faja 3 (las de los papeles). */
  coordX: number;
  coordY: number;
  latitud: number;
  longitud: number;
  concesion: { id: string; numero: string | null; estado: string; titular: string | null; departamento: string | null; localidad: string | null } | null;
  /** Baja en trámite (un pozo tiene a lo sumo una). */
  bajaAbierta: { expedienteId: string; expediente: string; etapa: string; oficina: string } | null;
  /** Si el pozo está dado de baja: cómo, cuándo, por qué y quién la registró. */
  bajaConfirmada: {
    origen: string;
    fechaBaja: string | null;
    motivo: string;
    expedienteId: string | null;
    expediente: string | null;
    resolucion: string | null;
    /** Número de la concesión que abastecía (el pozo se desvincula al darlo de baja). */
    concesionAnterior: string | null;
    /** Si la resolución anuló también la concesión. */
    concesionAnulada: boolean;
    /** Solo si correspondía clausura física: fecha y acta (null mientras está pendiente). */
    clausura: { fecha: string | null; acta: string | null } | null;
    usuario: string;
  } | null;
  /** Expedientes del pozo: el de la concesión (alta) y los de sus bajas, del más nuevo al más viejo. */
  expedientes: { id: string; numero: string; tipoTramite: string; estado: string }[];
}

/**
 * Consulta de un pozo armada por PostgreSQL. Lee las tablas (no la vista sig.v_pozos)
 * porque la concesión puede no tener polígono y aun así hay que mostrarla.
 */
const CONSULTA = `
  SELECT p.id, p.id_interno, p.alias, p.estado::text AS estado, p.origen::text AS origen, p.tipo_pozo,
         p.jurisdiccion_drh, p.profundidad_real::float8 AS profundidad, p.caudal_bombeo_m3h::float8 AS caudal_m3h,
         p.caudal_bombeo_lps::float8 AS caudal_lps,
         round(ST_X(p.geom)::numeric, 2)::float8 AS x, round(ST_Y(p.geom)::numeric, 2)::float8 AS y,
         ST_Y(ST_Transform(p.geom, ${SRID_WGS84})) AS lat, ST_X(ST_Transform(p.geom, ${SRID_WGS84})) AS lon,
         c.id AS concesion_id, c.numero AS concesion_numero, c.estado::text AS concesion_estado,
         t.titular, t.documentos, i.departamento, i.localidad, COALESCE(ex.expedientes, '[]'::json) AS expedientes,
         b.expediente_id AS baja_expediente_id,
         e.numero || '/' || e.reparticion || '-' || e.anio AS baja_expediente,
         e.etapa::text AS baja_etapa, e.oficina_actual::text AS baja_oficina,
         bc.baja_confirmada
    FROM poz_pozo p
    LEFT JOIN con_concesion c ON c.id = p.concesion_id
    LEFT JOIN con_v_inmueble i ON i.concesion_id = c.id
    LEFT JOIN LATERAL (
          SELECT string_agg(CASE WHEN pe.tipo_persona = 'JURIDICA' THEN pe.razon_social
                                 ELSE COALESCE(pe.apellido || ', ' || pe.nombre, pe.denominacion) END,
                            ' / ' ORDER BY ct.orden) AS titular,
                 string_agg(pe.documento, ' ') AS documentos
            FROM con_titular ct JOIN per_persona pe ON pe.id = ct.persona_id
           WHERE ct.concesion_id = c.id AND ct.vigente) t ON true
    LEFT JOIN LATERAL (
          -- El expediente de la concesión y los de las bajas del pozo (también las terminadas).
          SELECT json_agg(json_build_object('id', x.id::text, 'numero', x.numero || '/' || x.reparticion || '-' || x.anio,
                                            'tipoTramite', x.tipo_tramite, 'estado', x.estado) ORDER BY x.creado_en DESC) AS expedientes
            FROM exp_expediente x
           WHERE x.id = c.expediente_id
              OR x.id IN (SELECT pb.expediente_id FROM poz_baja pb WHERE pb.pozo_id = p.id)) ex ON true
    LEFT JOIN poz_baja b ON b.pozo_id = p.id AND b.estado IN (${BAJAS_ABIERTAS.map((e) => `'${e}'`).join(', ')})
    LEFT JOIN exp_expediente e ON e.id = b.expediente_id
    LEFT JOIN LATERAL (
          -- La baja que dejó el pozo en BAJA (la última confirmada).
          SELECT json_build_object(
                   'origen', x.origen, 'fechaBaja', x.fecha_baja, 'motivo', x.motivo,
                   'expedienteId', x.expediente_id::text,
                   'expediente', xe.numero || '/' || xe.reparticion || '-' || xe.anio,
                   'resolucion', xr.numero || '/' || xr.anio,
                   'concesionAnterior', xc.numero,
                   'concesionAnulada', COALESCE(x.anular_concesion, false),
                   'clausura', CASE WHEN x.requiere_clausura THEN json_build_object('fecha', x.clausura_fecha, 'acta', x.clausura_acta) END,
                   'usuario', u.apellido || ', ' || u.nombre) AS baja_confirmada
            FROM poz_baja x
            LEFT JOIN exp_expediente xe ON xe.id = x.expediente_id
            LEFT JOIN exp_resolucion xr ON xr.id = x.resolucion_id
            LEFT JOIN con_concesion xc ON xc.id = x.concesion_anterior_id
            JOIN seg_usuario u ON u.id = x.creado_usuario_id
           WHERE x.pozo_id = p.id AND x.estado IN ('CONFIRMADA', 'CLAUSURA_PENDIENTE')
           ORDER BY x.creado_en DESC
           LIMIT 1) bc ON true`;

/** Quita los acentos en SQL (sin depender de la extensión unaccent). */
const sinAcentos = (expr: string) => `translate(${expr}, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')`;

/**
 * Texto en el que se busca: ID interno, alias, concesión, titulares y sus documentos,
 * expedientes (como «123/332-2026»), departamento y localidad.
 */
const TEXTO_BUSQUEDA = `concat_ws(' ', p.id_interno, p.alias, c.numero, t.titular, t.documentos, i.departamento, i.localidad,
                                  (SELECT string_agg(e2->>'numero', ' ') FROM json_array_elements(ex.expedientes) e2))`;

function aFicha(f: Record<string, unknown>): FichaPozo {
  return {
    id: String(f.id),
    idInterno: f.id_interno as string,
    alias: f.alias as string | null,
    estado: f.estado as string,
    origen: f.origen as string,
    tipoPozo: f.tipo_pozo as string | null,
    jurisdiccionDrh: f.jurisdiccion_drh as boolean,
    profundidadM: f.profundidad as number | null,
    caudalM3h: f.caudal_m3h as number | null,
    caudalLps: f.caudal_lps as number | null,
    coordX: f.x as number,
    coordY: f.y as number,
    latitud: Number(f.lat),
    longitud: Number(f.lon),
    concesion: f.concesion_id
      ? {
          id: String(f.concesion_id),
          numero: f.concesion_numero as string | null,
          estado: f.concesion_estado as string,
          titular: f.titular as string | null,
          departamento: f.departamento as string | null,
          localidad: f.localidad as string | null,
        }
      : null,
    bajaAbierta: f.baja_expediente_id
      ? { expedienteId: String(f.baja_expediente_id), expediente: f.baja_expediente as string, etapa: f.baja_etapa as string, oficina: f.baja_oficina as string }
      : null,
    bajaConfirmada: (f.baja_confirmada as FichaPozo['bajaConfirmada']) ?? null,
    expedientes: (f.expedientes as FichaPozo['expedientes']) ?? [],
  };
}

/** Búsqueda y ficha de pozos (las usan la baja y, más adelante, la consulta general). */
@Injectable()
export class PozosService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Busca por número de concesión, número de expediente, titular, documento, ID interno,
   * alias, departamento o localidad (sin distinguir mayúsculas ni acentos). Varias palabras:
   * tienen que estar todas («perez lules»). Sin texto devuelve los primeros. Máximo 50.
   */
  async buscar(texto?: string): Promise<FichaPozo[]> {
    const q = texto?.trim();
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      `${CONSULTA}
        WHERE p.estado <> 'ANULADO'
          AND NOT EXISTS (
                SELECT 1 FROM unnest($1::text[]) AS u(palabra)
                 WHERE ${sinAcentos(TEXTO_BUSQUEDA)} NOT ILIKE '%' || ${sinAcentos('palabra')} || '%')
        ORDER BY p.id_interno
        LIMIT 50`,
      [q ? q.split(/\s+/) : []],
    );
    return filas.map(aFicha);
  }

  async obtener(id: string, tx: EntityManager = this.dataSource.manager): Promise<FichaPozo> {
    const [fila] = await tx.query(`${CONSULTA} WHERE p.id = $1`, [id]);
    if (!fila) throw new NotFoundException('El pozo no existe en el sistema.');
    return aFicha(fila);
  }
}
