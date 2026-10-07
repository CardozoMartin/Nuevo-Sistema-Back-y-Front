import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { Expediente } from './expediente.entity.js';

/**
 * Resolución de Secretaría General (exp_resolucion, RF17). Ej: Resolución 145/2026.
 * La que otorga la concesión queda enlazada desde con_concesion.resolucion_id.
 */
@Entity('exp_resolucion')
// El número se reinicia cada año: la clave es número + año.
@Index('uk_resolucion', ['numero', 'anio'], { unique: true })
export class Resolucion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ length: 20 })
  numero: string;

  @Column({ type: 'smallint' })
  anio: number;

  @Column({ type: 'date' })
  fecha: string;

  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_res_expediente' })
  expediente: Relation<Expediente> | null;

  /** PDF firmado. TODO: carga del archivo (ArchivosService), como el KML. */
  @Column({ name: 'archivo_ruta', type: 'varchar', length: 500, nullable: true })
  archivoRuta: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_usuario_id', foreignKeyConstraintName: 'fk_res_creado' })
  creadoPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
