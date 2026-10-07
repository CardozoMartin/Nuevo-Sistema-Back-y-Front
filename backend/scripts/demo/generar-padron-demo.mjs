// Genera un padrón de concesiones FICTICIO para probar el sistema, con el mismo formato
// de columnas que la planilla real (BASE_DE_DATOS_LA_AGUADITA.xlsx) más el polígono y los pozos.
//
//   node scripts/demo/generar-padron-demo.mjs [cantidad=150] [salida=datos/demo/padron-demo.json]
//
// - Los nombres de personas y empresas son INVENTADOS (combinaciones al azar).
// - Lugares, distritos, cuencas, ríos, diques y canales salen de catalogo-departamentos.json,
//   extraído de la planilla real (solo nombres geográficos y de infraestructura).
// - Las parcelas se agrupan en «colonias» a la vera de ríos y canales REALES (recursos/sig/cauces-osm.json,
//   de OpenStreetMap), como en el terreno: una fila de parcelas contiguas con frente al cauce,
//   que comparten los linderos. En cada colonia se mezclan:
//     · fincas grandes (60 a 400 ha), de fondo largo, con 1 a 4 pozos adentro;
//     · grupos de chacras chicas (2 a 25 ha) sobre el frente, con una parcela «de fondo»
//       detrás que completa la manzana. Algunas tienen un pozo chico.
// - Casos a propósito para probar el sistema: superposiciones, un polígono inválido,
//   concesiones sin polígono y un pozo que cae fuera de su concesión.
// - Es determinístico (semilla fija): siempre genera los mismos datos.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const CANTIDAD = Number(process.argv[2] ?? 150);
const SALIDA = process.argv[3] ?? 'datos/demo/padron-demo.json';
const catalogo = JSON.parse(readFileSync(join(aqui, 'catalogo-departamentos.json'), 'utf8'));
const { cauces } = JSON.parse(readFileSync(join(aqui, '../../recursos/sig/cauces-osm.json'), 'utf8'));

