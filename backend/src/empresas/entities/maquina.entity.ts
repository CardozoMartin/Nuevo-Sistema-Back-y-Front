import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from './empresa.entity.js';

/** Máquina perforadora (RN-10, RN-11) — tabla emp_maquina. */
@Entity('emp_maquina')
@Index('idx_maquina_empresa', ['empresa', 'activa'])
export class Maquina {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Empresa, (empresa) => empresa.maquinas, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'empresa_id', foreignKeyConstraintName: 'fk_maquina_empresa' })
  empresa: Relation<Empresa>;

  /** «Patente» que asigna la DRH (ej: EQP-001-A). Única en todo el sistema y no se reutiliza. */
  @Index('uk_maquina_codigo', { unique: true })
  @Column({ length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  modelo: string | null;

  @Column({ name: 'capacidad_diametro', type: 'varchar', length: 30, nullable: true })
  capacidadDiametro: string | null;

  /** Metros. Postgres devuelve los DECIMAL como string para no perder precisión. */
  @Column({ name: 'capacidad_profundidad', type: 'decimal', precision: 8, scale: 2, nullable: true })
  capacidadProfundidad: string | null;

  @Column({ name: 'altura_torre', type: 'decimal', precision: 6, scale: 2, nullable: true })
  alturaTorre: string | null;

  @Column({ name: 'vehiculo_patente', type: 'varchar', length: 20, nullable: true })
  vehiculoPatente: string | null;

  @Column({ name: 'vehiculo_modelo', type: 'varchar', length: 120, nullable: true })
  vehiculoModelo: string | null;

  @Column({ name: 'foto_ruta', type: 'varchar', length: 500, nullable: true })
  fotoRuta: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
