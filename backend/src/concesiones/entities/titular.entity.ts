import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Titularidad (con_titular): qué persona es titular de qué concesión y desde/hasta cuándo.
 * Los datos de la persona (nombre, documento, contacto) están en per_persona, una sola
 * vez aunque sea titular de varias concesiones: puede ser titular única de una y
 * cotitular de otra.
 *
 * Histórico de titularidad: las titularidades no se borran. En un cambio de titularidad
 * las actuales se marcan vigente = false (con fecha hasta) y se insertan las nuevas, con
 * el expediente del cambio.
 */
@Entity('con_titular')
@Index('idx_titular_concesion', ['concesion', 'vigente'])
@Index('idx_titular_persona', ['persona', 'vigente'])
// Una persona figura una sola vez como titular vigente de la misma concesión.
@Index('uk_titular_vigente', ['concesion', 'persona'], { unique: true, where: 'vigente' })
export class Titular extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.titulares, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_titular_concesion' })
  concesion: Relation<Concesion>;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'persona_id', foreignKeyConstraintName: 'fk_titular_persona' })
  persona: Relation<Persona>;

  /** Posición en el formulario: el 0 es el titular principal (el que se muestra en listados). */
  @Column({ type: 'smallint' })
  orden: number;

  /** Trámite que lo dio de alta como titular. NULL en los titulares migrados del padrón anterior. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_titular_expediente' })
  expediente: Relation<Expediente> | null;
}
