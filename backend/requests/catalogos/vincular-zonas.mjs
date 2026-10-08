// Vincula las zonas del catálogo de suministro de la DRH que están escritas distinto que la
// localidad del catálogo de ubicación (ej: «TRANCAS» → «VILLA DE TRANCAS»). Ver PROCESOS_BACKEND.md 6.5.1.
//
//   node requests/catalogos/vincular-zonas.mjs             muestra qué haría (no cambia nada)
//   node requests/catalogos/vincular-zonas.mjs --aplicar   vincula (PUT …/zonas/:id/localidad)
//
// Con la API levantada (API=http://localhost:3000/api por defecto), como Catastro (usuario 2).
// Busca las zonas y las localidades por nombre, así sirve en cualquier base. Si una zona ya está
// vinculada o un nombre no se encuentra, lo avisa y sigue con las demás.
//
// Pasos:
//   1. Lee las zonas sin vincular.
//   2. Para cada equivalencia: busca la zona (departamento + distrito + nombre de la DRH) y la
//      localidad (mismo departamento, nombre exacto).
//   3. Con --aplicar, las vincula. Sin él, solo lo muestra.

const API = process.env.API ?? 'http://localhost:3000/api';
const USUARIO = process.env.USUARIO ?? '2';
const aplicar = process.argv.includes('--aplicar');

/** [departamento, distrito, zona como la escribe la DRH, localidad del catálogo de ubicación] */
const EQUIVALENCIAS = [
  ['TRANCAS', 'I', 'LAS TIPAS', 'LAS TIPAS DE COLALAO'],
  ['TRANCAS', 'I', 'LEOCADIO PAZ', 'LEOCADIO PAEZ'],
  ['TRANCAS', 'I', 'TRANCAS', 'VILLA DE TRANCAS'],
  ['TRANCAS', 'I', 'VILLA VIEJO', 'VILLA VIEJA'],
  ['BURRUYACU', 'II', 'BENJAMIN ARAOZ', 'VILLA BENJAMIN ARAOZ'],
  ['BURRUYACU', 'II', 'BURRUYACU', 'VILLA BURRUYACU'],
  ['BURRUYACU', 'II', 'CHILCA', 'CHILCAS'],
  ['BURRUYACU', 'II', 'LA RAMADA DE ABAJO', 'RAMADA DE ABAJO'],
  ['CRUZ ALTA', 'III', 'CRUZ DEL NORTE', 'ESTACION CRUZ DEL NORTE'],
  ['LULES', 'IV', 'SAN PABLO', 'INGENIO SAN PABLO'],
  ['CHICLIGASTA', 'V', 'CEIBAL', 'EL CEIBAL'],
  ['CHICLIGASTA', 'V', 'MEDINAS', 'MEDINA'],
  ['TAFI DEL VALLE', 'VII', 'COSTA II', 'LA COSTA II'],
  ['YERBA BUENA', 'VII', 'YERBA BUENA', 'YERBA BUENA - MARCOS PAZ'],

  // A DEFINIR CON LA DRH: hay más de una localidad posible (o ninguna). Cuando se decida,
  // completar la última columna y sacar el comentario.
  // ['CHICLIGASTA', 'V', 'GASTONA', 'GASTONA NORTE | GASTONA SUR'],
  // ['CHICLIGASTA', 'V', 'MONTE RICO', 'MONTE RICO BAJO | MONTE RICO VIEJO'],
  // ['CRUZ ALTA', 'III', 'EL TALA', 'EL TALAR | LA TALA'],
  // ['CRUZ ALTA', 'III', 'LA TALA GRANDE', 'LA TALA ?'],
  // ['CRUZ ALTA', 'III', 'LOLITA', 'LOLITA NORTE | LOLITA SUR'],
  // ['LEALES', 'III', 'LEALES', 'VILLA DE LEALES | SANTA ROSA DE LEALES'],
  // ['LULES', 'IV', 'LULES', '¿falta la localidad LULES? (hay INGENIO LULES y QUEBRADA DE LULES)'],
  // ['RIO CHICO', 'V', 'LAS TIPAS', 'LA TIPA ?'],
  // ['RIO CHICO', 'V', 'SANTA BARBARA', 'COLONIA SANTA BARBARA | INGENIO SANTA BARBARA'],
  // ['TAFI VIEJO', 'VII', 'EL DURAZNITO', 'DURAZNITO | EL DURAZNO'],
  // ['TRANCAS', 'I', 'ZARATE', 'ZARATE NORTE | ZÁRATE SUR'],
];

async function llamar(metodo, ruta, cuerpo) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'X-Usuario-Id': USUARIO, ...(cuerpo && { 'Content-Type': 'application/json' }) },
    body: cuerpo && JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${metodo} ${ruta} → HTTP ${res.status}: ${datos?.message ?? ''}`);
  return datos;
}

//1.- Las zonas sin vincular.
const zonas = await llamar('GET', '/catalogos/suministro/zonas?sinVincular=true');
console.log(`${zonas.length} zonas sin vincular. ${aplicar ? 'Vinculando…' : 'Solo se muestra (agregar --aplicar para vincular).'}\n`);

let hechas = 0;
let problemas = 0;
for (const [departamento, distrito, origen, nombreLocalidad] of EQUIVALENCIAS) {
  const etiqueta = `${departamento} / ${origen} (distrito ${distrito}) → ${nombreLocalidad}`;

  //2.- La zona y la localidad.
  const zona = zonas.find((z) => z.departamento === departamento && z.distrito === distrito && z.localidadOrigen === origen);
  if (!zona) {
    console.log(`  - ${etiqueta}: la zona no está entre las sin vincular (¿ya se vinculó?)`);
    continue;
  }
  const candidatas = await llamar('GET', `/catalogos/localidades?q=${encodeURIComponent(nombreLocalidad)}`);
  const localidad = candidatas.find((l) => l.nombre === nombreLocalidad && l.departamento?.nombre === departamento);
  if (!localidad) {
    console.log(`  ✘ ${etiqueta}: no existe esa localidad activa en ${departamento}`);
    problemas++;
    continue;
  }

  //3.- Se vincula (o se muestra).
  if (!aplicar) {
    console.log(`  · ${etiqueta}  [zona ${zona.id} → localidad ${localidad.id}]`);
    continue;
  }
  try {
    await llamar('PUT', `/catalogos/suministro/zonas/${zona.id}/localidad`, { localidadId: localidad.id });
    console.log(`  ✔ ${etiqueta}`);
    hechas++;
  } catch (error) {
    console.log(`  ✘ ${etiqueta}: ${error.message}`);
    problemas++;
  }
}

console.log(`\n${aplicar ? `${hechas} vinculadas` : 'Nada cambió'}${problemas ? `, ${problemas} con problemas` : ''}.`);
