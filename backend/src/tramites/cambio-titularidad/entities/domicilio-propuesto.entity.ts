import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Departamento } from '../../../catalogos/entities/departamento.entity.js';
import { Distrito } from '../../../catalogos/entities/distrito.entity.js';
import { Localidad } from '../../../catalogos/entities/localidad.entity.js';
import { CambioTitularidad } from './cambio-titularidad.entity.js';

/**
 * Domicilio legal PROPUESTO del nuevo titular (con_cambio_domicilio). Mismos datos que
 * con_domicilio; al finalizar el cambio reemplaza a los domicilios vigentes de la concesión.
 */
@Entity('con_cambio_domicilio')
@Index('idx_cambio_domicilio_cambio', ['cambio'])
export class DomicilioPropuesto {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => CambioTitularidad, (c) => c.domicilios, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cambio_id', foreignKeyConstraintName: 'fk_cambio_domicilio_cambio' })
  cambio: Relation<CambioTitularidad>;

  /** El 0 es el «Domicilio legal»; el resto, adicionales. */
  @Column({ type: 'smallint' })
  orden: number;

  @Column({ length: 150 })
  calle: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  @ManyToOne(() => Departamento, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'departamento_id', foreignKeyConstraintName: 'fk_cambio_domicilio_departamento' })
  departamento: Relation<Departamento>;

  @ManyToOne(() => Localidad, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'localidad_id', foreignKeyConstraintName: 'fk_cambio_domicilio_localidad' })
  localidad: Relation<Localidad>;

  @ManyToOne(() => Distrito, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_cambio_domicilio_distrito' })
  distrito: Relation<Distrito>;
}
