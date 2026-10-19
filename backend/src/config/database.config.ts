import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Etapa, Oficina, ResultadoActuacion, TipoActuacion } from '../expedientes/expedientes.constantes.js';

/** Esquemas que tienen que existir antes de crear tablas y vistas. */
const ESQUEMAS = ['sig'];

/**
 * Enumerados de PostgreSQL que usan VARIAS columnas (ej: exp_oficina, en expedientes, pases
 * y actuaciones). Si se les agrega un valor, el synchronize de TypeORM intenta agregarlo una
 * vez por columna y falla en la segunda («enum label already exists»). Por eso los valores
 * nuevos se agregan antes de sincronizar. exp_resultado_actuacion va también: así un valor
 * nuevo se agrega sin que el synchronize recree el tipo sobre exp_actuacion.
 */
const ENUMS_COMPARTIDOS: Record<string, string[]> = {
  exp_oficina: Object.values(Oficina),
  exp_etapa: Object.values(Etapa),
  exp_tipo_actuacion: Object.values(TipoActuacion),
  exp_resultado_actuacion: Object.values(ResultadoActuacion),
};

/** Conexión a PostgreSQL a partir del .env (ver .env.example). */
export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get('DB_HOST', 'localhost'),
    port: Number(config.get('DB_PORT', 5433)),
    database: config.get('DB_NAME', 'drh_sistema'),
    username: config.get('DB_USER', 'drh'),
    password: config.get('DB_PASSWORD', 'drh_dev'),
    // Cada módulo registra sus entidades con TypeOrmModule.forFeature.
    autoLoadEntities: true,
    synchronize: config.get('DB_SYNCHRONIZE') === 'true',
    logging: config.get('DB_LOGGING') === 'true',
  };
}

/**
 * Abre la conexión en tres pasos:
 *   1. Conecta SIN sincronizar.
 *   2. Crea las extensiones y los esquemas que el modelo necesita (TypeORM no crea los
 *      esquemas de las vistas, por ejemplo sig.v_concesiones), y agrega los valores nuevos
 *      de los enumerados compartidos.
 *   3. Si DB_SYNCHRONIZE=true, sincroniza tablas y vistas.
 * Cuando se pase a migraciones, los pasos 2 y 3 van a la primera migración.
 */
export async function crearDataSource(opciones?: DataSourceOptions): Promise<DataSource> {
  if (!opciones) throw new Error('Faltan las opciones de conexión.');
  const dataSource = new DataSource({ ...opciones, synchronize: false });
  await dataSource.initialize();
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS postgis');
  for (const esquema of ESQUEMAS) await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${esquema}`);
  for (const [tipo, valores] of Object.entries(ENUMS_COMPARTIDOS)) {
    const [{ existe }] = await dataSource.query(`SELECT to_regtype($1) IS NOT NULL AS existe`, [`public.${tipo}`]);
    if (!existe) continue; // base nueva: lo crea el synchronize
    for (const valor of valores) await dataSource.query(`ALTER TYPE public.${tipo} ADD VALUE IF NOT EXISTS '${valor}'`);
  }
  if (opciones.synchronize) await dataSource.synchronize();
  return dataSource;
}
