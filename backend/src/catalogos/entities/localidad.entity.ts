import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Departamento } from './departamento.entity.js';
import { Distrito } from './distrito.entity.js';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';

/**
 * Localidad de un departamento (cat_localidad), con el distrito de riego al que pertenece.
 *
 * En el catálogo de la DRH cada localidad tiene un solo distrito. Si algún día una localidad
 * queda repartida entre dos, esta columna pasa a una tabla intermedia (cat_localidad_distrito).
 */
@Entity('cat_localidad')
// El nombre se repite entre departamentos (ej: «SAN JOSÉ»), por eso la clave es el par.
@Index('uk_localidad', ['departamento', 'nombre'], { unique: true })
@Check('chk_localidad_baja', CHECK_BAJA)
export class Localidad extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Departamento, (d) => d.localidades, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departamento_id', foreignKeyConstraintName: 'fk_localidad_departamento' })
  departamento: Relation<Departamento>;

  /** En mayúsculas, tal como lo muestra y lo manda el frontend. */
  @Column({ length: 100 })
  nombre: string;

  @Index('idx_localidad_distrito')
  @ManyToOne(() => Distrito, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_localidad_distrito' })
  distrito: Relation<Distrito>;
}
