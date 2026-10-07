import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';

/**
 * Distrito de riego de la DRH (cat_distrito): I a VII. Cada jefatura de Distrito controla
 * las concesiones de su zona (es la oficina «Distrito» del circuito).
 *
 * Un distrito abarca localidades de varios departamentos, por eso no depende del departamento:
 * la relación está en cat_localidad.distrito_id.
 */
@Entity('cat_distrito')
@Check('chk_distrito_baja', CHECK_BAJA)
export class Distrito extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  /** Número romano, tal como lo manda el frontend: «II». Único (aunque esté dado de baja). */
  @Index('uk_distrito_codigo', { unique: true })
  @Column({ length: 10 })
  codigo: string;

  /** Para mostrar: «Distrito II». */
  @Column({ length: 60 })
  nombre: string;
}
