import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Distrito } from './distrito.entity.js';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';

/** Los niveles del árbol de suministro, en orden: cada uno cuelga de alguno de los anteriores. */
export enum NivelSuministro {
  FUENTE = 'FUENTE',
  SISTEMA = 'SISTEMA',
  CANAL_PRINCIPAL = 'CANAL_PRINCIPAL',
  CANAL_SECUNDARIO = 'CANAL_SECUNDARIO',
  CANAL_TERCIARIO = 'CANAL_TERCIARIO',
  CANAL_CUARTO = 'CANAL_CUARTO',
  CANAL_QUINTO = 'CANAL_QUINTO',
  DESAGUE = 'DESAGUE',
}

/** Orden de los niveles y cómo se nombran en los mensajes. */
export const NIVELES_SUMINISTRO: { nivel: NivelSuministro; nombre: string }[] = [
  { nivel: NivelSuministro.FUENTE, nombre: 'fuente de agua' },
  { nivel: NivelSuministro.SISTEMA, nombre: 'sistema de distribución' },
  { nivel: NivelSuministro.CANAL_PRINCIPAL, nombre: 'canal principal' },
  { nivel: NivelSuministro.CANAL_SECUNDARIO, nombre: 'canal secundario' },
  { nivel: NivelSuministro.CANAL_TERCIARIO, nombre: 'canal terciario' },
  { nivel: NivelSuministro.CANAL_CUARTO, nombre: 'canal cuarto' },
  { nivel: NivelSuministro.CANAL_QUINTO, nombre: 'canal quinto' },
  { nivel: NivelSuministro.DESAGUE, nombre: 'desagüe' },
];

/** 0 = fuente … 7 = desagüe. */
export const ordenDeNivel = (nivel: NivelSuministro) => NIVELES_SUMINISTRO.findIndex((n) => n.nivel === nivel);

export const nombreDeNivel = (nivel: NivelSuministro) => NIVELES_SUMINISTRO[ordenDeNivel(nivel)].nombre;

/**
 * Un tramo de la red de riego de un distrito (cat_suministro_nodo), tal como lo cargaron los
 * jefes de Distrito. Es UN árbol por distrito:
 *
 *   RIO CHOROMORO (fuente)
 *   └── DIQUE LA HIGUERA-CHOROMORO (sistema de distribución)
 *       └── MATRIZ LA HIGUERA (canal principal)
 *           └── DERIVADO NORTE (SAN JULIAN-BENJAMIN PAZ) (canal secundario)
 *               └── DERIVADO NORTE I (BENJAMIN PAZ) (canal terciario)
 *
 * Las fuentes son las raíces. Cada tramo cuelga de un tramo de un nivel ANTERIOR, no
 * necesariamente el inmediato: una rama puede no tener algún nivel (ej: un desagüe que sale
 * directo del canal principal). Un mismo nombre puede repetirse en otra rama («PROPIO»): lo
 * único es el nombre dentro de su padre y su nivel.
 *
 * El suministro de una concesión tiene que ser un camino de este árbol desde una fuente.
 * Con baja lógica: dar de baja un tramo da de baja también todo lo que cuelga de él.
 */
@Entity('cat_suministro_nodo')
@Index('uk_suministro_nodo_fuente', ['distrito', 'nombre'], { unique: true, where: 'padre_id IS NULL' })
@Index('uk_suministro_nodo_hijo', ['padre', 'nivel', 'nombre'], { unique: true, where: 'padre_id IS NOT NULL' })
@Check('chk_suministro_nodo_raiz', `(padre_id IS NULL) = (nivel = 'FUENTE')`)
@Check('chk_suministro_nodo_baja', CHECK_BAJA)
export class SuministroNodo extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Distrito, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'distrito_id', foreignKeyConstraintName: 'fk_suministro_nodo_distrito' })
  distrito: Relation<Distrito>;

  /** El tramo del que sale. NULL en las fuentes. */
  @ManyToOne(() => SuministroNodo, (n) => n.hijos, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'padre_id', foreignKeyConstraintName: 'fk_suministro_nodo_padre' })
  padre: Relation<SuministroNodo> | null;

  @OneToMany(() => SuministroNodo, (n) => n.padre)
  hijos: Relation<SuministroNodo>[];

  @Column({ type: 'enum', enum: NivelSuministro, enumName: 'cat_nivel_suministro' })
  nivel: NivelSuministro;

  /** Tal como lo cargó el jefe de Distrito, en mayúsculas y sin espacios de más. */
  @Column({ length: 120 })
  nombre: string;
}
