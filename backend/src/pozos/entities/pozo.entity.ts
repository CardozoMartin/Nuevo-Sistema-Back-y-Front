import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import type { Point } from 'geojson';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { Empresa } from '../../empresas/entities/empresa.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoPozo, OrigenPozo } from '../pozos.constantes.js';

/**
 * Pozo (poz_pozo), según Documentacion/esquema_drh.sql. Por ahora están las columnas que
 * usan el mapa y la importación; los datos técnicos completos (tramos, filtros, litología,
 * régimen de explotación, registro provisorio) se suman con el formulario de alta de pozo.
 *
 * Diferencias con el esquema MySQL:
 *   - La ubicación es una geometría PostGIS (Point en POSGAR 07, EPSG:5345) en vez de
 *     coord_x / coord_y. Las coordenadas X/Y salen con ST_X / ST_Y (ver sig.v_pozos).
 *   - expediente_id admite NULL para los pozos migrados (origen MIGRACION).
 *
 * TODO(pozos): coordenada única entre pozos no anulados (paso 5 del CU).
 */
@Entity('poz_pozo')
// Paso 2 del CU: un pozo fuera de la jurisdicción de la DRH no genera concesión.
@Check('chk_pozo_jurisdiccion', 'jurisdiccion_drh OR concesion_id IS NULL')
@Check('chk_pozo_expediente', `origen = 'MIGRACION' OR expediente_id IS NOT NULL`)
export class Pozo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** ID único que genera el sistema (paso 20 del CU). */
  @Index('uk_pozo_interno', { unique: true })
  @Column({ name: 'id_interno', length: 20 })
  idInterno: string;

  @Column({ type: 'enum', enum: OrigenPozo, enumName: 'poz_origen_pozo', default: OrigenPozo.AUTORIZACION })
  origen: OrigenPozo;

  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_pozo_expediente' })
  expediente: Relation<Expediente> | null;

  /** Empresa que perforó (NULL si no se conoce, como en los migrados). */
  @ManyToOne(() => Empresa, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'empresa_id', foreignKeyConstraintName: 'fk_pozo_empresa' })
  empresa: Relation<Empresa> | null;

  /** FALSE: escuelas, freatímetros, consumo humano. Se registran pero no pagan canon. */
  @Column({ name: 'jurisdiccion_drh', default: true })
  jurisdiccionDrh: boolean;

  /** Nombre del pozo según el dueño (ej: «Pozo 2 - Lote norte»). */
  @Index('idx_pozo_alias')
  @Column({ type: 'varchar', length: 120, nullable: true })
  alias: string | null;

  @Index('idx_pozo_estado')
  @Column({ type: 'enum', enum: EstadoPozo, enumName: 'poz_estado_pozo', default: EstadoPozo.EN_USO })
  estado: EstadoPozo;

  @Column({ name: 'tipo_pozo', type: 'varchar', length: 60, nullable: true })
  tipoPozo: string | null;

  /** Ubicación en POSGAR 07. select: false: se lee con SQL (ST_AsGeoJSON) cuando hace falta. */
  @Index('idx_pozo_geom', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 5345, select: false })
  geom: Point;

  /** Metros sobre el nivel del mar. */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  cota: string | null;

  @Column({ name: 'profundidad_real', type: 'decimal', precision: 8, scale: 2, nullable: true })
  profundidadReal: string | null;

  /** Negativo bajo el nivel del suelo; positivo solo en pozos surgentes. */
  @Column({ name: 'nivel_estatico', type: 'decimal', precision: 8, scale: 2, nullable: true })
  nivelEstatico: string | null;

  @Column({ name: 'nivel_dinamico', type: 'decimal', precision: 8, scale: 2, nullable: true })
  nivelDinamico: string | null;

  /** Unidad convencional del campo. */
  @Column({ name: 'caudal_bombeo_m3h', type: 'decimal', precision: 10, scale: 3, nullable: true })
  caudalBombeoM3h: string | null;

  /** RN-08: la unidad impositiva de Catastro. La calcula la base (m³/h ÷ 3,6). */
  @Column({
    name: 'caudal_bombeo_lps',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
    generatedType: 'STORED',
    asExpression: 'caudal_bombeo_m3h / 3.6',
    insert: false,
    update: false,
  })
  caudalBombeoLps: string | null;

  /** Concesión que el pozo abastece (cierra el circuito entre pozos y concesiones). */
  @Index('idx_pozo_concesion')
  @ManyToOne(() => Concesion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_pozo_concesion' })
  concesion: Relation<Concesion> | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** Fecha de importación del sistema anterior (flujo alternativo 3.1 del CU-A07). */
  @Column({ name: 'migrado_en', type: 'date', nullable: true })
  migradoEn: string | null;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
