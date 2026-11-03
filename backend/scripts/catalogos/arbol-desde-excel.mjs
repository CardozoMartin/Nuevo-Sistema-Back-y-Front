// Árbol de suministro que cargaron los jefes de Distrito (proyecto «Formulario para pedir info»),
// pasado a JSON para la carga inicial del catálogo.
//
//   node scripts/catalogos/arbol-desde-excel.mjs [archivo.xlsx]
//
// Lee recursos/catalogos/Suministros_DRH.xlsx (una hoja por distrito: «DISTRITO I» … «DISTRITO VII»,
// columnas FUENTE, SISTEMA, CANAL PRINCIPAL … CANAL QUINTO, DESAGUE; una fila por rama) y escribe
// recursos/catalogos/arbol-suministro.json: { "I": [[fuente, sistema, …, desagüe], …], … }.
// Las filas van TAL CUAL (una celda vacía es un nivel que esa rama no tiene); el árbol lo arma la
// API al cargarlo (arbolDesdeRamas). Solo se carga si la tabla está vacía.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const CARPETA = join(import.meta.dirname, '..', '..', 'recursos', 'catalogos');
const ORIGEN = process.argv[2] ?? join(CARPETA, 'Suministros_DRH.xlsx');
const NIVELES = 8;

const texto = (celda) => {
  const v = celda.value;
  if (v === null || v === undefined) return null;
  const t = String(typeof v === 'object' && 'richText' in v ? v.richText.map((r) => r.text).join('') : v).trim();
  return t || null;
};

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(ORIGEN);
const salida = {};
for (const hoja of libro.worksheets) {
  const distrito = hoja.name.replace(/^DISTRITO\s+/i, '').trim().toUpperCase();
  const ramas = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return; // encabezado
    const rama = Array.from({ length: NIVELES }, (_, i) => texto(fila.getCell(i + 1)));
    if (rama.some(Boolean)) ramas.push(rama);
  });
  salida[distrito] = ramas;
  console.log(`Distrito ${distrito}: ${ramas.length} ramas`);
}
// Una rama por línea, para poder revisar el archivo (y sus cambios) a simple vista.
const distritos = Object.entries(salida).map(([d, ramas]) => `  ${JSON.stringify(d)}: [\n${ramas.map((r) => `    ${JSON.stringify(r)}`).join(',\n')}\n  ]`);
writeFileSync(join(CARPETA, 'arbol-suministro.json'), `{\n${distritos.join(',\n')}\n}\n`);
console.log('Listo: recursos/catalogos/arbol-suministro.json');
