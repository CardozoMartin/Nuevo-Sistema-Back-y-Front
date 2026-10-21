import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../seguridad/auth.decorators.js';
import { enmascararDocumento } from '../seguridad/datos-sensibles.js';
import { Permiso } from '../seguridad/permisos.constantes.js';
import { ConsultaConcesionesService, NOMBRE_PERSONA, NUMERO_EXPEDIENTE, ORDEN_SQL } from './consulta-concesiones.service.js';
import type { BuscarConcesionesQuery } from './dto/buscar-concesiones.query.js';

/** Más que esto no entra cómodo en una planilla: se pide acotar la búsqueda. */
const MAXIMO_EXPORTAR = 20000;

type Fila = Record<string, unknown>;
/** Una columna de la hoja: título, campo de la fila y ancho. */
type Columna = [titulo: string, campo: string, ancho?: number];

// --- Columnas de cada hoja (por ahora todos los detalles; después se eligen cuáles) ---

const COLUMNAS_CONCESIONES: Columna[] = [
  ['Id', 'id', 8],
  ['N° de concesión', 'numero', 14],
  ['Estado', 'estado', 12],
  ['Origen', 'origen', 12],
  ['Tipo de derecho', 'tipo_derecho', 16],
  ['Situación legal', 'situacion_legal', 18],
  ['Fecha de otorgamiento', 'fecha_otorgamiento', 14],
  ['Año de otorgamiento', 'anio_otorgamiento', 10],
  ['Resolución', 'resolucion', 12],
  ['Fecha de resolución', 'resolucion_fecha', 14],
  ['Expediente', 'expediente', 18],
  ['Trámite del expediente', 'expediente_tramite', 18],
  ['Estado del expediente', 'expediente_estado', 14],
  ['Titular principal', 'titular', 30],
  ['Documento del titular principal', 'documento', 18],
  ['Cantidad de titulares', 'cantidad_titulares', 10],
  ['Todos los titulares', 'titulares', 40],
  ['Departamento', 'departamento', 16],
  ['Localidad', 'localidad', 20],
  ['Distrito', 'distrito', 8],
  ['Cuenca', 'cuenca', 20],
  ['Padrón', 'padron', 12],
  ['Matrícula catastral', 'matricula_catastral', 14],
  ['Circunscripción', 'circunscripcion', 10],
  ['Sección', 'seccion', 8],
  ['Parcela', 'parcela', 10],
  ['Lámina', 'lamina', 8],
  ['Orden', 'orden', 8],
  ['Libro', 'libro', 8],
  ['Folio', 'folio', 8],
  ['Año de dominio', 'anio_dominio', 10],
  ['Matrícula de dominio', 'matricula_dominio', 14],
  ['Serie', 'serie', 8],
  ['Superficie del polígono (ha)', 'superficie_ha', 12],
  ['Perímetro del polígono (m)', 'perimetro_m', 12],
  ['Polígono vigente desde', 'poligono_desde', 14],
  ['Usos', 'usos', 36],
  ['Caudal asignado (l/s)', 'caudal_lps', 12],
  ['Carácter', 'caracter', 12],
  ['Código de servicio', 'codigo_servicio', 26],
  ['Período desde', 'periodo_inicio', 12],
  ['Período hasta', 'periodo_fin', 12],
  ['Desagüe X (POSGAR)', 'desague_x', 14],
  ['Desagüe Y (POSGAR)', 'desague_y', 14],
  ['Desagüe latitud', 'desague_lat', 12],
  ['Desagüe longitud', 'desague_lon', 12],
  ['Entrega latitud', 'entrega_lat', 12],
  ['Entrega longitud', 'entrega_lon', 12],
  ['Referencia del punto de entrega', 'entrega_referencia', 24],
  ['Fuente principal', 'fuente_principal', 18],
  ['Fuentes adicionales', 'fuentes_adicionales', 20],
  ['Sistema de distribución', 'sistema_distribucion', 20],
  ['Canal principal', 'canal_principal', 18],
  ['Canal secundario', 'canal_secundario', 18],
  ['Canal terciario', 'canal_terciario', 18],
  ['Canal cuarto', 'canal_cuarto', 18],
  ['Canal quinto', 'canal_quinto', 18],
  ['Desagüe (suministro)', 'desague_suministro', 18],
  ['Observación del suministro', 'observacion_suministro', 30],
  ['Deudas pendientes', 'deudas_pendientes', 10],
  ['Observaciones', 'observaciones', 30],
  ['Creada en el sistema', 'creado_en', 18],
];

