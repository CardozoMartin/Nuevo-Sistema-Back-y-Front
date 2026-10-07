// Línea de comandos de la migración. Se ejecuta con:  npm run migracion -- <comando> [opciones]
//
//   importar <archivo.json> --nombre "Padrón La Aguadita" [--demo] [--tabla "Procesado"]
//   lotes
//   borrar <loteId>          (solo lotes de prueba)
//   borrar-demo              (todos los lotes de prueba)
//   cargar-cauces <archivo.json> [--fuente OpenStreetMap]   (capa de ríos y canales del visor)
//
// Arranca la aplicación SIN servidor HTTP (createApplicationContext) para reutilizar los
// mismos servicios y validaciones que la API.
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { AppModule } from '../app.module.js';
import type { FilaPadron } from './fila-padron.js';
import { CaucesService, type CauceArchivo } from '../sig/cauces.service.js';
import { ImportadorService } from './importador.service.js';

function opcion(args: string[], nombre: string): string | undefined {
  const i = args.indexOf(`--${nombre}`);
  // En Windows, «npm run» pasa por cmd.exe, que escapa espacios y paréntesis con «^».
  return i >= 0 ? args[i + 1]?.replaceAll('^', '') : undefined;
}

async function main() {
  const [comando, ...args] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const importador = app.get(ImportadorService);

  try {
    switch (comando) {
      case 'importar': {
        const archivo = args[0];
        if (!archivo) throw new Error('Indique el archivo JSON: importar <archivo.json> --nombre "…"');
        const filas = JSON.parse(await readFile(archivo, 'utf8')) as FilaPadron[];
        const lote = await importador.importar(filas, {
          nombre: opcion(args, 'nombre') ?? (args.includes('--demo') ? 'Padrón de prueba (ficticio)' : basename(archivo)),
          archivo: basename(archivo),
          demo: args.includes('--demo'),
          tablaOrigen: opcion(args, 'tabla'),
        });
        console.log(`\nLote ${lote.id} «${lote.nombre}»${lote.demo ? ' (PRUEBA)' : ''}`);
        console.log(`  Filas:        ${lote.filas}`);
        console.log(`  Importadas:   ${lote.importadas}  (con polígono: ${lote.conPoligono})`);
        console.log(`  Omitidas:     ${lote.omitidas}  (ya estaban importadas)`);
        console.log(`  Con error:    ${lote.conError}`);
        const informe = lote.informe as { fila: number; clave: string; motivo?: string; avisos?: string[] }[];
        if (informe.length) {
          console.log(`\nPara revisar (${informe.length} filas; detalle completo en mig_lote.informe):`);
          for (const r of informe.slice(0, 15)) console.log(`  fila ${r.fila} (Otorg. ${r.clave}): ${r.motivo ?? r.avisos?.join(' | ')}`);
          if (informe.length > 15) console.log(`  … y ${informe.length - 15} más.`);
        }
        break;
      }
      case 'lotes': {
        const lotes = await importador.listarLotes();
        if (!lotes.length) console.log('No hay lotes importados.');
        for (const l of lotes) {
          console.log(`${l.id}. ${l.nombre}${l.demo ? ' [PRUEBA]' : ''} — ${l.importadas}/${l.filas} importadas, ${l.conPoligono} con polígono, ${l.conError} con error (${l.creadoEn.toLocaleString('es-AR')})`);
        }
        break;
      }
      case 'borrar': {
        const total = await importador.borrarLote(Number(args[0]));
        console.log(`Lote ${args[0]} borrado (${total} concesiones).`);
        break;
      }
      case 'borrar-demo': {
        const total = await importador.borrarLotesDemo();
        console.log(`Lotes de prueba borrados (${total} concesiones).`);
        break;
      }
      case 'cargar-cauces': {
        const archivo = args[0];
        if (!archivo) throw new Error('Indique el archivo: cargar-cauces <archivo.json>');
        const { cauces } = JSON.parse(await readFile(archivo, 'utf8')) as { cauces: CauceArchivo[] };
        const fuente = opcion(args, 'fuente') ?? 'OpenStreetMap';
        const total = await app.get(CaucesService).cargar(cauces, fuente);
        console.log(`${total} cauces cargados en sig.cauce (fuente: ${fuente}).`);
        break;
      }
      default:
        console.log('Comandos: importar <archivo.json> --nombre "…" [--demo] | lotes | borrar <loteId> | borrar-demo | cargar-cauces <archivo.json>');
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();