// --- Azar reproducible (mulberry32) ----------------------------------------------------
let semilla = 20261002;
function azar() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + azar() * (max - min);
const entero = (min, max) => Math.floor(entre(min, max + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
/** Elige una clave de { clave: peso }. */
function elegirPonderado(pesos) {
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  let r = azar() * total;
  for (const [clave, peso] of Object.entries(pesos)) if ((r -= peso) <= 0) return clave;
  return Object.keys(pesos)[0];
}

// --- Nombres inventados ------------------------------------------------------------------
const APELLIDOS = ['GONZALEZ', 'RODRIGUEZ', 'GOMEZ', 'FERNANDEZ', 'LOPEZ', 'DIAZ', 'MARTINEZ', 'PEREZ', 'GARCIA', 'SANCHEZ', 'ROMERO', 'SOSA', 'TORRES', 'ALVAREZ', 'RUIZ', 'RAMIREZ', 'FLORES', 'BENITEZ', 'ACOSTA', 'MEDINA', 'HERRERA', 'AGUIRRE', 'PAZ', 'CORDOBA', 'JUAREZ', 'LUNA', 'CABRERA', 'RIOS', 'MOLINA', 'VILLAGRA', 'CARRIZO', 'ZELAYA', 'ARAOZ', 'COLOMBRES', 'NOUGUES', 'PADILLA', 'TERAN', 'FRIAS', 'POSSE', 'ALBARRACIN'];
const NOMBRES = ['JOSE', 'JUAN CARLOS', 'MARIA', 'ANA', 'LUIS', 'CARLOS ALBERTO', 'JORGE', 'MIGUEL ANGEL', 'ROSA', 'PEDRO', 'RAMON', 'SILVIA', 'HUGO', 'MARTA', 'RAUL', 'NORMA', 'OSCAR', 'GRACIELA', 'DANIEL', 'ELENA'];
const EMPRESAS = ['AGROPECUARIA', 'CITRICOLA', 'ESTABLECIMIENTO', 'FINCA', 'AGRICOLA', 'GANADERA'];
const NOMBRES_EMPRESA = ['EL CEIBO', 'LOS NOGALES', 'SAN AGUSTIN', 'LA FLORIDA', 'EL TALAR', 'SANTA ROSA', 'LOS ALISOS', 'EL PALOMAR', 'LA ESPERANZA', 'SAN JOSE', 'EL MOLLAR', 'LAS TIPAS'];
const SOCIEDADES = ['S.A.', 'S.R.L.', 'S.A.S.'];

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
function cuitValido(prefijo) {
  for (;;) {
    const base = `${prefijo}${String(entero(10000000, 99999999))}`;
    const suma = PESOS_CUIT.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const v = 11 - (suma % 11);
    if (v === 10) continue;
    return `${base}${v === 11 ? 0 : v}`;
  }
}
const persona = () => `${elegir(APELLIDOS)} ${elegir(NOMBRES)}`;
const empresa = () => `${elegir(EMPRESAS)} ${elegir(NOMBRES_EMPRESA)} ${elegir(SOCIEDADES)}`;

/** Titulares según el tamaño: las fincas grandes suelen ser de empresas; las chacras, de personas. */
function titularesDe(tamano) {
  const r = azar();
  const pEmpresa = tamano === 'grande' ? 0.55 : tamano === 'fondo' ? 0.2 : 0.06;
  if (r < pEmpresa) return { titulares: empresa(), documento: null, cuit: azar() < 0.8 ? cuitValido('30') : null };
  if (r < pEmpresa + 0.13) return { titulares: Array.from({ length: entero(2, 4) }, persona).join(' | '), documento: null, cuit: null };
  if (azar() < 0.45) return { titulares: persona(), documento: entero(8000000, 45000000), cuit: null };
  return { titulares: persona(), documento: null, cuit: azar() < 0.5 ? cuitValido(elegir(['20', '27'])) : null };
}

// --- Geometría local (metros) ----------------------------------------------------------------
// Cada colonia se calcula en un plano local en metros (x este, y norte) alrededor de un punto
// de referencia: a esta escala (pocos km) el error de la aproximación es despreciable.
const M_LAT = 111320;
const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const plano = (lat0, lng0) => ({
  aMetros: ([lng, lat]) => [(lng - lng0) * mLng(lat0), (lat - lat0) * M_LAT],
  aGrados: ([x, y]) => [+(lng0 + x / mLng(lat0)).toFixed(7), +(lat0 + y / M_LAT).toFixed(7)],
});

/** Remuestrea una línea cada `paso` metros. */
function remuestrear(linea, paso) {
  const salida = [linea[0]];
  let resto = 0;
  for (let i = 1; i < linea.length; i++) {
    const [ax, ay] = linea[i - 1];
    const [bx, by] = linea[i];
    const largo = Math.hypot(bx - ax, by - ay);
    let d = paso - resto;
    while (d <= largo) {
      salida.push([ax + ((bx - ax) * d) / largo, ay + ((by - ay) * d) / largo]);
      d += paso;
    }
    resto = largo - (d - paso);
  }
  return salida;
}

/** Media móvil de ±`radio` muestras: el «eje» suavizado del cauce, sin meandros. */
function suavizar(puntos, radio) {
  return puntos.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = Math.max(0, i - radio); j <= Math.min(puntos.length - 1, i + radio); j++) {
      sx += puntos[j][0];
      sy += puntos[j][1];
      n++;
    }
    return [sx / n, sy / n];
  });
}

/** Superficie (m²) de un anillo. */
const areaAnillo = (anillo) => Math.abs(anillo.slice(0, -1).reduce((acc, [x1, y1], i) => acc + x1 * anillo[i + 1][1] - anillo[i + 1][0] * y1, 0)) / 2;

