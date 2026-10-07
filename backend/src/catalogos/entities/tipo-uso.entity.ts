import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Tipo de uso del agua (cat_tipo_uso): riego, industrial, pecuario…
 *
 * Cada uso tiene un módulo de dotación: litros por segundo por unidad de magnitud
 * (Art. 32 de la Ley 7139/7140). El caudal de un uso es magnitud × dotación; por ejemplo,
 * 10 ha de riego × 0,75 l/s/ha = 7,5 l/s.
 */
@Entity('cat_tipo_uso')
export class TipoUso {
  /** Código estable que viaja en la API (ej: "agricola-riego"). */
  @PrimaryColumn({ length: 40 })
  codigo: string;

  @Column({ length: 80, unique: true })
  nombre: string;

  /** l/s por unidad. Postgres devuelve los DECIMAL como string. */
  @Column({ type: 'decimal', precision: 8, scale: 3 })
  dotacion: string;

  /** Unidad de la magnitud: ha, cabeza, unidad productiva… */
  @Column({ length: 40 })
  unidad: string;

  /** Si la concesión tiene este uso, hay que declarar el punto de entrega del agua (ej: pecuario). */
  @Column({ name: 'requiere_punto_entrega', default: false })
  requierePuntoEntrega: boolean;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
