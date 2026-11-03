import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { formatearNumeroExpediente } from '../expedientes/expedientes.constantes.js';
import { nombrePersona } from '../personas/entities/persona.entity.js';
import { TipoPunto } from './concesiones.constantes.js';
import { cargarDatosVigentes } from './datos-vigentes.js';
import type { BuscarConcesionesQuery } from './dto/buscar-concesiones.query.js';
import { Concesion } from './entities/concesion.entity.js';

/** Minúsculas y sin acentos, igual que `plano()` en SQL: «Núñez» se encuentra con «nunez». */
const ACENTOS = 'áéíóúüàèìòùñ';
const SIN_ACENTOS = 'aeiouuaeioun';
export const plano = (sql: string) => `translate(lower(${sql}), '${ACENTOS}', '${SIN_ACENTOS}')`;
const textoPlano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Para ILIKE: el texto entre % y sin comodines del usuario. */
export const parecido = (s: string) => `%${textoPlano(s).replace(/[%_\\]/g, '\\$&')}%`;

/** Nombre para mostrar de per_persona (como nombrePersona). */
export const NOMBRE_PERSONA = `CASE WHEN p.tipo_persona = 'JURIDICA' AND p.razon_social IS NOT NULL THEN p.razon_social
  WHEN p.apellido IS NOT NULL AND p.nombre IS NOT NULL THEN p.apellido || ', ' || p.nombre
  ELSE coalesce(p.denominacion, p.razon_social, '—') END`;

/** El número de expediente como se muestra (123/332-2026), sin ceros a la izquierda. */
export const NUMERO_EXPEDIENTE = `(e.numero::int)::text || '/' || (e.reparticion::int)::text || '-' || e.anio`;

/** N° de concesión como número (las viejas pueden traer letras: esas quedan fuera de los rangos). */
const NUMERO_CONCESION = `CASE WHEN c.numero ~ '^\\d{1,15}$' THEN c.numero::bigint END`;

export const ORDEN_SQL: Record<BuscarConcesionesQuery['orden'], string> = {
  NUMERO: `${NUMERO_CONCESION} NULLS LAST, c.numero NULLS LAST, c.id DESC`,
  RECIENTES: `coalesce(c.fecha_otorgamiento, c.creado_en::date) DESC, c.id DESC`,
  TITULAR: `tit.principal NULLS LAST, c.id DESC`,
};

/**
 * Consulta de concesiones de Catastro: las opciones de los filtros (todas de los catálogos
 * de la base), la búsqueda combinando filtros y la ficha completa de una concesión.
 */
@Injectable()
export class ConsultaConcesionesService {
  constructor(private readonly dataSource: DataSource) {}