/** ¿Se cruzan los segmentos ab y cd (sin contar extremos compartidos)? */
function seCruzan(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
/** Un anillo es simple si ningún par de lados no consecutivos se cruza. */
function esSimple(anillo) {
  const n = anillo.length - 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (seCruzan(anillo[i], anillo[i + 1], anillo[j], anillo[j + 1])) return false;
    }
  }
  return true;
}
function dentro([x, y], anillo) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 2; i < anillo.length - 1; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
/** ¿Algún lado de un anillo cruza uno del otro? (los linderos compartidos no cuentan). */
function seCruzanBordes(a, b) {
  for (let i = 0; i < a.length - 1; i++) for (let j = 0; j < b.length - 1; j++) if (seCruzan(a[i], a[i + 1], b[j], b[j + 1])) return true;
  return false;
}
/** ¿Se pisan dos anillos? (algún lado se cruza o uno contiene al otro). */
function sePisan(a, b) {
  if (seCruzanBordes(a, b)) return true;
  const centro = (r) => r.slice(0, -1).reduce(([sx, sy], [x, y]) => [sx + x / (r.length - 1), sy + y / (r.length - 1)], [0, 0]);
  return dentro(centro(a), b) || dentro(centro(b), a);
}

// --- Departamentos y zonas -------------------------------------------------------------------
/** Punto rural de referencia de cada departamento: la colonia toma el departamento del más cercano. */
const ANCLAS = {
  BURRUYACU: [-26.5, -64.75],
  'CRUZ ALTA': [-26.89, -65.02],
  CHICLIGASTA: [-27.36, -65.53],
  FAMAILLA: [-27.07, -65.38],
  GRANEROS: [-27.66, -65.4],
  'JUAN B. ALBERDI': [-27.6, -65.58],
  'LA COCHA': [-27.79, -65.53],
  LEALES: [-27.16, -65.24],
  LULES: [-26.96, -65.37],
  MONTEROS: [-27.19, -65.45],
  'RIO CHICO': [-27.46, -65.55],
  SIMOCA: [-27.28, -65.37],
  'TAFI DEL VALLE': [-26.87, -65.7],
  'TAFI VIEJO': [-26.68, -65.2],
  TRANCAS: [-26.24, -65.27],
};
/** Cascos urbanos (lat, lng, radio en m): no se ponen colonias encima. */
const CIUDADES = [
  [-26.83, -65.21, 9000], // San Miguel de Tucumán y alrededores
  [-27.34, -65.59, 3000], // Concepción
  [-27.43, -65.61, 2500], // Aguilares
  [-27.17, -65.5, 2000], // Monteros
  [-27.05, -65.4, 2000], // Famaillá
  [-26.94, -65.35, 2000], // Lules
  [-27.25, -65.36, 1500], // Simoca
  [-26.27, -65.29, 1500], // Trancas
  [-27.77, -65.58, 1500], // La Cocha
  [-27.58, -65.62, 1500], // Juan B. Alberdi
];
const distanciaM = ([lat1, lng1], [lat2, lng2]) => Math.hypot((lat2 - lat1) * M_LAT, (lng2 - lng1) * mLng(lat1));
function departamentoDe(lat, lng) {
  let mejor = null;
  for (const [d, ancla] of Object.entries(ANCLAS)) {
    const dist = distanciaM([lat, lng], ancla);
    if (catalogo[d] && (!mejor || dist < mejor.dist)) mejor = { d, dist };
  }
  return mejor;
}
/** Zona donde puede ir una colonia: llanura o valle de Tucumán, cerca de un departamento conocido y lejos de las ciudades. */
function zonaValida(lat, lng) {
  if (lat < -27.95 || lat > -26.1 || lng < -65.75 || lng > -64.6) return false;
  if (lng < -65.66 && distanciaM([lat, lng], ANCLAS['TAFI DEL VALLE']) > 7000) return false; // sierra
  if (CIUDADES.some(([la, ln, r]) => distanciaM([lat, lng], [la, ln]) < r)) return false;
  return departamentoDe(lat, lng).dist < 22000;
}

const sinAcentos = (t) => t.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Suministro del catálogo del departamento que sale del mismo río (si lo hay). */
function suministroDe(c, cauce) {
  const nombre = sinAcentos(cauce.nombre).replace(/^(RIO|ARROYO|CANAL|ACEQUIA)\s+(DEL?\s+)?/, '');
  const delRio = c.suministros.filter((s) => s.fuente && sinAcentos(s.fuente).includes(nombre));
  return elegir(delRio.length ? delRio : c.suministros);
}

