import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { Concesion } from '../../../concesiones/entities/concesion.entity.js';
import { Expediente } from '../../../expedientes/entities/expediente.entity.js';
import { Resolucion } from '../../../expedientes/entities/resolucion.entity.js';
import { EstadoCambioTitularidad } from '../cambio-titularidad.constantes.js';
import { DomicilioPropuesto } from './domicilio-propuesto.entity.js';
import { TitularPropuesto } from './titular-propuesto.entity.js';

/**
 * Cambio de titularidad de una concesión vigente (con_cambio_titularidad).
 *
 * Une el expediente del cambio con la concesión sobre la que se tramita (la concesión apunta
 * al expediente de su ALTA, no a los de los trámites posteriores).
 *
 * El nuevo titular es una PROPUESTA hasta el final: se guarda en con_cambio_titular y
 * con_cambio_domicilio, y la concesión sigue a nombre del titular actual durante todo el
 * circuito. Recién al finalizar se cierran los titulares y domicilios vigentes (hasta = fecha de
 * la resolución) y se insertan los nuevos en con_titular / con_domicilio (desde = esa fecha).
 */
@Entity('con_cambio_titularidad')
// Un solo cambio en trámite por concesión (los finalizados, rechazados o anulados no bloquean otro).
@Index('uk_cambio_concesion_en_tramite', ['concesion'], { unique: true, where: `estado = 'EN_TRAMITE'` })
export class CambioTitularidad {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uk_cambio_expediente', { unique: true })
  @OneToOne(() => Expediente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_cambio_expediente' })
  expediente: Relation<Expediente>;

  @ManyToOne(() => Concesion, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_cambio_concesion' })
  concesion: Relation<Concesion>;

  @Column({ type: 'enum', enum: EstadoCambioTitularidad, enumName: 'con_estado_cambio_titularidad', default: EstadoCambioTitularidad.EN_TRAMITE })
  estado: EstadoCambioTitularidad;

  /** Resolución de Secretaría General que aprueba el cambio: su fecha es la del cambio de titular. */
  @ManyToOne(() => Resolucion, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'resolucion_id', foreignKeyConstraintName: 'fk_cambio_resolucion' })
  resolucion: Relation<Resolucion> | null;

  @OneToMany(() => TitularPropuesto, (t) => t.cambio)
  titulares: Relation<TitularPropuesto[]>;

  @OneToMany(() => DomicilioPropuesto, (d) => d.cambio)
  domicilios: Relation<DomicilioPropuesto[]>;

  // --- Autoría ---

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;
}
