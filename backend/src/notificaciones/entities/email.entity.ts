import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { EstadoEmail, TipoEmail } from '../notificaciones.constantes.js';

/**
 * Cada correo que manda el sistema (not_email): a quién, qué decía, por qué expediente, quién
 * lo mandó y si salió. Las filas no se modifican salvo el resultado del envío.
 */
@Entity('not_email')
@Index('idx_email_expediente', ['expediente', 'creadoEn'])
export class Email {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: TipoEmail, enumName: 'not_tipo_email' })
  tipo: TipoEmail;

  /** Expediente por el que se mandó (NULL si es un aviso general). */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_email_expediente' })
  expediente: Relation<Expediente> | null;

  /** Direcciones de destino. */
  @Column({ type: 'varchar', length: 150, array: true })
  para: string[];

  @Column({ length: 200 })
  asunto: string;

  @Column({ type: 'text' })
  cuerpo: string;

  @Column({ type: 'enum', enum: EstadoEmail, enumName: 'not_estado_email' })
  estado: EstadoEmail;

  /** Motivo del error, si el servidor de correo lo rechazó. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'enviado_por_usuario_id', foreignKeyConstraintName: 'fk_email_usuario' })
  enviadoPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
