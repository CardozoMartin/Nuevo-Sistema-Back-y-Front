import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Listas cortas de opciones que se ofrecen en los formularios (cat_opcion.grupo). */
export enum GrupoOpcion {
  CIRCUNSCRIPCION = 'CIRCUNSCRIPCION',
  SECCION_CATASTRAL = 'SECCION_CATASTRAL',
  CARACTER = 'CARACTER',
  CODIGO_SERVICIO = 'CODIGO_SERVICIO',
  TIPO_CONCESION = 'TIPO_CONCESION',
  /** Documentos que Jurídico puede marcar como faltantes. */
  DOCUMENTO_JURIDICO = 'DOCUMENTO_JURIDICO',
}

/**
 * Opción de una lista corta (cat_opcion): código + nombre para mostrar, agrupadas por grupo.
 * Son listas sin más datos que el nombre; las que tienen columnas propias (usos, situaciones
 * legales, trámites, etapas…) tienen su tabla.
 */
@Entity('cat_opcion')
export class Opcion {
  @PrimaryColumn({ type: 'enum', enum: GrupoOpcion, enumName: 'cat_grupo_opcion' })
  grupo: GrupoOpcion;

  /** Código que se guarda en los datos (ej: PERMANENTE, 'A', '0'). */
  @PrimaryColumn({ length: 40 })
  codigo: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
