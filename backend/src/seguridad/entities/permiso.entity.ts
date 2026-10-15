import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { OficinaDrh } from './oficina.entity.js';
import { RolDrh } from './rol.entity.js';
import { Usuario } from './usuario.entity.js';

/**
 * Acción protegida (seg_permiso). El código es el del enum Permiso: lo usa el código para
 * exigirla en cada ruta (@RequierePermiso). Acá están el nombre, la descripción y a qué oficina
 * pertenece (solo se asigna a usuarios de esa oficina; sin oficina = a cualquiera).
 */
@Entity('seg_permiso')
export class PermisoDrh {
  @PrimaryColumn({ length: 40 })
  codigo: string;

  @Column({ length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  descripcion: string | null;

  /** Para agrupar en la pantalla (ej: «Alta de concesión»). */
  @Column({ length: 60 })
  grupo: string;

  @ManyToOne(() => OficinaDrh, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'oficina_codigo', foreignKeyConstraintName: 'fk_permiso_oficina' })
  oficina: Relation<OficinaDrh> | null;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}

/**
 * Lo que puede hacer cada usuario (seg_usuario_permiso): una fila por permiso asignado.
 * Lo asigna Informática; al crear el usuario se precarga con la plantilla de su rol.
 */
@Entity('seg_usuario_permiso')
export class UsuarioPermiso {
  @PrimaryColumn({ name: 'usuario_id', type: 'bigint' })
  usuarioId: string;

  @PrimaryColumn({ name: 'permiso_codigo', length: 40 })
  permisoCodigo: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_usuperm_usuario' })
  usuario?: Relation<Usuario>;

  @ManyToOne(() => PermisoDrh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permiso_codigo', foreignKeyConstraintName: 'fk_usuperm_permiso' })
  permiso?: Relation<PermisoDrh>;
}

/**
 * Plantilla de cada rol en cada oficina (seg_rol_permiso): los permisos que se precargan al
 * crear un usuario con ese rol. La edita el administrador desde «Plantillas por rol».
 */
@Entity('seg_rol_permiso')
export class RolPermiso {
  @PrimaryColumn({ name: 'oficina_codigo', length: 30 })
  oficinaCodigo: string;

  @PrimaryColumn({ name: 'rol_codigo', length: 30 })
  rolCodigo: string;

  @PrimaryColumn({ name: 'permiso_codigo', length: 40 })
  permisoCodigo: string;

  @ManyToOne(() => OficinaDrh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'oficina_codigo', foreignKeyConstraintName: 'fk_rolperm_oficina' })
  oficina?: Relation<OficinaDrh>;

  @ManyToOne(() => RolDrh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rol_codigo', foreignKeyConstraintName: 'fk_rolperm_rol' })
  rol?: Relation<RolDrh>;

  @ManyToOne(() => PermisoDrh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permiso_codigo', foreignKeyConstraintName: 'fk_rolperm_permiso' })
  permiso?: Relation<PermisoDrh>;
}
