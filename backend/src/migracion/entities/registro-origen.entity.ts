import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { LoteMigracion } from './lote-migracion.entity.js';

/**
 * Trazabilidad de la migración (mig_registro_origen, RNF22): de qué fila del sistema
 * anterior salió cada dato nuevo. Si aparece una discrepancia, acá está la fila original.
 */
@Entity('mig_registro_origen')
// Una fila de origen se importa una sola vez (la importación es repetible sin duplicar).
@Index('uk_mig_origen', ['entidadTipo', 'idOrigen'], { unique: true })
@Index('idx_mig_nuevo', ['entidadTipo', 'idNuevo'])
export class RegistroOrigen {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => LoteMigracion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lote_id', foreignKeyConstraintName: 'fk_mig_lote' })
  lote: Relation<LoteMigracion>;

  /** concesion, pozo, empresa… */
  @Column({ name: 'entidad_tipo', length: 40 })
  entidadTipo: string;

  @Column({ name: 'id_nuevo', type: 'bigint' })
  idNuevo: string;

  /** Identificador en el sistema anterior (para concesiones: el número de otorgamiento). */
  @Column({ name: 'id_origen', length: 60 })
  idOrigen: string;

  @Column({ name: 'tabla_origen', type: 'varchar', length: 120, nullable: true })
  tablaOrigen: string | null;

  /** Fila original completa, tal como vino. */
  @Column({ name: 'datos_origen', type: 'jsonb', nullable: true })
  datosOrigen: unknown;

  /** Avisos de la importación de esta fila (documento descartado, uso desconocido…). */
  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ name: 'migrado_en', type: 'timestamptz' })
  migradoEn: Date;
}
