import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { OficinaDrh } from './oficina.entity.js';
import { RolDrh } from './rol.entity.js';

/**
 * Usuario del sistema (seg_usuario): un empleado de la DRH que trabaja en UNA oficina con un
 * rol (Jefe, Operador, Solo consulta). Lo que puede hacer sale de seg_rol_permiso para su
 * oficina y su rol. El administrador puede todo (incluido el ABM de usuarios y permisos).
 *
 * Entra con legajo o email y contraseña (cifrada con scrypt, nunca se guarda ni se devuelve
 * en claro). El usuario «Sistema» (id 1) no tiene contraseña: firma los procesos automáticos.
 * Nada se borra: la baja es lógica (activo = false con motivo, fecha y quién).
 */
@Entity('seg_usuario')
@Check('chk_usuario_baja', 'activo OR (baja_motivo IS NOT NULL AND baja_en IS NOT NULL)')
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

  /** Rol en su oficina. null solo para el usuario Sistema y los administradores sin oficina. */
  @ManyToOne(() => RolDrh, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'rol_codigo', foreignKeyConstraintName: 'fk_usuario_rol' })
  rol: Relation<RolDrh> | null;

  /** Puede todo, en cualquier oficina (el usuario «Sistema» y los administradores). */
  @Column({ name: 'es_administrador', default: false })
  esAdministrador: boolean;

  /** Ya se le copiaron los permisos de la plantilla de su rol (una sola vez; después los edita Informática). */
  @Column({ name: 'permisos_iniciados', default: false })
  permisosIniciados: boolean;

  // --- Acceso ---

  /** scrypt$<sal>$<hash>. No se lee salvo para el login (select: false). */
  @Column({ name: 'clave_hash', type: 'varchar', length: 255, nullable: true, select: false })
  claveHash: string | null;

  /** La contraseña la puso otro (alta o restablecimiento): al entrar tiene que cambiarla. */
  @Column({ name: 'debe_cambiar_clave', default: true })
  debeCambiarClave: boolean;

  @Column({ name: 'intentos_fallidos', type: 'smallint', default: 0 })
  intentosFallidos: number;

  /** Después de varios intentos fallidos se bloquea un rato. */
  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  @Column({ name: 'ultimo_acceso', type: 'timestamptz', nullable: true })
  ultimoAcceso: Date | null;

  // --- Estado y autoría ---

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'baja_motivo', type: 'text', nullable: true })
  bajaMotivo: string | null;

  @Column({ name: 'baja_en', type: 'timestamptz', nullable: true })
  bajaEn: Date | null;

  @Column({ name: 'baja_usuario_id', type: 'bigint', nullable: true })
  bajaUsuarioId: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'creado_usuario_id', type: 'bigint', nullable: true })
  creadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz', nullable: true })
  modificadoEn: Date | null;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;
}

/** «Apellido, Nombre» para el historial. */
export const nombreUsuario = (u: Pick<Usuario, 'apellido' | 'nombre'>) => `${u.apellido}, ${u.nombre}`;
