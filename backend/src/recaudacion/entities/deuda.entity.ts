import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';

export enum EstadoDeuda {
  PENDIENTE = 'PENDIENTE',
  CANCELADA = 'CANCELADA',
}

/**
 * Deuda de una persona con la DRH (rec_deuda), registrada por Recaudación.
 *
 * La deuda es de la PERSONA, no del expediente: mientras alguno de los titulares tenga
 * una deuda pendiente, sus expedientes quedan EN_ESPERA en Recaudación. Cuando la paga,
 * Recaudación la cancela y los expedientes se reanudan.
 *
 * TODO: cuando exista la integración con el sistema de Recaudación, la deuda se consulta
 * allá; esta tabla queda como registro de lo que se verificó en cada expediente.
 */
@Entity('rec_deuda')
@Index('idx_deuda_persona', ['persona', 'estado'])
export class Deuda {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'persona_id', foreignKeyConstraintName: 'fk_deuda_persona' })
  persona: Relation<Persona>;

  /** Expediente en el que se detectó. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_deuda_expediente' })
  expediente: Relation<Expediente> | null;

  /** Qué se debe (ej: «Canon 2024 y 2025, concesión 1234»). */
  @Column({ type: 'text' })
  detalle: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  monto: string | null;

  @Column({ type: 'enum', enum: EstadoDeuda, enumName: 'rec_estado_deuda', default: EstadoDeuda.PENDIENTE })
  estado: EstadoDeuda;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por_usuario_id', foreignKeyConstraintName: 'fk_deuda_registrado_por' })
  registradoPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  // --- Cancelación ---

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cancelado_por_usuario_id', foreignKeyConstraintName: 'fk_deuda_cancelado_por' })
  canceladoPor: Relation<Usuario> | null;

  @Column({ name: 'cancelado_en', type: 'timestamptz', nullable: true })
  canceladoEn: Date | null;

  /** Comprobante o referencia del pago. */
  @Column({ name: 'comprobante_pago', type: 'varchar', length: 120, nullable: true })
  comprobantePago: string | null;
}
