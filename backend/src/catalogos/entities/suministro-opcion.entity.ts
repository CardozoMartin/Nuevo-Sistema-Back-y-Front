import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';
import { SuministroZona } from './suministro-zona.entity.js';

/** Las tres listas simples de cada zona del catálogo de suministro. */
export enum TipoOpcionSuministro {
  /** Fuente de agua (río, arroyo, pozo…). */
  FUENTE = 'FUENTE',
  /** Sistema de distribución (dique, toma, propio…). */
  SISTEMA = 'SISTEMA',
  /** Dónde desagua (ej: «MISMA PROPIEDAD»). */
  DESAGUE = 'DESAGUE',
}

/**
 * Una opción de una lista de la zona (cat_suministro_opcion): fuente, sistema o desagüe.
 * Con baja lógica: dada de baja deja de ofrecerse, y las concesiones que ya la tienen la conservan.
 */
@Entity('cat_suministro_opcion')
@Index('uk_suministro_opcion', ['zona', 'tipo', 'nombre'], { unique: true })
@Check('chk_suministro_opcion_baja', CHECK_BAJA)
export class SuministroOpcion extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SuministroZona, (z) => z.opciones, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'zona_id', foreignKeyConstraintName: 'fk_suministro_opcion_zona' })
  zona: Relation<SuministroZona>;

  @Column({ type: 'enum', enum: TipoOpcionSuministro, enumName: 'cat_tipo_opcion_suministro' })
  tipo: TipoOpcionSuministro;

  /** En mayúsculas, como lo muestra el formulario. */
  @Column({ length: 120 })
  nombre: string;
}