const COLUMNAS_TITULARES: Columna[] = [
  ['N° de concesión', 'numero', 14],
  ['Orden', 'orden', 8],
  ['Titular', 'nombre', 30],
  ['Tipo de persona', 'tipo_persona', 12],
  ['Tipo de documento', 'tipo_documento', 10],
  ['Documento', 'documento', 16],
  ['Fecha de nacimiento', 'fecha_nacimiento', 14],
  ['Fecha de constitución', 'fecha_constitucion', 14],
  ['Email', 'email', 28],
  ['Teléfono', 'telefono', 16],
  ['Id concesión', 'concesion_id', 8],
];

const COLUMNAS_DOMICILIOS: Columna[] = [
  ['N° de concesión', 'numero', 14],
  ['Orden', 'orden', 8],
  ['Calle', 'calle', 28],
  ['Número', 'numero_calle', 8],
  ['Departamento', 'departamento', 16],
  ['Localidad', 'localidad', 20],
  ['Distrito', 'distrito', 8],
  ['Id concesión', 'concesion_id', 8],
];

const COLUMNAS_USOS: Columna[] = [
  ['N° de concesión', 'numero', 14],
  ['Orden', 'orden', 8],
  ['Uso', 'uso', 24],
  ['Magnitud', 'magnitud', 10],
  ['Unidad', 'unidad', 16],
  ['Módulo de dotación (l/s por unidad)', 'dotacion', 14],
  ['Caudal (l/s)', 'caudal_lps', 10],
  ['Id concesión', 'concesion_id', 8],
];

const COLUMNAS_DEUDAS: Columna[] = [
  ['N° de concesión', 'numero', 14],
  ['Titular', 'titular', 30],
  ['Documento', 'documento', 16],
  ['Detalle', 'detalle', 36],
  ['Monto', 'monto', 12],
  ['Registrada', 'creado_en', 18],
  ['Id concesión', 'concesion_id', 8],
];

/** Campos que no se muestran a quien no tiene DATOS_SENSIBLES_VER (igual que en la API). */
const DOCUMENTOS = ['documento'];
const OCULTOS = ['email', 'telefono', 'calle', 'numero_calle', 'monto', 'titulares'];

/**
 * Exporta a Excel las concesiones que cumplen los filtros de la consulta, con todos sus
 * detalles: una hoja con una fila por concesión y hojas con titulares, domicilios, usos y deudas.
 */
