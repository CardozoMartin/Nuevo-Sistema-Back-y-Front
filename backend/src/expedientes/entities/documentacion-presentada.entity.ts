import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { DocumentoRequerido } from '../../catalogos/entities/documento-requerido.entity.js';
import { Expediente } from './expediente.entity.js';

/**
 * Checklist del paso 1: qué papeles de los exigidos por la situación legal trae el
 * expediente físico. Una fila por papel presentado.
 */
@Entity('exp_documentacion_presentada')
@Index('uk_doc_presentada', ['expediente', 'documento'], { unique: true })
export class DocumentacionPresentada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Expediente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_docpres_expediente' })
  expediente: Relation<Expediente>;

  @ManyToOne(() => DocumentoRequerido, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'documento_requerido_id', foreignKeyConstraintName: 'fk_docpres_documento' })
  documento: Relation<DocumentoRequerido>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
