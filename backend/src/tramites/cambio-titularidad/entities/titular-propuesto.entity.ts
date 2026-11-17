import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Persona } from '../../../personas/entities/persona.entity.js';
import { CambioTitularidad } from './cambio-titularidad.entity.js';

/**
 * Nuevo titular PROPUESTO en un cambio de titularidad (con_cambio_titular). Puede ser más de
 * uno (cotitulares) y alguno de los actuales puede seguir. Se reemplaza entero cada vez que
 * Catastro guarda la carga; al finalizar el cambio pasa a con_titular.
 */
@Entity('con_cambio_titular')
@Index('idx_cambio_titular_cambio', ['cambio'])
@Index('uk_cambio_titular_persona', ['cambio', 'persona'], { unique: true })
export class TitularPropuesto {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => CambioTitularidad, (c) => c.titulares, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cambio_id', foreignKeyConstraintName: 'fk_cambio_titular_cambio' })
  cambio: Relation<CambioTitularidad>;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'persona_id', foreignKeyConstraintName: 'fk_cambio_titular_persona' })
  persona: Relation<Persona>;

  /** El 0 es el titular principal. */
  @Column({ type: 'smallint' })
  orden: number;
}
