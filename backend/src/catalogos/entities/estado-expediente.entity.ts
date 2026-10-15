import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Estado general de un expediente (cat_estado_expediente): cómo se muestra.
 * El código es el del enum EstadoExpediente.
 */
@Entity('cat_estado_expediente')
export class EstadoExpedienteCatalogo {
  @PrimaryColumn({ length: 30 })
  codigo: string;

  @Column({ length: 60 })
  nombre: string;

  /** Color de la etiqueta en pantalla: azul, ambar, verde, gris, rojo. */
  @Column({ length: 20 })
  color: string;

  /** La oficina tiene que atenderlo (cuenta en su bandeja). */
  @Column({ default: false })
  pendiente: boolean;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}
