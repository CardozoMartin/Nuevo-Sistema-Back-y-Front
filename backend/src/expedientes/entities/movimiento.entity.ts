import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { Dictamen, Etapa, Oficina } from '../expedientes.constantes.js';
import { Expediente } from './expediente.entity.js';

/**
 * Pase entre oficinas (exp_movimiento): de qué oficina a cuál, quién lo envió y cuándo,
 * y quién lo tomó en la oficina de destino y cuándo. Es la trazabilidad del expediente
 * (RF16): las filas no se borran ni se cambian, salvo para registrar la recepción.
 */
@Entity('exp_movimiento')
@Index('idx_mov_expediente', ['expediente', 'fecha'])
@Index('idx_mov_oficina', ['oficinaDestino', 'fecha'])
export class Movimiento {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Expediente, (e) => e.movimientos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_mov_expediente' })
  expediente: Relation<Expediente>;

  /** NULL en el movimiento de apertura (el expediente ingresa al sistema). */
  @Column({ name: 'oficina_origen', type: 'enum', enum: Oficina, enumName: 'exp_oficina', nullable: true })
  oficinaOrigen: Oficina | null;

  @Column({ name: 'oficina_destino', type: 'enum', enum: Oficina, enumName: 'exp_oficina' })
  oficinaDestino: Oficina;

  /** Etapa del circuito a la que entra con este pase. */
  @Column({ name: 'etapa_destino', type: 'enum', enum: Etapa, enumName: 'exp_etapa' })
  etapaDestino: Etapa;

  // --- Envío ---

  /** Quién lo pasó. */
  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_mov_usuario' })
  enviadoPor: Relation<Usuario>;

  /** Cuándo lo pasó. */
  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'enum', enum: Dictamen, enumName: 'exp_dictamen', default: Dictamen.SIN_DICTAMEN })
  dictamen: Dictamen;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** true si vuelve a una oficina anterior (observado: vuelve a Catastro para corregir). RN-A13. */
  @Column({ name: 'es_devolucion', default: false })
  esDevolucion: boolean;

  // --- Recepción ---

  /** Quién lo tomó en la oficina de destino (NULL mientras nadie lo tomó). */
  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'recibido_por_usuario_id', foreignKeyConstraintName: 'fk_mov_recibido_por' })
  recibidoPor: Relation<Usuario> | null;

  @Column({ name: 'recibido_en', type: 'timestamptz', nullable: true })
  recibidoEn: Date | null;
}
