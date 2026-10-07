// Lectura y escritura de los datos VIGENTES de una concesión (las filas con vigente = true
// de cada tabla con historial). Lo usan el alta y lo van a usar los trámites posteriores.
import type { EntityManager } from 'typeorm';
import { Condicion } from './entities/condicion.entity.js';
import { Domicilio } from './entities/domicilio.entity.js';
import { Inmueble } from './entities/inmueble.entity.js';
import { Poligono } from './entities/poligono.entity.js';
import { Punto } from './entities/punto.entity.js';
import { Suministro } from './entities/suministro.entity.js';
import { Titular } from './entities/titular.entity.js';
import { Uso } from './entities/uso.entity.js';

/** Lo vigente de una concesión, sección por sección. */
export interface DatosVigentes {
  titulares: Titular[];
  domicilios: Domicilio[];
  inmueble: Inmueble | null;
  condicion: Condicion | null;
  usos: Uso[];
  puntos: Punto[];
  suministro: Suministro | null;
}

/** Tablas con historial que cuelgan de la concesión (el polígono también: rige desde la resolución). */
const TABLAS_VERSIONADAS = [Titular, Domicilio, Inmueble, Condicion, Uso, Punto, Suministro, Poligono] as const;

/** Trae lo vigente de la concesión, con los nombres del catálogo de ubicación ya cargados. */
export async function cargarDatosVigentes(tx: EntityManager, concesionId: string): Promise<DatosVigentes> {
  const deLaConcesion = { concesion: { id: concesionId }, vigente: true };

  // Una consulta por sección, en orden (dentro de una transacción comparten la conexión).
  //1.- Titulares y domicilios, en el orden en que se cargaron (el 0 es el principal).
  const titulares = await tx.find(Titular, { where: deLaConcesion, order: { orden: 'ASC' } });
  const domicilios = await tx.find(Domicilio, { where: deLaConcesion, order: { orden: 'ASC' }, relations: { departamento: true, localidad: true, distrito: true } });

  //2.- Inmueble (ubicación + parcela) con los nombres del catálogo.
  const inmueble = await tx.findOne(Inmueble, { where: deLaConcesion, relations: { departamento: true, localidad: true, distrito: true, cuenca: true } });

  //3.- Condiciones, usos, puntos y suministro.
  const condicion = await tx.findOne(Condicion, { where: deLaConcesion });
  const usos = await tx.find(Uso, { where: deLaConcesion, order: { orden: 'ASC' } });
  const puntos = await tx.find(Punto, { where: deLaConcesion });
  const suministro = await tx.findOne(Suministro, { where: deLaConcesion });

  return { titulares, domicilios, inmueble, condicion, usos, puntos, suministro };
}

/**
 * Cuando la concesión se otorga, todo lo cargado en el alta pasa a regir desde la fecha de
 * la resolución: se completa `desde` en las filas vigentes que todavía no lo tienen.
 */
export async function fijarVigenciaDesde(tx: EntityManager, concesionId: string, fecha: string | null): Promise<void> {
  for (const tabla of TABLAS_VERSIONADAS) {
    await tx
      .createQueryBuilder()
      .update(tabla)
      .set({ desde: fecha })
      .where('concesion_id = :concesionId AND vigente AND desde IS NULL', { concesionId })
      .execute();
  }
}
