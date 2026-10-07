import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * De dónde sale el agua y por dónde llega a la parcela (con_suministro). Es una cascada:
 *
 *   fuente → sistema de distribución → canal principal → secundario → terciario → cuarto → quinto
 *
 * Las opciones de cada nivel dependen de la ubicación de la concesión (catálogo de
 * suministro por departamento / localidad / distrito).
 * TODO(catalogos): validar cada valor contra ese catálogo.
 *
 * Historial: un solo suministro vigente por concesión; una reubicación puede cambiarlo.
 */
@Entity('con_suministro')
@Index('uk_suministro_vigente', ['concesion'], { unique: true, where: 'vigente' })
export class Suministro extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.suministros, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_suministro_concesion' })
  concesion: Relation<Concesion>;

  /** Fuente principal de agua (río, arroyo, pozo…). */
  @Column({ name: 'fuente_principal', length: 120 })
  fuentePrincipal: string;

  /** Fuentes adicionales, en el orden en que se cargaron. */
  @Column({ name: 'fuentes_adicionales', type: 'varchar', length: 120, array: true, default: () => "'{}'" })
  fuentesAdicionales: string[];

  @Column({ name: 'sistema_distribucion', type: 'varchar', length: 120, nullable: true })
  sistemaDistribucion: string | null;

  @Column({ name: 'canal_principal', type: 'varchar', length: 120, nullable: true })
  canalPrincipal: string | null;

  @Column({ name: 'canal_secundario', type: 'varchar', length: 120, nullable: true })
  canalSecundario: string | null;

  @Column({ name: 'canal_terciario', type: 'varchar', length: 120, nullable: true })
  canalTerciario: string | null;

  @Column({ name: 'canal_cuarto', type: 'varchar', length: 120, nullable: true })
  canalCuarto: string | null;

  @Column({ name: 'canal_quinto', type: 'varchar', length: 120, nullable: true })
  canalQuinto: string | null;

  /** Dónde desagua (ej: "MISMA PROPIEDAD"). Las coordenadas del desagüe van en con_punto. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  desague: string | null;

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  /** Trámite que lo cargó. NULL en las concesiones migradas. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_suministro_expediente' })
  expediente: Relation<Expediente> | null;
}