// --- Colonias ----------------------------------------------------------------------------------
const PASO = 25; // metros entre muestras del cauce
const parcelas = []; // { anillo (grados), tamano, departamento, cauce, pozos[] }
const ocupados = []; // anillos ya ubicados (grados), para que las colonias no se pisen

/**
 * Arma una fila de parcelas sobre un lado del cauce, entre las muestras [i0, i1] del eje.
 * Devuelve los anillos en metros (o null si la geometría no da: curva muy cerrada).
 */
function filaDeParcelas(eje, real, lado, i0, i1) {
  // Normal al eje en cada muestra, hacia el lado de la fila.
  const normal = (i) => {
    const [ax, ay] = eje[Math.max(0, i - 2)];
    const [bx, by] = eje[Math.min(eje.length - 1, i + 2)];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [(-(by - ay) / l) * lado, ((bx - ax) / l) * lado];
  };
  const punto = (i, d) => {
    const [nx, ny] = normal(i);
    return [eje[i][0] + nx * d, eje[i][1] + ny * d];
  };
  // Retiro del frente: lo que más se aparta el cauce real del eje hacia este lado, + 40 m de ribera.
  let retiro = 0;
  for (let i = i0; i <= i1; i++) {
    const [nx, ny] = normal(i);
    retiro = Math.max(retiro, (real[i][0] - eje[i][0]) * nx + (real[i][1] - eje[i][1]) * ny);
  }
  retiro = Math.min(retiro, 350) + entre(40, 90);

  // Profundidad máxima sin que las normales se crucen: en una curva, las perpendiculares del
  // lado de adentro se juntan a una distancia igual al radio de la curva. Más allá, una
  // parcela se doblaría sobre la vecina. Se deja un 30 % de margen.
  let alcance = Infinity;
  for (let i = i0; i < i1; i++) {
    const t = [eje[i + 1][0] - eje[i][0], eje[i + 1][1] - eje[i][1]];
    const [n0, n1] = [normal(i), normal(i + 1)];
    const avance = t[0] * t[0] + t[1] * t[1];
    const giro = (n1[0] - n0[0]) * t[0] + (n1[1] - n0[1]) * t[1];
    if (giro < 0) alcance = Math.min(alcance, (0.7 * avance) / -giro);
  }
  const profundidadMax = Math.min(1900, alcance - retiro);
  if (profundidadMax < 500) return null;

  // Cada parcela es una lista de vértices [muestra, distancia al eje]. Los vértices son
  // compartidos: los linderos de vecinos coinciden exactamente (sin huecos ni astillas).
  // Se toma un vértice cada 4 muestras (100 m) y siempre los cortes.
  const anillo = (a, b, d1, d2, cortes = []) => {
    const idx = [...new Set([a, b, ...cortes, ...Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((i) => i % 4 === 0)])]
      .filter((i) => i >= a && i <= b)
      .sort((x, y) => x - y);
    return { a, b, d1, d2, frente: idx.map((i) => [i, d1]), fondo: idx.map((i) => [i, d2]).reverse() };
  };

  const fila = [];
  let i = i0;
  while (i < i1) {
    // Bloque: una finca grande, o un grupo de chacras con una parcela de fondo detrás.
    const profundidad = entre(Math.min(900, profundidadMax * 0.7), profundidadMax);
    if (azar() < 0.45) {
      const ancho = Math.round(entre(500, 1600) / PASO);
      if (i + ancho > i1) break;
      fila.push({ ...anillo(i, i + ancho, retiro, retiro + profundidad), tamano: 'grande' });
      i += ancho;
    } else {
      const fondoChacras = entre(0.3, 0.55) * profundidad;
      const cortes = [i];
      for (let k = entero(2, 5); k > 0; k--) cortes.push(cortes.at(-1) + Math.round(entre(90, 320) / PASO));
      const fin = cortes.at(-1);
      if (fin > i1) break;
      for (let k = 0; k < cortes.length - 1; k++) fila.push({ ...anillo(cortes[k], cortes[k + 1], retiro, retiro + fondoChacras), tamano: 'chacra' });
      // La de fondo lleva todos los cortes en su frente: comparte cada lindero con las chacras.
      fila.push({ ...anillo(i, fin, retiro + fondoChacras, retiro + profundidad, cortes), tamano: 'fondo' });
      i = fin;
    }
  }

  // Esquinas en «T»: donde la esquina de una parcela cae sobre el lindero lateral de la
  // vecina (por ejemplo, el fondo de una chacra contra el costado de una finca grande), se
  // agrega ese vértice también a la vecina. Sin esto, el redondeo deja astillas de pocos m².
  const esquinas = new Map();
  for (const p of fila) for (const [i, d] of [[p.a, p.d1], [p.a, p.d2], [p.b, p.d1], [p.b, p.d2]]) esquinas.set(i, [...(esquinas.get(i) ?? []), d]);
  const lateral = (i, desde, hasta) =>
    [...new Set(esquinas.get(i) ?? [])].filter((d) => d > Math.min(desde, hasta) && d < Math.max(desde, hasta)).sort((x, y) => (desde < hasta ? x - y : y - x)).map((d) => [i, d]);

  const anillos = fila.map((p) => {
    const vertices = [...p.frente, ...lateral(p.b, p.d1, p.d2), ...p.fondo, ...lateral(p.a, p.d2, p.d1)];
    const puntos = vertices.map(([i, d]) => punto(i, d));
    return { anillo: [...puntos, puntos[0]], tamano: p.tamano };
  });
  if (!anillos.every((p) => esSimple(p.anillo))) return null;
  // Control final: ningún par de parcelas de la fila se cruza.
  for (let x = 0; x < anillos.length; x++) for (let y = x + 1; y < anillos.length; y++) if (seCruzanBordes(anillos[x].anillo, anillos[y].anillo)) return null;
  return anillos;
}