  /** Opciones de cada filtro, de los catálogos activos de la base. */
  async filtros() {
    const q = <T>(sql: string) => this.dataSource.query<T[]>(sql);
    const [estados, departamentos, localidades, distritos, cuencas, situaciones, usos, opciones, suministro] = await Promise.all([
      q<{ codigo: string; nombre: string; color: string }>('SELECT codigo, nombre, color FROM cat_estado_concesion ORDER BY orden'),
      q<{ id: number; nombre: string }>('SELECT id, nombre FROM cat_departamento WHERE activo ORDER BY nombre'),
      q<{ id: number; nombre: string; departamentoId: number; distritoId: number }>(
        'SELECT id, nombre, departamento_id AS "departamentoId", distrito_id AS "distritoId" FROM cat_localidad WHERE activo ORDER BY nombre',
      ),
      q<{ id: number; codigo: string; nombre: string }>('SELECT id, codigo, nombre FROM cat_distrito WHERE activo ORDER BY codigo'),
      q<{ id: number; nombre: string }>('SELECT id, nombre FROM cat_cuenca WHERE activo ORDER BY nombre'),
      q<{ codigo: string; nombre: string }>('SELECT codigo, nombre FROM cat_situacion_legal WHERE activo ORDER BY nombre'),
      q<{ codigo: string; nombre: string; unidad: string }>('SELECT codigo, nombre, unidad FROM cat_tipo_uso WHERE activo ORDER BY orden, nombre'),
      q<{ grupo: string; codigo: string; nombre: string }>('SELECT grupo::text AS grupo, codigo, nombre FROM cat_opcion WHERE activo ORDER BY grupo, orden'),
      // Fuentes y sistemas del árbol de suministro y los que tienen las concesiones (las migradas
      // conservan los nombres del padrón viejo, que no siempre están en el árbol).
      q<{ tipo: string; nombre: string }>(
        `SELECT nivel::text AS tipo, nombre FROM cat_suministro_nodo WHERE activo AND nivel IN ('FUENTE', 'SISTEMA')
         UNION SELECT 'FUENTE', fuente_principal FROM con_suministro WHERE vigente AND fuente_principal IS NOT NULL
         UNION SELECT 'SISTEMA', sistema_distribucion FROM con_suministro WHERE vigente AND sistema_distribucion IS NOT NULL
         ORDER BY tipo, nombre`,
      ),
    ]);
    const opcionesDe = (grupo: string) => opciones.filter((o) => o.grupo === grupo).map(({ codigo, nombre }) => ({ codigo, nombre }));
    const suministroDe = (tipo: string) => suministro.filter((s) => s.tipo === tipo).map((s) => s.nombre);
    return {
      estados,
      departamentos,
      localidades,
      distritos,
      cuencas,
      situacionesLegales: situaciones,
      tiposUso: usos,
      caracteres: opcionesDe('CARACTER'),
      codigosServicio: opcionesDe('CODIGO_SERVICIO'),
      circunscripciones: opcionesDe('CIRCUNSCRIPCION'),
      secciones: opcionesDe('SECCION_CATASTRAL'),
      fuentes: suministroDe('FUENTE'),
      sistemas: suministroDe('SISTEMA'),
    };
  }

