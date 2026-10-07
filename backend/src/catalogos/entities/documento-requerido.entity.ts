import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { SituacionLegal } from './situacion-legal.entity.js';

/** Un papel que exige una situación legal (ej: "Informe de registro inmobiliario"). */
@Entity('cat_documento_requerido')
@Index('uk_documento_requerido', ['situacionLegal', 'descripcion'], { unique: true })
export class DocumentoRequerido {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SituacionLegal, (s) => s.documentos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'situacion_legal_codigo', foreignKeyConstraintName: 'fk_docreq_situacion' })
  situacionLegal: Relation<SituacionLegal>;

  @Column({ length: 200 })
  descripcion: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
