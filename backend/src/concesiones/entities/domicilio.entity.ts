import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Departamento } from '../../catalogos/entities/departamento.entity.js';
import { Distrito } from '../../catalogos/entities/distrito.entity.js';
import { Localidad } from '../../catalogos/entities/localidad.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Domicilio legal del titular declarado en el expediente (con_domicilio). Puede haber uno
 * o varios: el orden 0 es el «Domicilio legal» y el resto, adicionales.
 *
 * NO es la ubicación de la concesión (eso está en con_inmueble, junto con el KML).
 *
 * Se guarda en la concesión porque el formulario carga los domicilios en una lista aparte
 * de los titulares, sin indicar de cuál es cada uno.
 */
@Entity('con_domicilio')
@Index('idx_domicilio_concesion', ['concesion', 'vigente'])
export class Domicilio extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.domicilios, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_domicilio_concesion' })
  concesion: Relation<Concesion>;

  @Column({ type: 'smallint' })
  orden: number;

  @Column({ length: 150 })
  calle: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  // --- Ubicación: departamento → localidad → distrito, del catálogo ---

  @ManyToOne(() => Departamento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departamento_id', foreignKeyConstraintName: 'fk_domicilio_departamento' })
  departamento: Relation<Departamento>;

  @ManyToOne(() => Localidad, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'localidad_id', foreignKeyConstraintName: 'fk_domicilio_localidad' })
  localidad: Relation<Localidad>;

  @ManyToOne(() => Distrito, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_domicilio_distrito' })
  distrito: Relation<Distrito>;

  /** Trámite que lo declaró. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_domicilio_expediente' })
  expediente: Relation<Expediente> | null;
}
