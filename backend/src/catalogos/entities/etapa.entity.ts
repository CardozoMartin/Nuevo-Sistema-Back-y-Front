import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { OficinaDrh } from '../../seguridad/entities/oficina.entity.js';

/**
 * Etapa del circuito de un expediente (cat_etapa): nombre para mostrar y oficina que la atiende.
 * El código es el del enum Etapa de expedientes; el recorrido (qué etapa sigue) está en el código.
 */
@Entity('cat_etapa')
export class EtapaCatalogo {
  @PrimaryColumn({ length: 40 })
  codigo: string;

  @Column({ length: 80 })
  nombre: string;

  @ManyToOne(() => OficinaDrh, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'oficina_codigo', foreignKeyConstraintName: 'fk_etapa_oficina' })
  oficina: Relation<OficinaDrh>;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
