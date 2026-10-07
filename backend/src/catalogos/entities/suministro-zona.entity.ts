import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Departamento } from './departamento.entity.js';
import { Distrito } from './distrito.entity.js';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';
import { Localidad } from './localidad.entity.js';
import type { SuministroCanal } from './suministro-canal.entity.js';
import type { SuministroOpcion } from './suministro-opcion.entity.js';

/**
 * Zona del catálogo de suministro de riego (cat_suministro_zona): una combinación
 * departamento + localidad + distrito con sus fuentes, sistemas, desagües y su árbol de canales.
 *
 * El catálogo lo entregó la DRH (recursos/catalogos/suministro.json) y escribe las localidades
 * a su manera: a veces igual que el catálogo de ubicación, a veces distinto («TRANCAS» y
 * «VILLA DE TRANCAS»), y a veces con «(SIN LOCALIDAD)» para todo el departamento. Por eso:
 *   - `localidadOrigen` guarda el nombre tal como vino en el árbol;
 *   - `localidad` es la localidad del catálogo de ubicación a la que corresponde. Se vincula
 *     sola si el nombre coincide (sin mirar tildes); si no, queda NULL hasta que Catastro la
 *     vincule (PUT /api/catalogos/suministro/zonas/:id/localidad).
 *   - El formulario usa solo las zonas vinculadas: sin zona, no hay opciones para elegir.
 */
@Entity('cat_suministro_zona')
@Index('uk_suministro_zona_origen', ['departamento', 'distrito', 'localidadOrigen'], { unique: true })
// Una localidad del catálogo tiene una sola zona por distrito.
@Index('uk_suministro_zona_localidad', ['localidad', 'distrito'], { unique: true, where: 'localidad_id IS NOT NULL' })
@Check('chk_suministro_zona_baja', CHECK_BAJA)
export class SuministroZona extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Departamento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departamento_id', foreignKeyConstraintName: 'fk_suministro_zona_departamento' })
  departamento: Relation<Departamento>;

  @ManyToOne(() => Distrito, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_suministro_zona_distrito' })
  distrito: Relation<Distrito>;

  /** La localidad del catálogo de ubicación. NULL: «(SIN LOCALIDAD)» o todavía sin vincular. */
  @ManyToOne(() => Localidad, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'localidad_id', foreignKeyConstraintName: 'fk_suministro_zona_localidad' })
  localidad: Relation<Localidad> | null;

  /** La localidad tal como figura en el catálogo de la DRH (ej: «TRANCAS», «(SIN LOCALIDAD)»). */
  @Column({ name: 'localidad_origen', length: 100 })
  localidadOrigen: string;

  @OneToMany('SuministroOpcion', 'zona')
  opciones: Relation<SuministroOpcion>[];

  @OneToMany('SuministroCanal', 'zona')
  canales: Relation<SuministroCanal>[];
}
