import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TipoUso } from '../../catalogos/entities/tipo-uso.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Uso declarado de la concesión (con_uso): qué tipo de uso, con qué magnitud y el caudal
 * que le corresponde. Una concesión puede tener varios usos, cada tipo una sola vez.
 *
 * Historial: una ampliación o reducción cierra los usos vigentes y carga los nuevos.
 */
@Entity('con_uso')
@Index('idx_conuso_concesion', ['concesion', 'vigente'])
export class Uso extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.usos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_conuso_concesion' })
  concesion: Relation<Concesion>;

  @Column({ type: 'smallint' })
  orden: number;

  @ManyToOne(() => TipoUso, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'tipo_uso_codigo', foreignKeyConstraintName: 'fk_conuso_tipo' })
  tipoUso: Relation<TipoUso>;

  /** Cantidad en la unidad del tipo de uso (hectáreas, cabezas…). */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  magnitud: string;

  /**
   * Caudal calculado en el momento de la carga: magnitud × dotación (l/s).
   * Se guarda (no se recalcula al leer) porque la dotación del catálogo puede cambiar
   * con el tiempo y la concesión tiene que conservar el valor con que se otorgó.
   */
  @Column({ name: 'caudal_lps', type: 'decimal', precision: 10, scale: 3 })
  caudalLps: string;

  /** Trámite que lo cargó. NULL en las concesiones migradas. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_conuso_expediente' })
  expediente: Relation<Expediente> | null;
}
