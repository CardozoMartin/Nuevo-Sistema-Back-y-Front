import { Column, Entity, OneToMany, PrimaryColumn, type Relation } from 'typeorm';
import { DocumentoRequerido } from './documento-requerido.entity.js';

/**
 * Situación legal del solicitante frente al inmueble: titular de dominio, poseedor o tenedor.
 * Define qué documentación en papel tiene que traer el expediente (paso 1 del alta).
 *
 * Es tabla y no ENUM porque la documentación exigida cambia con la normativa.
 */
@Entity('cat_situacion_legal')
export class SituacionLegal {
  /** Código estable que viaja en la API: TITULAR, POSEEDOR, TENEDOR. */
  @PrimaryColumn({ length: 20 })
  codigo: string;

  @Column({ length: 60 })
  nombre: string;

  /** Título con que se muestra el checklist (ej: "A. Titular de dominio"). */
  @Column({ length: 80 })
  titulo: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;

  // cascade insert: la carga inicial guarda la situación junto con sus documentos.
  @OneToMany(() => DocumentoRequerido, (doc) => doc.situacionLegal, { cascade: ['insert'] })
  documentos: Relation<DocumentoRequerido[]>;
}
