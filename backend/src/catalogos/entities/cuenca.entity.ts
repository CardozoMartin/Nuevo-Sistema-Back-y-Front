import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CHECK_BAJA, FilaCatalogo } from './fila-catalogo.js';

/**
 * Cuenca hídrica (cat_cuenca): «CUENCA RIO SALI», «CUENCA RIO CALERA»…
 *
 * La lista inicial sale del padrón (recursos/catalogos/cuencas.json) y está A CONFIRMAR con
 * la DRH; se corrige con el ABM de ubicaciones. Una cuenca cruza varios departamentos, por
 * eso no depende de ninguno.
 */
@Entity('cat_cuenca')
@Check('chk_cuenca_baja', CHECK_BAJA)
export class Cuenca extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('uk_cuenca_nombre', { unique: true })
  @Column({ length: 120 })
  nombre: string;
}