/** Pozos dentro de una parcela (en metros): separados entre sí y a 60 m o más de los linderos. */
function pozosDe(anillo, cantidad) {
  const xs = anillo.map((p) => p[0]);
  const ys = anillo.map((p) => p[1]);
  const pozos = [];
  for (let intento = 0; intento < 300 && pozos.length < cantidad; intento++) {
    const p = [entre(Math.min(...xs), Math.max(...xs)), entre(Math.min(...ys), Math.max(...ys))];
    const holgado = [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60]].every(([dx, dy]) => dentro([p[0] + dx, p[1] + dy], anillo));
    if (holgado && pozos.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 250)) pozos.push(p);
  }
  return pozos;
}

/**
 * Tramos de todos los cauces, con su recuadro, para controlar que ninguna parcela corte un
 * río o canal (el suyo en otra curva, u otro cauce que pasa cerca).
 */
const tramosCauces = cauces.flatMap((c) =>
  c.linea.slice(1).map((b, i) => {
    const a = c.linea[i];
    return { a, b, caja: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] };
  }),
);
function cortaUnCauce(anillo) {
  const xs = anillo.map((p) => p[0]);
  const ys = anillo.map((p) => p[1]);
  const [o, s, e, n] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return tramosCauces.some(
    (t) => t.caja[0] <= e && t.caja[2] >= o && t.caja[1] <= n && t.caja[3] >= s && anillo.slice(1).some((q, i) => seCruzan(anillo[i], q, t.a, t.b)),
  );
}

// Cauces de más peso: los más largos tienen más chances (más lugar para colonias).
// Los cauces sin nombre solo sirven para el control de cruces.
const pesoCauce = Object.fromEntries(cauces.map((c, i) => [i, c.nombre ? Math.sqrt(c.largoKm) * (c.tipo === 'CANAL' ? 1.5 : 1) : 0]));