  /**
   * El WHERE de los filtros (la misma regla para buscar y para exportar). Usa los alias de la
   * consulta: c (concesión), e (expediente), r (resolución), i (inmueble), co (condición), s (suministro).
   */
  filtrar(f: BuscarConcesionesQuery) {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    const param = (v: unknown) => `$${params.push(v)}`;
    const contiene = (sql: string, valor: string) => `${plano(sql)} ILIKE ${param(parecido(valor))}`;
    /** Algún titular vigente de la concesión cumple la condición. */
    const algunTitular = (condicion: string) =>
      `EXISTS (SELECT 1 FROM con_titular t JOIN per_persona p ON p.id = t.persona_id WHERE t.concesion_id = c.id AND t.vigente AND ${condicion})`;
    const soloDigitos = (s: string) => s.replace(/\D/g, '');

    //1.- Búsqueda general: cualquiera de los datos que identifican a la concesión.
    if (f.texto) {
      const t = param(parecido(f.texto));
      const digitos = soloDigitos(f.texto);
      condiciones.push(
        `(${plano('c.numero')} ILIKE ${t} OR ${plano(NUMERO_EXPEDIENTE)} ILIKE ${t} OR ${plano('i.padron')} ILIKE ${t}` +
          ` OR ${plano('i.matricula_catastral')} ILIKE ${t} OR ${algunTitular(`${plano(NOMBRE_PERSONA)} ILIKE ${t}`)}` +
          (digitos.length >= 3 ? ` OR ${algunTitular(`regexp_replace(p.documento, '\\D', '', 'g') LIKE ${param(`%${digitos}%`)}`)}` : '') +
          ')',
      );
    }

    //2.- Concesión y expediente.
    if (f.numeroConcesion) condiciones.push(contiene('c.numero', f.numeroConcesion));
    if (f.numeroDesde !== undefined) condiciones.push(`${NUMERO_CONCESION} >= ${param(f.numeroDesde)}`);
    if (f.numeroHasta !== undefined) condiciones.push(`${NUMERO_CONCESION} <= ${param(f.numeroHasta)}`);
    if (f.expediente) condiciones.push(contiene(NUMERO_EXPEDIENTE, f.expediente));
    if (f.estado) condiciones.push(`c.estado = ${param(f.estado)}`);
    if (f.situacionLegal) condiciones.push(`c.situacion_legal_codigo = ${param(f.situacionLegal)}`);
    if (f.resolucion) condiciones.push(contiene(`r.numero || '/' || r.anio`, f.resolucion));
    if (f.otorgadaDesde) condiciones.push(`c.fecha_otorgamiento >= ${param(f.otorgadaDesde)}`);
    if (f.otorgadaHasta) condiciones.push(`c.fecha_otorgamiento <= ${param(f.otorgadaHasta)}`);

    //3.- Titulares: por nombre o por documento (cualquiera de los vigentes).
    if (f.titular) condiciones.push(algunTitular(`${plano(NOMBRE_PERSONA)} ILIKE ${param(parecido(f.titular))}`));
    if (f.documento) {
      const digitos = soloDigitos(f.documento);
      condiciones.push(
        digitos
          ? algunTitular(`regexp_replace(p.documento, '\\D', '', 'g') LIKE ${param(`%${digitos}%`)}`)
          : algunTitular(`${plano('p.documento')} ILIKE ${param(parecido(f.documento))}`),
      );
    }

    //4.- Ubicación de la concesión (catálogo) e inmueble.
    if (f.departamento !== undefined) condiciones.push(`i.departamento_id = ${param(f.departamento)}`);
    if (f.localidad !== undefined) condiciones.push(`i.localidad_id = ${param(f.localidad)}`);
    if (f.distrito !== undefined) condiciones.push(`i.distrito_id = ${param(f.distrito)}`);
    if (f.cuenca !== undefined) condiciones.push(`i.cuenca_id = ${param(f.cuenca)}`);
    if (f.padron) condiciones.push(contiene('i.padron', f.padron));
    if (f.matricula) condiciones.push(contiene('i.matricula_catastral', f.matricula));
    if (f.circunscripcion) condiciones.push(`i.circunscripcion = ${param(f.circunscripcion)}`);
    if (f.seccion) condiciones.push(`i.seccion = ${param(f.seccion)}`);
    if (f.parcela) condiciones.push(contiene('i.parcela', f.parcela));
    if (f.matriculaDominio) condiciones.push(contiene('i.matricula_dominio', f.matriculaDominio));

    //5.- Usos, condiciones y caudal.
    if (f.tipoUso) condiciones.push(`EXISTS (SELECT 1 FROM con_uso u WHERE u.concesion_id = c.id AND u.vigente AND u.tipo_uso_codigo = ${param(f.tipoUso)})`);
    if (f.caracter) condiciones.push(`co.caracter = ${param(f.caracter)}`);
    if (f.codigoServicio !== undefined) condiciones.push(`co.codigo_servicio = ${param(f.codigoServicio)}`);
    if (f.caudalDesde !== undefined) condiciones.push(`co.caudal_lps >= ${param(f.caudalDesde)}`);
    if (f.caudalHasta !== undefined) condiciones.push(`co.caudal_lps <= ${param(f.caudalHasta)}`);

    //6.- Suministro.
    if (f.fuente) {
      const t = param(parecido(f.fuente));
      condiciones.push(`(${plano('s.fuente_principal')} ILIKE ${t} OR EXISTS (SELECT 1 FROM unnest(s.fuentes_adicionales) fa WHERE ${plano('fa')} ILIKE ${t}))`);
    }
    if (f.sistemaDistribucion) condiciones.push(contiene('s.sistema_distribucion', f.sistemaDistribucion));
    if (f.canal) {
      const t = param(parecido(f.canal));
      const canales = ['canal_principal', 'canal_secundario', 'canal_terciario', 'canal_cuarto', 'canal_quinto'];
      condiciones.push(`(${canales.map((k) => `${plano(`s.${k}`)} ILIKE ${t}`).join(' OR ')})`);
    }

    //7.- Polígono y deuda.
    if (f.conPoligono) condiciones.push(`${f.conPoligono === 'SI' ? '' : 'NOT '}EXISTS (SELECT 1 FROM con_poligono pg WHERE pg.concesion_id = c.id AND pg.vigente)`);
    if (f.conDeuda) condiciones.push(`${f.conDeuda === 'SI' ? '' : 'NOT '}EXISTS (SELECT 1 FROM rec_deuda d WHERE d.concesion_id = c.id AND d.estado = 'PENDIENTE')`);

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return { where, params, param };
  }

