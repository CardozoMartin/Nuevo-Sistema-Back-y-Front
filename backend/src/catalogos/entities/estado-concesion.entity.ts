import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Estado de una concesión (cat_estado_concesion): cómo se muestra en la consulta.
 * El código es el del enum EstadoConcesion.
 */
@Entity('cat_estado_concesion')
export class EstadoConcesionCatalogo {
  @PrimaryColumn({ length: 30 })
  codigo: string;

  @Column({ length: 60 })
  nombre: string;

  /** Color de la etiqueta en pantalla: azul, ambar, verde, gris, rojo. */
  @Column({ length: 20 })
  color: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}
