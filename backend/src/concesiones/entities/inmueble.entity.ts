import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Cuenca } from '../../catalogos/entities/cuenca.entity.js';
import { Departamento } from '../../catalogos/entities/departamento.entity.js';
import { Distrito } from '../../catalogos/entities/distrito.entity.js';
import { Localidad } from '../../catalogos/entities/localidad.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Inmueble (parcela) sobre el que se otorga la concesión (con_inmueble). Junta tres bloques
 * del formulario:
 *   - Ubicación de la concesión (paso 3): departamento, localidad y distrito, del catálogo.
 *     El polígono dibujado va aparte, en con_poligono (PostGIS).
 *   - Datos catastrales (paso 4): padrón, matrícula, circunscripción, sección, parcela, lámina, orden.
 *   - Registro de dominio (paso 4): libro, folio, año, matrícula, serie.
 *
 * Historial: una concesión tiene UN inmueble vigente. Una reubicación o una subdivisión
 * cierran el vigente e insertan uno nuevo, así queda dónde estuvo la concesión antes.
 *
 * Como los pasos se cargan por separado, la base admite NULL en todo; lo obligatorio de cada
 * paso lo controla su DTO. Las concesiones migradas pueden no tener localidad si el padrón
 * trae una que no está en el catálogo (el texto original queda en mig_registro_origen).
 */
@Entity('con_inmueble')
// Un solo inmueble vigente por concesión (índice único parcial).
@Index('uk_inmueble_vigente', ['concesion'], { unique: true, where: 'vigente' })
@Index('idx_inmueble_padron', ['padron'])
@Index('idx_inmueble_matricula', ['matriculaCatastral'])
@Check('chk_inmueble_anio_dominio', 'anio_dominio IS NULL OR anio_dominio >= 1900')
export class Inmueble extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.inmuebles, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_inmueble_concesion' })
  concesion: Relation<Concesion>;

  // --- Ubicación de la concesión (paso 3), del catálogo ---

  @ManyToOne(() => Departamento, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departamento_id', foreignKeyConstraintName: 'fk_inmueble_departamento' })
  departamento: Relation<Departamento> | null;

  @ManyToOne(() => Localidad, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'localidad_id', foreignKeyConstraintName: 'fk_inmueble_localidad' })
  localidad: Relation<Localidad> | null;

  @ManyToOne(() => Distrito, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_inmueble_distrito' })
  distrito: Relation<Distrito> | null;

  /** Cuenca hídrica. La informa el padrón; el alta todavía no la pide. */
  @ManyToOne(() => Cuenca, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cuenca_id', foreignKeyConstraintName: 'fk_inmueble_cuenca' })
  cuenca: Relation<Cuenca> | null;

  // --- Datos catastrales (paso 4) ---

  /** Padrón de Rentas. En el alta no se edita: lo informa Rentas al final del trámite. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  padron: string | null;

  @Column({ name: 'matricula_catastral', type: 'varchar', length: 30, nullable: true })
  matriculaCatastral: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  circunscripcion: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  seccion: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  parcela: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lamina: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  orden: string | null;

  // --- Registro de dominio (paso 4, todos opcionales) ---

  @Column({ type: 'varchar', length: 20, nullable: true })
  libro: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  folio: string | null;

  @Column({ name: 'anio_dominio', type: 'smallint', nullable: true })
  anioDominio: number | null;

  @Column({ name: 'matricula_dominio', type: 'varchar', length: 30, nullable: true })
  matriculaDominio: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  serie: string | null;

  /** Trámite que cargó esta versión. NULL en las concesiones migradas. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_inmueble_expediente' })
  expediente: Relation<Expediente> | null;
}
