// Convierte una capa de concesiones exportada de QGIS (GeoJSON) al formato del importador del
// padrón (src/migracion/fila-padron.ts), para cargarla con:  npm run migracion -- importar <salida.json>
//
//   node scripts/sig/capa-qgis-a-padron.mjs <capa.geojson> [salida.json] [--distrito I]
//
// La capa es la que arman en Catastro: un polígono por parcela con los datos de la concesión
// (columnas concesion, Usuario, Tipo, DNI, CUIT_CUIL, Padron_Ren, Padron_Cat, Caracter, Cod_Ser,
// Uso, Magnitud, Localidad, Departamen, Fuente, Sistema, Canal_prin…Canal_quin, Desague).
//
//   1. Agrupa por número de concesión: las parcelas de una misma concesión se juntan en un
//      solo MultiPolygon (el sistema guarda un polígono vigente por concesión).
//   2. Las coordenadas quedan como vienen (POSGAR 2007 faja 3 o WGS84): el importador
//      reconoce el sistema y valida la geometría con PostGIS.
//   3. Avisa lo que no se puede importar (polígonos sin número) y las parcelas de una misma
//      concesión con datos distintos (se toman los de la primera).
//
// Usar el GeoJSON y no el .xls de la misma capa: el .xls que exporta QGIS rompe las Ñ y los º.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const distrito = opcion('distrito') ?? null;
const [entrada, salida = entrada?.replace(/\.geojson$/i, '') + '.padron.json'] = args;
if (!entrada) {
  console.error('Uso: node scripts/sig/capa-qgis-a-padron.mjs <capa.geojson> [salida.json] [--distrito I]');
  process.exit(1);
}

//1.- Lectura y control del sistema de coordenadas declarado.
const capa = JSON.parse(readFileSync(entrada, 'utf8'));
const crs = capa.crs?.properties?.name ?? '';
if (crs && !/(EPSG::?(5345|4326)|CRS84)$/.test(crs)) {
  console.error(`La capa está en ${crs}. Exportala desde QGIS en EPSG:5345 (POSGAR 2007 faja 3) o en WGS84.`);
  process.exit(1);
}

/** Texto limpio o null. */
const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
/** Número de la capa («9», «9,5») o null. */
const numero = (v) => {
  const n = Number(texto(v)?.replace(',', '.'));
  return texto(v) !== null && Number.isFinite(n) ? n : null;
};

/** Columnas de la capa → FilaPadron (sin la geometría). */
const datosDeFila = (p) => ({
  otorgamiento: texto(p.concesion),
  titulares: texto(p.Usuario),
  tipoTitular: texto(p.Tipo),
  documento: texto(p.DNI),
  cuit: texto(p.CUIT_CUIL),
  padronRentas: texto(p.Padron_Ren),
  padronCatastro: texto(p.Padron_Cat),
  caracter: texto(p.Caracter),
  codigoServicio: numero(p.Cod_Ser),
  uso: texto(p.Uso),
  cantidad: numero(p.Magnitud),
  localidad: texto(p.Localidad),
  departamento: texto(p.Departamen),
  distrito,
  fuente: texto(p.Fuente),
  sistema: texto(p.Sistema),
  canalPrincipal: texto(p.Canal_prin),
  canalSecundario: texto(p.Canal_secu),
  canalTerciario: texto(p.Canal_terc),
  canalCuarto: texto(p.Canal_cuat),
  canalQuinto: texto(p.Canal_quin),
  desague: texto(p.Desague),
});

/** Polígonos de una geometría (Polygon o MultiPolygon) como lista de anillos. */
const poligonos = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);

//2.- Agrupación por concesión, en el orden de la capa.
const porConcesion = new Map();
let sinNumero = 0;
let sinGeometria = 0;
const distintos = [];
for (const { properties, geometry } of capa.features) {
  const datos = datosDeFila(properties ?? {});
  if (!datos.otorgamiento) {
    sinNumero++;
    continue;
  }
  const partes = poligonos(geometry);
  if (!partes.length) sinGeometria++;
  const grupo = porConcesion.get(datos.otorgamiento);
  if (!grupo) {
    porConcesion.set(datos.otorgamiento, { ...datos, geometria: { type: 'MultiPolygon', coordinates: [...partes] }, parcelas: 1 });
    continue;
  }
  grupo.geometria.coordinates.push(...partes);
  grupo.parcelas++;
  if (Object.keys(datos).some((k) => datos[k] !== grupo[k])) distintos.push(datos.otorgamiento);
}

//3.- Salida: las filas para el importador (sin el contador de parcelas).
const filas = [...porConcesion.values()].map(({ parcelas: _parcelas, geometria, ...datos }) => ({
  ...datos,
  geometria: geometria.coordinates.length ? geometria : null,
}));
writeFileSync(salida, JSON.stringify(filas));

const grupos = [...porConcesion.values()];
console.log(`${capa.features.length} polígonos → ${filas.length} concesiones (${grupos.filter((g) => g.parcelas > 1).length} con varias parcelas).`);
console.log(`Sin datos (solo el polígono): ${filas.filter((f) => !f.titulares && !f.uso && !f.fuente).length}.`);
if (sinNumero) console.log(`AVISO: ${sinNumero} polígono(s) sin número de concesión: no se pueden importar.`);
if (sinGeometria) console.log(`AVISO: ${sinGeometria} fila(s) sin geometría.`);
if (distintos.length) console.log(`AVISO: parcelas de una misma concesión con datos distintos (se usaron los de la primera): ${[...new Set(distintos)].join(', ')}.`);
console.log(`Archivo: ${salida}`);
