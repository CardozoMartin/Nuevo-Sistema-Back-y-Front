// Prepara recursos/sig/cauces-osm.json: el trazado REAL de ríos y canales de Tucumán, sacado de
// OpenStreetMap, para que el padrón de prueba ubique las concesiones a la vera de los cauces.
//
//   node scripts/demo/preparar-cauces.mjs <respuesta-overpass.json> [más.json…]
//
// La entrada es la respuesta JSON de Overpass (https://overpass-turbo.eu), por ejemplo:
//   [out:json];(way["waterway"~"river|canal"]["name"](-28.0,-65.9,-26.1,-64.6););out geom;
//
// Qué hace:
//   1. Une los tramos con el mismo nombre que se tocan en los extremos (en OSM un río son
//      muchos tramos sueltos).
//   2. Simplifica cada trazado (Douglas-Peucker, 10 m): menos puntos, misma forma.
//   3. Descarta los cauces con nombre de menos de 3 km (no entra una colonia de parcelas).
//      Los cauces SIN nombre (arroyos, acequias) se guardan con nombre null: no se usan para
//      ubicar colonias, solo para controlar que ninguna parcela quede cruzada por un cauce.
//
// Solo se corre de nuevo para actualizar los cauces: el archivo queda en el repositorio (lo usan
// la capa de ríos del visor, npm run sig:cauces, y el padrón de prueba) y
// el generador funciona sin conexión. Datos © colaboradores de OpenStreetMap (ODbL).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const entradas = process.argv.slice(2);
if (!entradas.length) {
  console.error('Uso: node scripts/demo/preparar-cauces.mjs <respuesta-overpass.json> [más.json…]');
  process.exit(1);
}

const M_LAT = 111320;
const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const distancia = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * mLng(y1), (y2 - y1) * M_LAT);
const largo = (linea) => linea.slice(1).reduce((acc, p, i) => acc + distancia(linea[i], p), 0);
const mismoPunto = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Douglas-Peucker en metros (aproximación local, suficiente para pocos km). */
function simplificar(linea, tolerancia) {
  if (linea.length < 3) return linea;
  const [a, b] = [linea[0], linea.at(-1)];
  const k = mLng(a[1]);
  const [ax, ay, bx, by] = [a[0] * k, a[1] * M_LAT, b[0] * k, b[1] * M_LAT];
  const largoAB = Math.hypot(bx - ax, by - ay) || 1;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < linea.length - 1; i++) {
    const [px, py] = [linea[i][0] * k, linea[i][1] * M_LAT];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / largoAB;
    if (d > maxD) [maxD, idx] = [d, i];
  }
  if (maxD <= tolerancia) return [a, b];
  return [...simplificar(linea.slice(0, idx + 1), tolerancia).slice(0, -1), ...simplificar(linea.slice(idx), tolerancia)];
}

// --- 1. Tramos por nombre --------------------------------------------------------------
const tramos = new Map();
const vistos = new Set();
for (const archivo of entradas) {
  const { elements } = JSON.parse(readFileSync(archivo, 'utf8'));
  for (const w of elements) {
    if (w.type !== 'way' || !w.geometry || vistos.has(w.id)) continue;
    vistos.add(w.id);
    const clave = `${w.tags?.waterway}|${w.tags?.name ?? ''}`;
    if (!tramos.has(clave)) tramos.set(clave, []);
    tramos.get(clave).push(w.geometry.map((g) => [g.lon, g.lat]));
  }
}

// --- 2. Unir los tramos que se tocan en los extremos -----------------------------------
function unir(lineas) {
  const pendientes = lineas.map((l) => [...l]);
  const unidas = [];
  while (pendientes.length) {
    let actual = pendientes.shift();
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (let i = 0; i < pendientes.length; i++) {
        const otra = pendientes[i];
        if (mismoPunto(actual.at(-1), otra[0])) actual = [...actual, ...otra.slice(1)];
        else if (mismoPunto(actual.at(-1), otra.at(-1))) actual = [...actual, ...otra.reverse().slice(1)];
        else if (mismoPunto(actual[0], otra.at(-1))) actual = [...otra, ...actual.slice(1)];
        else if (mismoPunto(actual[0], otra[0])) actual = [...otra.reverse(), ...actual.slice(1)];
        else continue;
        pendientes.splice(i, 1);
        cambio = true;
        break;
      }
    }
    unidas.push(actual);
  }
  return unidas;
}

const cauces = [];
for (const [clave, lineas] of tramos) {
  const [tipo, nombre] = clave.split('|');
  for (const linea of unir(lineas)) {
    const metros = largo(linea);
    if (metros < (nombre ? 3000 : 200)) continue;
    cauces.push({
      nombre: nombre || null,
      tipo: tipo === 'canal' ? 'CANAL' : 'RIO',
      largoKm: +(metros / 1000).toFixed(1),
      linea: simplificar(linea, 10).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]),
    });
  }
}
cauces.sort((a, b) => b.largoKm - a.largoKm);

const salida = join(aqui, '../../recursos/sig/cauces-osm.json');
writeFileSync(
  salida,
  JSON.stringify({ fuente: '© colaboradores de OpenStreetMap (ODbL) — https://www.openstreetmap.org/copyright', cauces }),
);
console.log(`${cauces.length} cauces → ${salida} (${cauces.filter((c) => !c.nombre).length} sin nombre, solo para el control de cruces)`);
for (const c of cauces.filter((c) => c.nombre)) console.log(`  ${c.tipo.padEnd(5)} ${c.nombre.padEnd(30)} ${String(c.largoKm).padStart(6)} km  ${c.linea.length} puntos`);
