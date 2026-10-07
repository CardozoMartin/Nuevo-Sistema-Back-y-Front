import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Caracter } from '../concesiones.constantes.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Condiciones del derecho de uso (con_condicion): el caudal asignado y cómo se usa el agua.
 *
 * Están separadas de con_concesion porque cambian con el tiempo: una ampliación o una
 * reducción recalculan el caudal, y la concesión tiene que conservar con qué caudal se
 * otorgó y con cuál quedó después. Una sola fila vigente por concesión.
 */
@Entity('con_condicion')
@Index('uk_condicion_vigente', ['concesion'], { unique: true, where: 'vigente' })
@Check('chk_condicion_periodo', 'periodo_fin IS NULL OR periodo_inicio IS NULL OR periodo_fin >= periodo_inicio')
@Check('chk_condicion_caudal', 'caudal_lps IS NULL OR caudal_lps >= 0')
export class Condicion extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.condiciones, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_condicion_concesion' })
  concesion: Relation<Concesion>;

  /** Permanente o eventual (paso 5 del alta). */
  @Column({ type: 'enum', enum: Caracter, enumName: 'con_caracter', nullable: true })
  caracter: Caracter | null;

  /** Código de servicio de Catastro, 0 a 5 (SERVICIOS en concesiones.constantes). */
  @Column({ name: 'codigo_servicio', type: 'smallint', nullable: true })
  codigoServicio: number | null;

  @Column({ name: 'periodo_inicio', type: 'date', nullable: true })
  periodoInicio: string | null;

  @Column({ name: 'periodo_fin', type: 'date', nullable: true })
  periodoFin: string | null;

  /**
   * Caudal asignado (l/s), el que se otorga. Se propone con la suma de los caudales de los
   * usos (paso 5), pero Catastro lo puede corregir en el paso de suministro (paso 6).
   */
  @Column({ name: 'caudal_lps', type: 'decimal', precision: 10, scale: 3, nullable: true })
  caudalLps: string | null;

  /** Trámite que fijó estas condiciones. NULL en las concesiones migradas. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_condicion_expediente' })
  expediente: Relation<Expediente> | null;
}