@Injectable()
export class ExportarConcesionesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly consulta: ConsultaConcesionesService,
  ) {}

  async exportar(f: BuscarConcesionesQuery, sesion: UsuarioSesion): Promise<Buffer> {
    //1.- Las concesiones que cumplen los filtros (los mismos de la búsqueda), en el mismo orden.
    const { where, params, param } = this.consulta.filtrar(f);
    const concesiones = await this.dataSource.query<Fila[]>(
      `SELECT c.id, c.numero, ec.nombre AS estado, c.origen::text AS origen, c.tipo_derecho::text AS tipo_derecho, sl.nombre AS situacion_legal,
              c.fecha_otorgamiento, c.anio_otorgamiento, c.observaciones, c.creado_en,
              r.numero || '/' || r.anio AS resolucion, r.fecha AS resolucion_fecha,
              CASE WHEN e.id IS NOT NULL THEN ${NUMERO_EXPEDIENTE} END AS expediente, tt.nombre AS expediente_tramite, ee.nombre AS expediente_estado,
              tit.principal AS titular, tit.documento, tit.cantidad AS cantidad_titulares, tit.todos AS titulares,
              dep.nombre AS departamento, loc.nombre AS localidad, dis.codigo AS distrito, cu.nombre AS cuenca,
              i.padron, i.matricula_catastral, i.circunscripcion, i.seccion, i.parcela, i.lamina, i.orden, i.libro, i.folio,
              i.anio_dominio, i.matricula_dominio, i.serie,
              pg.superficie_ha, pg.perimetro_m, pg.desde AS poligono_desde,
              usos.detalle AS usos, co.caudal_lps, car.nombre AS caracter, srv.nombre AS codigo_servicio, co.periodo_inicio, co.periodo_fin,
              des.coord_x AS desague_x, des.coord_y AS desague_y, des.latitud AS desague_lat, des.longitud AS desague_lon,
              ent.latitud AS entrega_lat, ent.longitud AS entrega_lon, ent.referencia AS entrega_referencia,
              s.fuente_principal, array_to_string(s.fuentes_adicionales, ', ') AS fuentes_adicionales, s.sistema_distribucion,
              s.canal_principal, s.canal_secundario, s.canal_terciario, s.canal_cuarto, s.canal_quinto,
              s.desague AS desague_suministro, s.observacion AS observacion_suministro,
              deu.pendientes AS deudas_pendientes,
              count(*) OVER () AS total
         FROM con_concesion c
         LEFT JOIN cat_estado_concesion ec ON ec.codigo = c.estado::text
         LEFT JOIN cat_situacion_legal sl ON sl.codigo = c.situacion_legal_codigo
         LEFT JOIN exp_expediente e ON e.id = c.expediente_id
         LEFT JOIN cat_tipo_tramite tt ON tt.codigo = e.tipo_tramite::text
         LEFT JOIN cat_estado_expediente ee ON ee.codigo = e.estado::text
         LEFT JOIN exp_resolucion r ON r.id = c.resolucion_id
         LEFT JOIN con_inmueble i ON i.concesion_id = c.id AND i.vigente
         LEFT JOIN cat_departamento dep ON dep.id = i.departamento_id
         LEFT JOIN cat_localidad loc ON loc.id = i.localidad_id
         LEFT JOIN cat_distrito dis ON dis.id = i.distrito_id
         LEFT JOIN cat_cuenca cu ON cu.id = i.cuenca_id
         LEFT JOIN con_condicion co ON co.concesion_id = c.id AND co.vigente
         LEFT JOIN cat_opcion car ON car.grupo = 'CARACTER' AND car.codigo = co.caracter::text
         LEFT JOIN cat_opcion srv ON srv.grupo = 'CODIGO_SERVICIO' AND srv.codigo = co.codigo_servicio::text
         LEFT JOIN con_suministro s ON s.concesion_id = c.id AND s.vigente
         LEFT JOIN con_punto des ON des.concesion_id = c.id AND des.vigente AND des.tipo = 'DESAGUE'
         LEFT JOIN con_punto ent ON ent.concesion_id = c.id AND ent.vigente AND ent.tipo = 'ENTREGA'
         LEFT JOIN LATERAL (SELECT (array_agg(${NOMBRE_PERSONA} ORDER BY t.orden))[1] AS principal,
                                   (array_agg(p.documento ORDER BY t.orden))[1] AS documento, count(*) AS cantidad,
                                   string_agg(${NOMBRE_PERSONA} || ' (' || p.documento || ')', '; ' ORDER BY t.orden) AS todos
                              FROM con_titular t JOIN per_persona p ON p.id = t.persona_id
                             WHERE t.concesion_id = c.id AND t.vigente) tit ON true
         LEFT JOIN LATERAL (SELECT string_agg(tu.nombre || ' (' || trim(to_char(u.magnitud, 'FM999999990.##')) || ' ' || tu.unidad || ')', ', ' ORDER BY u.orden) AS detalle
                              FROM con_uso u JOIN cat_tipo_uso tu ON tu.codigo = u.tipo_uso_codigo
                             WHERE u.concesion_id = c.id AND u.vigente) usos ON true
         LEFT JOIN LATERAL (SELECT pg.superficie_ha, pg.perimetro_m, pg.desde FROM con_poligono pg WHERE pg.concesion_id = c.id AND pg.vigente LIMIT 1) pg ON true
         LEFT JOIN LATERAL (SELECT count(*) AS pendientes FROM rec_deuda d WHERE d.concesion_id = c.id AND d.estado = 'PENDIENTE') deu ON true
         ${where}
        ORDER BY ${ORDEN_SQL[f.orden]}
        LIMIT ${param(MAXIMO_EXPORTAR + 1)}`,
      params,
    );
    if (concesiones.length > MAXIMO_EXPORTAR) {
      throw new BadRequestException(`La búsqueda tiene ${Number(concesiones[0].total)} concesiones: se pueden exportar hasta ${MAXIMO_EXPORTAR}. Acote los filtros.`);
    }

    //2.- El detalle de esas concesiones (titulares, domicilios, usos y deudas pendientes).
    const ids = concesiones.map((c) => c.id);
    const numeroDe = new Map(concesiones.map((c) => [String(c.id), c.numero]));
    const detalle = async (sql: string) =>
      (await this.dataSource.query<Fila[]>(sql, [ids])).map((x) => ({ ...x, numero: numeroDe.get(String(x.concesion_id)) ?? null }));
    const [titulares, domicilios, usos, deudas] = await Promise.all([
      detalle(`SELECT t.concesion_id, t.orden + 1 AS orden, ${NOMBRE_PERSONA} AS nombre, p.tipo_persona::text AS tipo_persona,
                      p.tipo_documento::text AS tipo_documento, p.documento, p.fecha_nacimiento, p.fecha_constitucion, p.email, p.telefono
                 FROM con_titular t JOIN per_persona p ON p.id = t.persona_id
                WHERE t.concesion_id = ANY($1) AND t.vigente ORDER BY t.concesion_id, t.orden`),
      detalle(`SELECT d.concesion_id, d.orden + 1 AS orden, d.calle, d.numero AS numero_calle, dep.nombre AS departamento,
                      loc.nombre AS localidad, dis.codigo AS distrito
                 FROM con_domicilio d
                 LEFT JOIN cat_departamento dep ON dep.id = d.departamento_id
                 LEFT JOIN cat_localidad loc ON loc.id = d.localidad_id
                 LEFT JOIN cat_distrito dis ON dis.id = d.distrito_id
                WHERE d.concesion_id = ANY($1) AND d.vigente ORDER BY d.concesion_id, d.orden`),
      detalle(`SELECT u.concesion_id, u.orden + 1 AS orden, tu.nombre AS uso, u.magnitud, tu.unidad, tu.dotacion, u.caudal_lps
                 FROM con_uso u JOIN cat_tipo_uso tu ON tu.codigo = u.tipo_uso_codigo
                WHERE u.concesion_id = ANY($1) AND u.vigente ORDER BY u.concesion_id, u.orden`),
      detalle(`SELECT d.concesion_id, ${NOMBRE_PERSONA} AS titular, p.documento, d.detalle, d.monto, d.creado_en
                 FROM rec_deuda d JOIN per_persona p ON p.id = d.persona_id
                WHERE d.concesion_id = ANY($1) AND d.estado = 'PENDIENTE' ORDER BY d.concesion_id, d.creado_en`),
    ]);

    //3.- Sin permiso para datos sensibles: documentos enmascarados, sin contacto, domicilio ni montos.
    const verSensibles = sesion.permisos.includes(Permiso.DATOS_SENSIBLES_VER);
    const proteger = (filas: Fila[]) =>
      verSensibles
        ? filas
        : filas.map((x) =>
            Object.fromEntries(Object.entries(x).map(([k, v]) => [k, DOCUMENTOS.includes(k) ? enmascararDocumento(v) : OCULTOS.includes(k) ? null : v])),
          );

    //4.- El libro: una hoja por sección.
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Sistema DRH';
    libro.created = new Date();
    agregarHoja(libro, 'Concesiones', COLUMNAS_CONCESIONES, proteger(concesiones));
    agregarHoja(libro, 'Titulares', COLUMNAS_TITULARES, proteger(titulares));
    agregarHoja(libro, 'Domicilios', COLUMNAS_DOMICILIOS, proteger(domicilios));
    agregarHoja(libro, 'Usos', COLUMNAS_USOS, usos);
    agregarHoja(libro, 'Deudas', COLUMNAS_DEUDAS, proteger(deudas));
    if (!verSensibles) {
      libro.addWorksheet('Aviso').addRow(['Documentos, contactos, domicilios y montos están ocultos: el usuario no tiene permiso para ver datos sensibles.']);
    }
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}

