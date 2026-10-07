import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { SuministroZona } from './suministro-zona.entity.js';

/** Nombre de cada nivel del árbol de canales (el nivel 1 es el canal principal). */
export const NIVELES_CANAL = ['canal principal', 'canal secundario', 'canal terciario', 'canal cuarto', 'canal quinto'] as const;

/**
 * Un canal del árbol de riego de una zona (cat_suministro_canal). Es un árbol:
 *
 *   MATRIZ (principal, nivel 1)
 *   └── DVDO. NORTE (secundario, nivel 2)
 *       └── LOS RALOS (terciario, nivel 3)
 *           ├── COMPUERTA 1 (cuarto, nivel 4)
 *           └── CPTA.7 (cuarto, nivel 4)
 *               └── PROPIO (quinto, nivel 5)
 *
 * Cada canal apunta a su padre; los principales no tienen padre. Un mismo nombre puede
 * aparecer en distintas ramas («PROPIO»): lo que es único es el nombre dentro de su padre.
 * El suministro de una concesión tiene que ser un camino de este árbol, desde la raíz.
 */
@Entity('cat_suministro_canal')
// Únicos: el nombre entre los principales de la zona, y el nombre entre los hijos de un canal.
@Index('uk_suministro_canal_principal', ['zona', 'nombre'], { unique: true, where: 'padre_id IS NULL' })
@Index('uk_suministro_canal_hijo', ['padre', 'nombre'], { unique: true, where: 'padre_id IS NOT NULL' })
@Check('chk_suministro_canal_nivel', 'nivel BETWEEN 1 AND 5 AND ((padre_id IS NULL) = (nivel = 1))')
export class SuministroCanal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SuministroZona, (z) => z.canales, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'zona_id', foreignKeyConstraintName: 'fk_suministro_canal_zona' })
  zona: Relation<SuministroZona>;

  /** El canal del que sale. NULL en los canales principales. */
  @ManyToOne(() => SuministroCanal, (c) => c.hijos, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'padre_id', foreignKeyConstraintName: 'fk_suministro_canal_padre' })
  padre: Relation<SuministroCanal> | null;

  @OneToMany(() => SuministroCanal, (c) => c.padre)
  hijos: Relation<SuministroCanal>[];

  /** 1 = principal, 2 = secundario, 3 = terciario, 4 = cuarto, 5 = quinto. */
  @Column({ type: 'smallint' })
  nivel: number;

  @Column({ length: 120 })
  nombre: string;
}
