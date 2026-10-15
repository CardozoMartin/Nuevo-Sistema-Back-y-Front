import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from './usuario.entity.js';

/**
 * Sesión abierta con el login (seg_sesion). El navegador guarda un token al azar; acá solo se
 * guarda su hash (SHA-256), así una copia de la base no sirve para entrar. Vence si no se usa
 * durante un tiempo y se cierra al salir o al dar de baja / cambiar la contraseña del usuario.
 */
@Entity('seg_sesion')
@Index('idx_sesion_usuario', ['usuario', 'cerradaEn'])
export class Sesion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_sesion_usuario' })
  usuario: Relation<Usuario>;

  @Index('uk_sesion_token', { unique: true })
  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;

  /** Se corre con cada uso (vence por inactividad). */
  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn: Date;

  @Column({ name: 'cerrada_en', type: 'timestamptz', nullable: true })
  cerradaEn: Date | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  ip: string | null;

  @Column({ name: 'agente', type: 'varchar', length: 255, nullable: true })
  agente: string | null;
}
