// Copia local de las capas del GeoServer de la DRH (WFS) para no consultar el servicio a cada rato.
//
//   node scripts/sig/copiar-geoserver.mjs                 → capas de trabajo (lista CAPAS_BASE)
//   node scripts/sig/copiar-geoserver.mjs t07_parcelario  → solo las capas nombradas
//   node scripts/sig/copiar-geoserver.mjs --listar        → todas las capas que publica el servicio
//
// Cada capa queda en recursos/sig/geoserver/<capa>.geojson, en WGS84 (EPSG:4326, el GeoServer
// reproyecta desde POSGAR 2007 faja 3). Si alguna geometría no se deja reproyectar (pasa con
// t07_pozos), la capa se baja en su sistema original. manifiesto.json registra fecha, cantidad
// y sistema de coordenadas de cada una.
// La carpeta está en .gitignore: las capas tienen nombres y CUIT de titulares.
// Volver a correr el script reemplaza la copia con los datos del día.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WFS = process.env.GEOSERVER_WFS ?? 'http://192.168.11.105:8082/geoserver/wfs';
const WORKSPACE = 'DRH';
const DESTINO = join(import.meta.dirname, '..', '..', 'recursos', 'sig', 'geoserver');
const POR_PAGINA = 10000;

// t07_parcelario (345 mil parcelas) queda fuera: se baja a pedido, nombrándola.
const CAPAS_BASE = [
  't07_pozos',
  't07_concesiones',
  't_concesiones',
  't07_concesiones_anuladas',
  't07_concesiones_bebida_e_industriales',
  't07_permisos_precarios',
  't07_derecho_tradicional',
  't07_distritos',
  't07_departamentos',
  't07_tomas',
  't07_compuertas',
  't07_obras_arte',
  't07_canales_riego',
  't07_rios',
  't07_represas',
  't00_diques',
];

const url = (params) => `${WFS}?${new URLSearchParams({ service: 'WFS', version: '2.0.0', ...params })}`;

const pedir = async (params) => {
  const r = await fetch(url(params), { signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r;
};

/** Pide JSON; si el GeoServer contesta con una excepción OWS (XML), la convierte en error. */
const pedirJson = async (params) => {
  const cuerpo = await (await pedir(params)).text();
  if (cuerpo.startsWith('<')) {
    const motivo = cuerpo.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/)?.[1];
    throw new Error(motivo?.trim().split('\n').at(-1) ?? 'respuesta XML inesperada');
  }
  // Hay geometrías con coordenadas NaN (pozos mal cargados): el GeoServer las escribe tal cual.
  return JSON.parse(cuerpo.replace(/(?<=[[,:])\s*-?(NaN|Infinity)\b/g, 'null'));
};

/** Geometría con alguna coordenada inválida (null) → sin geometría. */
const sinCoordenadasInvalidas = (feature) =>
  JSON.stringify(feature.geometry?.coordinates ?? []).includes('null') ? { ...feature, geometry: null } : feature;

/** Todas las capas publicadas en el workspace. */
const listarCapas = async () => {
  const xml = await (await pedir({ request: 'GetCapabilities' })).text();
  return [...xml.matchAll(/<FeatureType[^>]*><Name>DRH:([^<]+)<\/Name><Title>([^<]*)<\/Title>/g)].map(
    ([, nombre, titulo]) => ({ nombre, titulo }),
  );
};

/** Baja una capa completa, de a POR_PAGINA elementos; sin srsName queda en su sistema original. */
const bajarCapa = async (capa, srsName) => {
  const elementos = [];
  let crs = null;
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const pagina = await pedirJson({
      request: 'GetFeature',
      typeNames: `${WORKSPACE}:${capa}`,
      outputFormat: 'application/json',
      ...(srsName && { srsName }),
      count: String(POR_PAGINA),
      // startIndex 0 se omite: las tablas sin clave primaria (t_concesiones) no admiten paginar.
      ...(inicio > 0 && { startIndex: String(inicio) }),
    });
    crs ??= pagina.crs;
    elementos.push(...pagina.features.map(sinCoordenadasInvalidas));
    process.stdout.write(`\r  ${capa}: ${elementos.length} de ${pagina.totalFeatures ?? '?'}`);
    if (pagina.features.length < POR_PAGINA) break;
  }
  process.stdout.write('\n');
  return { features: elementos, crs };
};

/** Filas de un CSV con comillas dobles (formato del GeoServer). */
const leerCsv = (texto) => {
  const filas = [[]];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') (campo += '"'), i++;
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') filas.at(-1).push(campo), (campo = '');
    else if (c === '\n') filas.at(-1).push(campo.replace(/\r$/, '')), (campo = ''), filas.push([]);
    else campo += c;
  }
  if (campo || filas.at(-1).length) filas.at(-1).push(campo);
  return filas.filter((f) => f.length > 1);
};

