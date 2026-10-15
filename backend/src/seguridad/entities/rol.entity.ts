import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Rol de un usuario en su oficina (seg_rol): Jefe, Operador, Solo consulta. */
@Entity('seg_rol')
export class RolDrh {
  @PrimaryColumn({ length: 30 })
  codigo: string;

  @Column({ length: 60 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion: string | null;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
