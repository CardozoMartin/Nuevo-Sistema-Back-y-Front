import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { EstadoSolicitudNumero } from '../expedientes.constantes.js';
import { Expediente } from './expediente.entity.js';

/**
 * Pedido del número de concesión (exp_solicitud_numero).
 *
 * Secretaría General, antes de cargar la resolución, le pide a Catastro el número de
 * concesión por el sistema. Catastro lo toma de su libro de concesiones («Petete») y lo carga.
 * El expediente no se mueve: sigue en Secretaría mientras tanto.
 *
 * Un pedido puede llevar varios números (`etiquetas`: ej. una subdivisión, uno por fracción).
 * Sin etiquetas es un solo número para la concesión del expediente.
 */
@Entity('exp_solicitud_numero')
// Un solo pedido pendiente por expediente.
@Index('uk_solicitud_pendiente', ['expediente'], { unique: true, where: "estado = 'PENDIENTE'" })
@Index('idx_solicitud_estado', ['estado', 'solicitadoEn'])
@Check('chk_solicitud_asignada', "estado <> 'ASIGNADA' OR (cardinality(numeros) > 0 AND asignado_en IS NOT NULL)")
export class SolicitudNumero {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Expediente, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_solnum_expediente' })
  expediente: Relation<Expediente>;

  @Column({ type: 'enum', enum: EstadoSolicitudNumero, enumName: 'exp_estado_solicitud_numero', default: EstadoSolicitudNumero.PENDIENTE })
  estado: EstadoSolicitudNumero;

  /** Qué es cada número pedido (vacío = un solo número para el expediente). */
  @Column({ type: 'varchar', length: 100, array: true, default: () => "'{}'" })
  etiquetas: string[];

  /** Números que cargó Catastro, en el orden de las etiquetas. */
  @Column({ type: 'varchar', length: 20, array: true, default: () => "'{}'" })
  numeros: string[];

  // --- Pedido (Secretaría General) ---

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'solicitado_por_usuario_id', foreignKeyConstraintName: 'fk_solnum_solicitado_por' })
  solicitadoPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'solicitado_en', type: 'timestamptz' })
  solicitadoEn: Date;

  // --- Asignación (Catastro) ---

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'asignado_por_usuario_id', foreignKeyConstraintName: 'fk_solnum_asignado_por' })
  asignadoPor: Relation<Usuario> | null;

  @Column({ name: 'asignado_en', type: 'timestamptz', nullable: true })
  asignadoEn: Date | null;
}