/**
 * Postgres devuelve numeric/bigint como texto: estas columnas van como número en la planilla.
 * Padrón, matrícula y documento quedan como texto (son códigos, no cantidades).
 */
const NUMERICOS = new Set([
  'id', 'concesion_id', 'orden', 'cantidad_titulares', 'deudas_pendientes', 'anio_otorgamiento', 'anio_dominio',
  'superficie_ha', 'perimetro_m', 'caudal_lps', 'magnitud', 'dotacion', 'monto',
  'desague_x', 'desague_y', 'desague_lat', 'desague_lon', 'entrega_lat', 'entrega_lon',
]);

/** Fechas sin hora y con hora: formato de la celda. */
const FECHAS = new Set(['fecha_otorgamiento', 'resolucion_fecha', 'poligono_desde', 'periodo_inicio', 'periodo_fin', 'fecha_nacimiento', 'fecha_constitucion']);
const FECHAS_HORA = new Set(['creado_en']);

function valorCelda(campo: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  // Excel no guarda zona horaria: se escribe la hora local (si no, un 14/10 se ve 14/10 03:00).
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60_000);
  if (NUMERICOS.has(campo) && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
}

function agregarHoja(libro: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: Fila[]) {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = columnas.map(([header, key, width]) => ({
    header,
    key,
    width: width ?? 14,
    style: FECHAS.has(key) ? { numFmt: 'dd/mm/yyyy' } : FECHAS_HORA.has(key) ? { numFmt: 'dd/mm/yyyy hh:mm' } : {},
  }));
  for (const fila of filas) hoja.addRow(Object.fromEntries(columnas.map(([, campo]) => [campo, valorCelda(campo, fila[campo])])));
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  encabezado.alignment = { vertical: 'middle', wrapText: true };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}