/** «POINT (x y)» → GeoJSON; cualquier coordenada que no sea un número finito → sin geometría. */
const puntoDeWkt = (wkt) => {
  const [x, y] = (wkt.match(/^POINT \((\S+) (\S+)\)$/)?.slice(1) ?? []).map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { type: 'Point', coordinates: [x, y] } : null;
};

/**
 * Plan C para capas de puntos que el GeoServer no puede escribir en JSON porque tienen
 * coordenadas infinitas (t07_pozos): se bajan en CSV, en el sistema original. WFS 1.0.0 para
 * que el WKT venga en orden x y (este, norte); en 2.0.0 el GeoServer lo invierte.
 */
const bajarCapaPorCsv = async (capa) => {
  const csv = await (
    await pedir({ version: '1.0.0', request: 'GetFeature', typeName: `${WORKSPACE}:${capa}`, outputFormat: 'csv' })
  ).text();
  const [encabezado, ...filas] = leerCsv(csv);
  const features = filas.map((fila) => {
    const { FID, geom, ...properties } = Object.fromEntries(encabezado.map((col, i) => [col, fila[i]]));
    const geometry = puntoDeWkt(geom);
    if (geom && !geometry && !/^POINT /.test(geom)) throw new Error(`geometría no soportada en CSV: ${geom.slice(0, 30)}`);
    return { type: 'Feature', id: FID, geometry, properties };
  });
  // El sistema original sale del DefaultCRS de la capa; hoy todas las de pozos están en 5345.
  const caps = await (await pedir({ request: 'GetCapabilities' })).text();
  const srs = caps.match(new RegExp(`<Name>${WORKSPACE}:${capa}</Name>[\\s\\S]*?<DefaultCRS>([^<]+)`))?.[1];
  console.log(`  ${capa}: ${features.length} (por CSV, ${features.filter((f) => !f.geometry).length} sin ubicación válida)`);
  return { features, crs: srs ? { type: 'name', properties: { name: srs } } : null };
};

/**
 * En WGS84; si la reproyección falla, en el sistema original de la capa; y si el GeoServer
 * tampoco puede escribirla en JSON (coordenadas infinitas), por CSV.
 */
const bajarCapaEnWgs84 = async (capa) => {
  try {
    return await bajarCapa(capa, 'EPSG:4326');
  } catch (error) {
    if (!/reproject|transformaci/i.test(error.message)) throw error;
    console.log(`\n  ${capa}: no se deja reproyectar a WGS84, se baja en su sistema original`);
  }
  try {
    return await bajarCapa(capa);
  } catch (error) {
    if (!/non-finite/i.test(error.message)) throw error;
    console.log(`\n  ${capa}: tiene coordenadas infinitas, se baja por CSV`);
    return bajarCapaPorCsv(capa);
  }
};

const args = process.argv.slice(2);
if (args.includes('--listar')) {
  for (const { nombre, titulo } of await listarCapas()) console.log(`${nombre.padEnd(48)} ${titulo}`);
  process.exit(0);
}

const capas = args.length ? args : CAPAS_BASE;
mkdirSync(DESTINO, { recursive: true });
const rutaManifiesto = join(DESTINO, 'manifiesto.json');
const manifiesto = existsSync(rutaManifiesto)
  ? JSON.parse(readFileSync(rutaManifiesto, 'utf8'))
  : { origen: WFS, capas: {} };

console.log(`Copiando ${capas.length} capa(s) de ${WFS}`);
let fallidas = 0;
for (const capa of capas) {
  try {
    const { features, crs } = await bajarCapaEnWgs84(capa);
    writeFileSync(join(DESTINO, `${capa}.geojson`), JSON.stringify({ type: 'FeatureCollection', crs, features }));
    manifiesto.capas[capa] = {
      cantidad: features.length,
      sinUbicacion: features.filter((f) => f.geometry === null).length,
      crs: crs?.properties?.name ?? 'sin geometría',
      copiada: new Date().toISOString(),
    };
  } catch (error) {
    fallidas++;
    console.error(`\n  ${capa}: no se pudo copiar (${error.message})`);
  }
}
writeFileSync(rutaManifiesto, JSON.stringify(manifiesto, null, 2));
console.log(`Listo en ${DESTINO}${fallidas ? ` — ${fallidas} capa(s) con error` : ''}`);
process.exit(fallidas ? 1 : 0);
