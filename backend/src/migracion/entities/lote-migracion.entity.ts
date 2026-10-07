import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Una corrida del importador (mig_lote): qué archivo se importó, cuándo y con qué resultado.
 * Los lotes de prueba (demo = true) se pueden borrar enteros; los reales no.
 */
@Entity('mig_lote')
export class LoteMigracion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  nombre: string;

  /** Archivo de origen (nombre, no ruta). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  archivo: string | null;

  /** true = datos de prueba: se pueden borrar con «borrar-demo». */
  @Column({ default: false })
  demo: boolean;

  @Column({ type: 'int', default: 0 })
  filas: number;

  @Column({ type: 'int', default: 0 })
  importadas: number;

  /** Ya estaban importadas de antes (la importación es repetible). */
  @Column({ type: 'int', default: 0 })
  omitidas: number;

  @Column({ name: 'con_error', type: 'int', default: 0 })
  conError: number;

  @Column({ name: 'con_poligono', type: 'int', default: 0 })
  conPoligono: number;

  /** Detalle de errores y avisos por fila. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  informe: unknown[];

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
