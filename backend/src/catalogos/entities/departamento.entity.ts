import { Check, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';
import { Localidad } from './localidad.entity.js';

/**
 * Departamento de la provincia de Tucumán (cat_departamento): BURRUYACU, CAPITAL, CHICLIGASTA…
 * Es el primer nivel de la cascada departamento → localidad → distrito que usan el domicilio
 * del titular y la ubicación de la concesión. Se administra con el ABM de ubicaciones.
 */
@Entity('cat_departamento')
@Check('chk_departamento_baja', CHECK_BAJA)
export class Departamento extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  /** En mayúsculas, tal como lo muestra y lo manda el frontend. Único (aunque esté dado de baja). */
  @Index('uk_departamento_nombre', { unique: true })
  @Column({ length: 80 })
  nombre: string;

  @OneToMany(() => Localidad, (l) => l.departamento)
  localidades: Relation<Localidad[]>;
}
