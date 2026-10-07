// Escribe docs/tablas.md con la estructura REAL de la base: cada tabla con sus columnas,
// claves, índices y controles (CHECK), tal como los creó TypeORM a partir de las entidades.
//
// Uso (con la base levantada):  npm run db:tablas
//
// Pasos:
//   1. Se conecta con los datos del .env (o los de desarrollo por defecto).
//   2. Lee el catálogo de PostgreSQL: tablas, columnas, claves foráneas, índices y CHECKs.
//   3. Agrupa las tablas por prefijo (cat_, con_, exp_…) y arma el Markdown.
//   4. Lo guarda en docs/tablas.md.
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const PREFIJOS = {
  cat_: 'Catálogos',
  con_: 'Concesiones',
  emp_: 'Empresas perforadoras',
  exp_: 'Expedientes',
  mig_: 'Migración del padrón',
  per_: 'Personas',
  poz_: 'Pozos',
  rec_: 'Recaudación',
  seg_: 'Seguridad',
};

//1.- Conexión (mismas variables que la API).
const cliente = new pg.Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  database: process.env.DB_NAME ?? 'drh_sistema',
  user: process.env.DB_USER ?? 'drh',
  password: process.env.DB_PASSWORD ?? 'drh_dev',
});
await cliente.connect();

//2.- Catálogo de PostgreSQL.
const consulta = async (sql) => (await cliente.query(sql)).rows;

const tablas = await consulta(`
  SELECT c.relname AS tabla, obj_description(c.oid) AS comentario
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'spatial_ref_sys'
   ORDER BY c.relname`);

const columnas = await consulta(`
  SELECT c.relname AS tabla, a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo,
         a.attnotnull AS obligatoria, pg_get_expr(d.adbin, d.adrelid) AS por_defecto
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
   ORDER BY c.relname, a.attnum`);

const restricciones = await consulta(`
  SELECT c.relname AS tabla, r.conname AS nombre, r.contype AS tipo, pg_get_constraintdef(r.oid) AS definicion
    FROM pg_constraint r
    JOIN pg_class c ON c.oid = r.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
   ORDER BY c.relname, r.contype, r.conname`);

const indices = await consulta(`
  SELECT tablename AS tabla, indexname AS nombre, indexdef AS definicion
    FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname`);

const enumerados = await consulta(`
  SELECT t.typname AS nombre, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   GROUP BY t.typname ORDER BY t.typname`);

// Vistas: no guardan datos, son consultas guardadas que se leen como una tabla.
const vistas = await consulta(`
  SELECT table_schema || '.' || table_name AS vista,
         string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) AS columnas
    FROM information_schema.columns
   WHERE (table_schema, table_name) IN (SELECT schemaname, viewname FROM pg_views WHERE schemaname IN ('public', 'sig')
                                         -- Las de PostGIS no son del sistema.
                                         AND viewname NOT IN ('geography_columns', 'geometry_columns'))
   GROUP BY table_schema, table_name
   ORDER BY 1`);

await cliente.end();

//3.- Markdown, agrupado por prefijo.
const de = (lista, tabla) => lista.filter((x) => x.tabla === tabla);
const celda = (texto) => String(texto ?? '').replaceAll('|', '\\|');

/** Qué columna es clave primaria o foránea, para marcarla en la tabla de columnas. */
function marcasDeColumnas(tabla) {
  const marcas = {};
  for (const r of de(restricciones, tabla)) {
    const cols = /\(([^)]+)\)/.exec(r.definicion)?.[1].split(',').map((c) => c.trim()) ?? [];
    if (r.tipo === 'p') cols.forEach((c) => (marcas[c] = 'PK'));
    if (r.tipo === 'f') {
      const destino = /REFERENCES (\w+)\((\w+)\)/.exec(r.definicion);
      cols.forEach((c) => (marcas[c] = `FK → ${destino?.[1]}.${destino?.[2]}`));
    }
  }
  return marcas;
}

function documentarTabla({ tabla, comentario }) {
  const marcas = marcasDeColumnas(tabla);
  const lineas = [`### \`${tabla}\``, ''];
  if (comentario) lineas.push(comentario, '');

  lineas.push('| Columna | Tipo | Obligatoria | Por defecto | Clave |', '| --- | --- | --- | --- | --- |');
  for (const c of de(columnas, tabla)) {
    lineas.push(`| \`${c.columna}\` | ${celda(c.tipo)} | ${c.obligatoria ? 'sí' : 'no'} | ${celda(c.por_defecto)} | ${celda(marcas[c.columna])} |`);
  }

  const checks = de(restricciones, tabla).filter((r) => r.tipo === 'c');
  const unicas = de(restricciones, tabla).filter((r) => r.tipo === 'u');
  const otrosIndices = de(indices, tabla).filter((i) => !de(restricciones, tabla).some((r) => r.nombre === i.nombre));

  if (unicas.length || otrosIndices.length) {
    lineas.push('', '**Índices**', '');
    for (const u of unicas) lineas.push(`- \`${u.nombre}\`: ${u.definicion}`);
    for (const i of otrosIndices) lineas.push(`- \`${i.nombre}\`: ${i.definicion.replace(/^CREATE (UNIQUE )?INDEX \S+ ON public\.\S+ /, (_, u) => (u ? 'UNIQUE ' : ''))}`);
  }
  if (checks.length) {
    lineas.push('', '**Controles (CHECK)**', '');
    for (const c of checks) lineas.push(`- \`${c.nombre}\`: ${c.definicion}`);
  }
  return lineas.join('\n');
}

const partes = [
  '# Tablas de la base `drh_sistema`',
  '',
  `> Generado con \`npm run db:tablas\` el ${new Date().toLocaleString('es-AR')}. **No editar a mano:** se vuelve a generar.`,
  '> Las tablas las crea TypeORM a partir de las entidades (`src/**/entities/*.entity.ts`); ver «Cómo se generan las tablas» en `PROCESOS_BACKEND.md`.',
  '',
];
for (const [prefijo, titulo] of Object.entries(PREFIJOS)) {
  const grupo = tablas.filter((t) => t.tabla.startsWith(prefijo));
  if (!grupo.length) continue;
  partes.push(`## ${titulo} (\`${prefijo}\`)`, '', ...grupo.flatMap((t) => [documentarTabla(t), '']));
}
partes.push(
  '## Vistas',
  '',
  'Consultas guardadas que se leen como una tabla (no guardan datos). Su SQL está en las `*ViewEntity` del código.',
  '',
  '| Vista | Columnas |',
  '| --- | --- |',
  ...vistas.map((v) => `| \`${v.vista}\` | ${celda(v.columnas)} |`),
  '',
);
partes.push('## Enumerados', '', '| Tipo | Valores |', '| --- | --- |', ...enumerados.map((e) => `| \`${e.nombre}\` | ${e.valores} |`), '');

//4.- Archivo.
writeFileSync('docs/tablas.md', partes.join('\n'));
console.log(`docs/tablas.md: ${tablas.length} tablas.`);