  /** Concesiones que cumplen TODOS los filtros, de a una página. */
  async buscar(f: BuscarConcesionesQuery) {
    const { where, params, param } = this.filtrar(f);
    const limite = param(f.porPagina);
    const desplazamiento = param((f.pagina - 1) * f.porPagina);

    //8.- Una fila por concesión con lo vigente de cada sección.
    const filas: Record<string, string | null>[] = await this.dataSource.query(
      `SELECT c.id, c.numero, c.estado, ec.nombre AS estado_nombre, ec.color AS estado_color, c.origen,
              to_char(c.fecha_otorgamiento, 'YYYY-MM-DD') AS fecha_otorgamiento, sl.nombre AS situacion_legal,
              e.id AS expediente_id, e.numero AS exp_numero, e.reparticion AS exp_reparticion, e.anio AS exp_anio, e.tipo_tramite,
              r.numero AS resolucion_numero, r.anio AS resolucion_anio,
              tit.principal, tit.documento, tit.cantidad AS cantidad_titulares,
              i.padron, i.matricula_catastral, i.circunscripcion, i.seccion, i.parcela,
              dep.nombre AS departamento, loc.nombre AS localidad, dis.codigo AS distrito, cu.nombre AS cuenca,
              co.caudal_lps, co.caracter, co.codigo_servicio, usos.detalle AS usos,
              s.fuente_principal, s.sistema_distribucion, s.canal_principal,
              pg.superficie_ha, (deu.pendientes > 0) AS con_deuda,
              count(*) OVER () AS total
         FROM con_concesion c
         LEFT JOIN cat_estado_concesion ec ON ec.codigo = c.estado::text
         LEFT JOIN cat_situacion_legal sl ON sl.codigo = c.situacion_legal_codigo
         LEFT JOIN exp_expediente e ON e.id = c.expediente_id
         LEFT JOIN exp_resolucion r ON r.id = c.resolucion_id
         LEFT JOIN con_inmueble i ON i.concesion_id = c.id AND i.vigente
         LEFT JOIN cat_departamento dep ON dep.id = i.departamento_id
         LEFT JOIN cat_localidad loc ON loc.id = i.localidad_id
         LEFT JOIN cat_distrito dis ON dis.id = i.distrito_id
         LEFT JOIN cat_cuenca cu ON cu.id = i.cuenca_id
         LEFT JOIN con_condicion co ON co.concesion_id = c.id AND co.vigente
         LEFT JOIN con_suministro s ON s.concesion_id = c.id AND s.vigente
         -- Titular principal (el primero cargado), su documento y cuántos son.
         LEFT JOIN LATERAL (SELECT (array_agg(${NOMBRE_PERSONA} ORDER BY t.orden))[1] AS principal,
                                   (array_agg(p.documento ORDER BY t.orden))[1] AS documento, count(*) AS cantidad
                              FROM con_titular t JOIN per_persona p ON p.id = t.persona_id
                             WHERE t.concesion_id = c.id AND t.vigente) tit ON true
         LEFT JOIN LATERAL (SELECT string_agg(tu.nombre || ' (' || trim(to_char(u.magnitud, 'FM999999990.##')) || ' ' || tu.unidad || ')', ', ' ORDER BY u.orden) AS detalle
                              FROM con_uso u JOIN cat_tipo_uso tu ON tu.codigo = u.tipo_uso_codigo
                             WHERE u.concesion_id = c.id AND u.vigente) usos ON true
         LEFT JOIN LATERAL (SELECT pg.superficie_ha FROM con_poligono pg WHERE pg.concesion_id = c.id AND pg.vigente LIMIT 1) pg ON true
         LEFT JOIN LATERAL (SELECT count(*) AS pendientes FROM rec_deuda d WHERE d.concesion_id = c.id AND d.estado = 'PENDIENTE') deu ON true
         ${where}
        ORDER BY ${ORDEN_SQL[f.orden]}
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      params,
    );

    const numero = (v: string | null) => (v === null ? null : Number(v));
    return {
      total: filas.length ? Number(filas[0].total) : 0,
      pagina: f.pagina,
      porPagina: f.porPagina,
      concesiones: filas.map((x) => ({
        id: String(x.id),
        numero: x.numero,
        estado: x.estado,
        estadoNombre: x.estado_nombre ?? x.estado,
        estadoColor: x.estado_color ?? 'gris',
        origen: x.origen,
        fechaOtorgamiento: x.fecha_otorgamiento,
        situacionLegal: x.situacion_legal,
        expediente: x.expediente_id && {
          id: String(x.expediente_id),
          numero: formatearNumeroExpediente(x.exp_numero!, x.exp_reparticion!, Number(x.exp_anio)),
          tipoTramite: x.tipo_tramite,
        },
        resolucion: x.resolucion_numero && `${x.resolucion_numero}/${x.resolucion_anio}`,
        titular: x.principal,
        documento: x.documento,
        cantidadTitulares: Number(x.cantidad_titulares ?? 0),
        padron: x.padron,
        matricula: x.matricula_catastral,
        circunscripcion: x.circunscripcion,
        seccion: x.seccion,
        parcela: x.parcela,
        departamento: x.departamento,
        localidad: x.localidad,
        distrito: x.distrito,
        cuenca: x.cuenca,
        caudalAsignado: numero(x.caudal_lps),
        caracter: x.caracter,
        codigoServicio: numero(x.codigo_servicio),
        usos: x.usos,
        fuente: x.fuente_principal,
        sistemaDistribucion: x.sistema_distribucion,
        canalPrincipal: x.canal_principal,
        superficieHa: numero(x.superficie_ha),
        // Postgres devuelve el booleano como tal (no como texto).
        conDeuda: Boolean(x.con_deuda),
      })),
    };
  }

  /** Ficha de una concesión: todo lo vigente, el expediente que la originó y las deudas pendientes. */
  async ficha(concesionId: string) {
    //1.- La concesión (con su resolución y situación legal).
    const concesion = await this.dataSource.manager.findOne(Concesion, { where: { id: concesionId }, relations: { expediente: true } });
    if (!concesion) throw new NotFoundException('No se encontró la concesión.');

    //2.- Lo vigente de cada sección, el polígono, el estado y las deudas.
    const datos = await cargarDatosVigentes(this.dataSource.manager, concesion.id);
    const [estado] = await this.dataSource.query<{ nombre: string; color: string }[]>('SELECT nombre, color FROM cat_estado_concesion WHERE codigo = $1', [concesion.estado]);
    const [poligono] = await this.dataSource.query<{ superficie_ha: string; perimetro_m: string; desde: string | null }[]>(
      `SELECT superficie_ha, perimetro_m, to_char(desde, 'YYYY-MM-DD') AS desde FROM con_poligono WHERE concesion_id = $1 AND vigente LIMIT 1`,
      [concesion.id],
    );
    const deudas = await this.dataSource.query<{ id: string; detalle: string | null; monto: string | null; creado_en: string; titular: string }[]>(
      `SELECT d.id, d.detalle, d.monto, d.creado_en, ${NOMBRE_PERSONA} AS titular
         FROM rec_deuda d JOIN per_persona p ON p.id = d.persona_id
        WHERE d.concesion_id = $1 AND d.estado = 'PENDIENTE' ORDER BY d.creado_en`,
      [concesion.id],
    );

    const { inmueble: i, condicion, suministro: s } = datos;
    const e = concesion.expediente;
    const punto = (tipo: TipoPunto) => {
      const p = datos.puntos.find((x) => x.tipo === tipo);
      return p ? { x: p.coordX === null ? null : Number(p.coordX), y: p.coordY === null ? null : Number(p.coordY), latitud: Number(p.latitud), longitud: Number(p.longitud), referencia: p.referencia } : null;
    };

    //3.- Se arma la ficha.
    return {
      id: concesion.id,
      numero: concesion.numero,
      estado: concesion.estado,
      estadoNombre: estado?.nombre ?? concesion.estado,
      estadoColor: estado?.color ?? 'gris',
      origen: concesion.origen,
      tipoDerecho: concesion.tipoDerecho,
      fechaOtorgamiento: concesion.fechaOtorgamiento,
      anioOtorgamiento: concesion.anioOtorgamiento,
      observaciones: concesion.observaciones,
      situacionLegal: concesion.situacionLegal?.nombre ?? null,
      resolucion: concesion.resolucion && { numero: concesion.resolucion.numero, anio: concesion.resolucion.anio, fecha: concesion.resolucion.fecha },
      expediente: e && { id: e.id, numero: formatearNumeroExpediente(e.numero, e.reparticion, e.anio), tipoTramite: e.tipoTramite, estado: e.estado },
      titulares: datos.titulares.map(({ persona: p }) => ({
        personaId: p.id,
        nombre: nombrePersona(p),
        tipoPersona: p.tipoPersona,
        tipoDocumento: p.tipoDocumento,
        documento: p.documento,
        email: p.email,
        telefono: p.telefono,
      })),
      domicilios: datos.domicilios.map((d) => ({
        calle: d.calle,
        numero: d.numero,
        departamento: d.departamento.nombre,
        localidad: d.localidad.nombre,
        distrito: d.distrito.codigo,
      })),
      ubicacion: {
        departamento: i?.departamento?.nombre ?? null,
        localidad: i?.localidad?.nombre ?? null,
        distrito: i?.distrito?.codigo ?? null,
        cuenca: i?.cuenca?.nombre ?? null,
      },
      inmueble: i && {
        padron: i.padron,
        matricula: i.matriculaCatastral,
        circunscripcion: i.circunscripcion,
        seccion: i.seccion,
        parcela: i.parcela,
        lamina: i.lamina,
        orden: i.orden,
        libro: i.libro,
        folio: i.folio,
        anioDominio: i.anioDominio,
        matriculaDominio: i.matriculaDominio,
        serie: i.serie,
      },
      condicion: condicion && {
        caracter: condicion.caracter,
        codigoServicio: condicion.codigoServicio,
        periodoInicio: condicion.periodoInicio,
        periodoFin: condicion.periodoFin,
        caudalAsignado: condicion.caudalLps == null ? null : Number(condicion.caudalLps),
      },
      usos: datos.usos.map((u) => ({
        nombre: u.tipoUso.nombre,
        unidad: u.tipoUso.unidad,
        magnitud: Number(u.magnitud),
        dotacion: Number(u.tipoUso.dotacion),
        caudal: Number(u.caudalLps),
      })),
      desague: punto(TipoPunto.DESAGUE),
      puntoEntrega: punto(TipoPunto.ENTREGA),
      suministro: s && {
        fuentes: s.fuentePrincipal ? [s.fuentePrincipal, ...s.fuentesAdicionales] : [],
        sistemaDistribucion: s.sistemaDistribucion,
        canales: [s.canalPrincipal, s.canalSecundario, s.canalTerciario, s.canalCuarto, s.canalQuinto].filter((c): c is string => c !== null),
        desague: s.desague,
        observacion: s.observacion,
      },
      poligono: poligono ? { superficieHa: Number(poligono.superficie_ha), perimetroM: Number(poligono.perimetro_m), desde: poligono.desde } : null,
      deudas: deudas.map((d) => ({ id: String(d.id), titular: d.titular, detalle: d.detalle, monto: d.monto === null ? null : Number(d.monto), registradaEn: d.creado_en })),
    };
  }
}