for (let intento = 0; intento < 400 && parcelas.length < CANTIDAD; intento++) {
  const cauce = cauces[Number(elegirPonderado(pesoCauce))];
  const [lng0, lat0] = cauce.linea[Math.floor(cauce.linea.length / 2)];
  const { aMetros, aGrados } = plano(lat0, lng0);
  const real = remuestrear(cauce.linea.map(aMetros), PASO);
  const eje = suavizar(real, 32); // ±800 m
  const largoColonia = Math.round(entre(2500, 5500) / PASO);
  if (real.length < largoColonia + 80) continue;
  const i0 = entero(40, real.length - largoColonia - 40);
  const i1 = i0 + largoColonia;
  const [lngC, latC] = aGrados(eje[Math.floor((i0 + i1) / 2)]);
  if (!zonaValida(latC, lngC)) continue;

  // Un lado o los dos lados del cauce.
  const lados = azar() < 0.4 ? [1, -1] : [elegir([1, -1])];
  const nuevas = [];
  for (const lado of lados) {
    const desfase = lado === lados[0] ? 0 : entero(0, 30);
    const fila = filaDeParcelas(eje, real, lado, i0 + desfase, i1);
    if (fila) nuevas.push(...fila);
  }
  if (!nuevas.length) continue;
  const enGrados = nuevas.map((p) => ({ ...p, metros: p.anillo, anillo: p.anillo.map(aGrados) }));
  if (enGrados.some((p) => cortaUnCauce(p.anillo) || ocupados.some((o) => sePisan(o, p.anillo)))) continue;

  const { d: departamento } = departamentoDe(latC, lngC);
  for (const p of enGrados) {
    ocupados.push(p.anillo);
    const hectareas = areaAnillo(p.metros) / 10000;
    // Pozos: 1 cada ~90 ha en las fincas grandes; a veces uno en las de fondo o en una chacra.
    const cantidadPozos =
      p.tamano === 'grande' ? Math.min(4, Math.max(1, Math.round(hectareas / 90))) : p.tamano === 'fondo' ? (azar() < 0.35 ? 1 : 0) : azar() < 0.12 ? 1 : 0;
    const pozos = pozosDe(p.metros, cantidadPozos).map(aGrados);
    parcelas.push({ anillo: p.anillo, tamano: p.tamano, hectareas, departamento, cauce, pozos });
  }
}

// --- Filas del padrón --------------------------------------------------------------------------
const filas = [];
let numeroPozo = 0;
for (const [n, p] of parcelas.entries()) {
  const c = catalogo[p.departamento];
  const { titulares, documento, cuit } = titularesDe(p.tamano);

  // Uso: las fincas grandes son de riego; las chacras siguen la mezcla del departamento.
  const uso = p.tamano === 'chacra' ? elegirPonderado(c.usos) : azar() < 0.93 ? 'RIEGO' : elegirPonderado(c.usos);
  const hectareas = Math.max(1, Math.round(p.hectareas));
  const cantidad = ['RIEGO', 'PULVERIZACION'].includes(uso) ? hectareas : uso === 'PECUARIO' ? entero(30, 600) : entero(2, 25);
  const codigoServicio = entero(0, 5);
  const suministro = suministroDe(c, p.cauce);

  const pozos = p.pozos.map(([longitud, latitud], k) => {
    numeroPozo++;
    const grande = p.tamano !== 'chacra';
    const nivelEstatico = -entre(grande ? 15 : 6, grande ? 70 : 25);
    return {
      alias: p.pozos.length > 1 ? `Pozo ${k + 1}` : 'Pozo',
      latitud,
      longitud,
      tipo: grande ? 'PERFORACION' : elegir(['PERFORACION', 'EXCAVADO']),
      estado: elegirPonderado({ EN_USO: 85, PARADO: 10, FUERA_DE_SERVICIO: 5 }),
      profundidad: +entre(grande ? 90 : 30, grande ? 280 : 90).toFixed(1),
      nivelEstatico: +nivelEstatico.toFixed(2),
      nivelDinamico: +(nivelEstatico - entre(4, 25)).toFixed(2),
      caudalM3h: +entre(grande ? 60 : 8, grande ? 280 : 35).toFixed(1),
    };
  });

  filas.push({
    anio: elegir([2007, 2007, 2007, 2009]),
    monto: cantidad * entero(30, 60) * 4,
    otorgamiento: `D-${String(n + 1).padStart(4, '0')}`,
    subconcesion: null,
    tipoOtorgamiento: azar() < 0.96 ? 'CONCESIÓN' : 'DERECHO TRADICIONAL',
    titulares,
    propietariosActuales: azar() < 0.15 ? persona() : null,
    documento,
    cuit,
    caracter: codigoServicio % 2 === 0 ? 'PERMANENTE' : 'EVENTUAL',
    codigoServicio,
    servicio: null,
    uso,
    cantidad,
    localidad: elegir(c.localidades),
    departamento: p.departamento,
    distrito: c.distrito,
    cuenca: c.cuencas.length && azar() < 0.6 ? elegir(c.cuencas) : '(SIN CUENCA)',
    fuente: suministro.fuente,
    sistema: suministro.sistema,
    canalPrincipal: suministro.canalPrincipal,
    canalSecundario: suministro.canalSecundario,
    canalTerciario: suministro.canalTerciario,
    canalCuarto: null,
    canalQuinto: null,
    desague: suministro.desague,
    // ~5 % sin polígono (queda el hueco en la colonia): así es el padrón real, todavía no
    // se dibujaron todas. Los pozos se cargan igual.
    geometria: azar() < 0.05 ? null : { type: 'Polygon', coordinates: [p.anillo] },
    pozos,
  });
}

