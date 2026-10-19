import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { OficinaDrh } from '../../seguridad/entities/oficina.entity.js';
import { TipoTramiteCatalogo } from './tipo-tramite.entity.js';

/**
 * Plazo de cada trámite en una oficina (cat_plazo_oficina): cuántos días corridos puede estar un
 * expediente en la oficina desde que llegó. La bandeja avisa cuando está por vencer o vencido y
 * los pone primero. Una oficina sin filas no tiene plazos (su bandeja no avisa nada).
 */
@Entity('cat_plazo_oficina')
@Check('chk_plazo_dias', 'dias > 0')
export class PlazoOficina {
  @PrimaryColumn({ name: 'oficina_codigo', length: 30 })
  oficinaCodigo: string;

  @PrimaryColumn({ name: 'tipo_tramite_codigo', length: 40 })
  tipoTramiteCodigo: string;

  @ManyToOne(() => OficinaDrh, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'oficina_codigo', foreignKeyConstraintName: 'fk_plazo_oficina' })
  oficina: Relation<OficinaDrh>;

  @ManyToOne(() => TipoTramiteCatalogo, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipo_tramite_codigo', foreignKeyConstraintName: 'fk_plazo_tramite' })
  tipoTramite: Relation<TipoTramiteCatalogo>;

  @Column({ type: 'smallint' })
  dias: number;
}
