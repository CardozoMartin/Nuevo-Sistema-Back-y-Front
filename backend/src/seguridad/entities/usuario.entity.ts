import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { OficinaDrh } from './oficina.entity.js';

/**
 * Usuario del sistema (seg_usuario): un empleado de la DRH que trabaja en una oficina.
 *
 * Por ahora la tabla existe para que cada pase y cada actuación del expediente quede
 * firmada por alguien. El login (clave, sesiones, permisos de DRF_Usuarios_Permisos_Auditoria.md)
 * se agrega después sobre esta misma tabla.
 */
@Entity('seg_usuario')
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Legajo del empleado. Único. */
  @Index('uk_usuario_legajo', { unique: true })
  @Column({ length: 20 })
  legajo: string;

  @Column({ length: 100 })
  apellido: string;

  @Column({ length: 100 })
  nombre: string;

  @Index('uk_usuario_email', { unique: true })
  @Column({ length: 150 })
  email: string;

  /** Oficina donde trabaja: solo puede actuar sobre los expedientes que están en ella. */
  @ManyToOne(() => OficinaDrh, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'oficina_codigo', foreignKeyConstraintName: 'fk_usuario_oficina' })
  oficina: Relation<OficinaDrh> | null;

  /** Puede actuar en cualquier oficina (el usuario «Sistema» y, más adelante, los administradores). */
  @Column({ name: 'es_administrador', default: false })
  esAdministrador: boolean;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}

/** «Apellido, Nombre» para el historial. */
export const nombreUsuario = (u: Pick<Usuario, 'apellido' | 'nombre'>) => `${u.apellido}, ${u.nombre}`;