// --- Casos para probar el sistema ---------------------------------------------------------
const conPoligono = filas.filter((f) => f.geometria);
const recuadro = (g) => {
  const xs = g.coordinates[0].map((c) => c[0]);
  const ys = g.coordinates[0].map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
// 3 superposiciones: una parcela nueva que pisa la mitad de otra existente.
for (const base of conPoligono.slice(5, 8)) {
  const [o, s, e, nn] = recuadro(base.geometria);
  const copia = structuredClone(base);
  copia.otorgamiento = `${base.otorgamiento}-S`;
  copia.titulares = persona();
  copia.documento = entero(8000000, 45000000);
  copia.cuit = null;
  copia.pozos = [];
  const dLng = (e - o) / 2;
  const dLat = (nn - s) / 3;
  copia.geometria.coordinates[0] = copia.geometria.coordinates[0].map(([x, y]) => [+(x + dLng).toFixed(7), +(y + dLat).toFixed(7)]);
  filas.push(copia);
}
// 1 polígono inválido (borde cruzado, «moño»): se importa la concesión sin polígono y queda el aviso.
const invalida = structuredClone(conPoligono[10]);
invalida.otorgamiento = `${invalida.otorgamiento}-X`;
invalida.pozos = [];
const [a, b, cc, d] = invalida.geometria.coordinates[0];
invalida.geometria.coordinates[0] = [a, cc, b, d, a];
filas.push(invalida);
// 1 pozo mal ubicado: cae fuera de su concesión (la importación avisa y sig.v_pozos lo marca).
const conPozo = conPoligono.find((f) => f.pozos.length);
if (conPozo) {
  const [o, s, e] = recuadro(conPozo.geometria);
  conPozo.pozos.push({ ...conPozo.pozos[0], alias: 'Pozo (coordenada a revisar)', longitud: +(e + (e - o) * 0.6).toFixed(7), latitud: s });
}

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify(filas, null, 1));
const porDepto = filas.reduce((acc, f) => ({ ...acc, [f.departamento]: (acc[f.departamento] ?? 0) + 1 }), {});
const porTamano = parcelas.reduce((acc, p) => ({ ...acc, [p.tamano]: (acc[p.tamano] ?? 0) + 1 }), {});
const porCauce = parcelas.reduce((acc, p) => ({ ...acc, [p.cauce.nombre]: (acc[p.cauce.nombre] ?? 0) + 1 }), {});
console.log(`${filas.length} concesiones ficticias → ${SALIDA}`);
console.log(`  con polígono: ${filas.filter((f) => f.geometria).length} (3 superpuestas a propósito, 1 inválida)`);
console.log(`  parcelas: ${Object.entries(porTamano).map(([k, v]) => `${v} ${k}`).join(', ')}`);
console.log(`  pozos: ${filas.reduce((acc, f) => acc + f.pozos.length, 0)} (1 fuera de su concesión a propósito)`);
console.log(`  por cauce: ${Object.entries(porCauce).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  por departamento: ${Object.entries(porDepto).map(([k, v]) => `${k} ${v}`).join(', ')}`);
