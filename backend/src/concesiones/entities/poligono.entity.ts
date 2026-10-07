import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import type { MultiPolygon } from 'geojson';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { OrigenPoligono } from '../concesiones.constantes.js';
import { Concesion } from './concesion.entity.js';

/**
 * Polígono de la concesión (con_poligono): la superficie dibujada, guardada en PostGIS.
 *
 * - Geometría en POSGAR 2007 faja 3 (EPSG:5345): las superficies y perímetros salen en
 *   metros reales, y QGIS la lee directo (ver vista sig.v_concesiones).
 * - Histórico: una concesión tiene UN polígono vigente. Cuando una ampliación, reducción
 *   o reubicación lo cambia, el anterior queda con vigente = false y fecha `hasta`, y se
 *   inserta el nuevo. Así se puede reconstruir cómo era la concesión en cualquier fecha.
 * - Se conserva el KML original (ruta + hash) como respaldo de lo que presentó el titular.
 */
@Entity('con_poligono')
// Un solo polígono vigente por concesión (índice único parcial).
@Index('uk_poligono_vigente', ['concesion'], { unique: true, where: 'vigente' })
// Los datos del archivo van todos juntos o ninguno.
@Check('chk_poligono_archivo', '(archivo_ruta IS NULL) = (archivo_sha256 IS NULL)')
export class Poligono {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_poligono_concesion' })
  concesion: Relation<Concesion>;

  /**
   * MultiPolygon: una concesión puede tener varias partes separadas.
   * Índice espacial GIST: hace rápidas las búsquedas por zona del mapa y las superposiciones.
   * select: false porque es pesada; se lee con SQL (ST_AsGeoJSON) cuando hace falta.
   */
  @Index('idx_poligono_geom', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 5345, select: false })
  geom: MultiPolygon;

  /** Calculada por PostGIS sobre la geometría en POSGAR (no la declarada en el papel). */
  @Column({ name: 'superficie_ha', type: 'decimal', precision: 12, scale: 4 })
  superficieHa: string;

  @Column({ name: 'perimetro_m', type: 'decimal', precision: 12, scale: 2 })
  perimetroM: string;

  /** Qué trámite generó este polígono. */
  @Column({ type: 'enum', enum: OrigenPoligono, enumName: 'con_origen_poligono' })
  origen: OrigenPoligono;

  /** NULL en los polígonos migrados (no los generó un trámite del sistema). */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_poligono_expediente' })
  expediente: Relation<Expediente> | null;

  // --- Archivo original (NULL si el polígono no vino de un KML, ej: importado o dibujado) ---

  @Column({ name: 'archivo_nombre', type: 'varchar', length: 255, nullable: true })
  archivoNombre: string | null;

  /** Relativa a STORAGE_DIR. */
  @Column({ name: 'archivo_ruta', type: 'varchar', length: 500, nullable: true })
  archivoRuta: string | null;

  @Column({ name: 'archivo_sha256', type: 'varchar', length: 64, nullable: true })
  archivoSha256: string | null;

  @Column({ name: 'archivo_bytes', type: 'int', nullable: true })
  archivoBytes: number | null;

  /**
   * Sistema de coordenadas en que vino el archivo: POSGAR_FAJA3, WGS84 o «EPSG:nnnn» si un
   * GeoJSON declaró otro (ej: EPSG:22193, Campo Inchauspe). Lo guardado está
   * siempre en POSGAR; esto queda para saber cómo lo presentó el titular.
   */
  @Column({ name: 'sistema_origen', type: 'varchar', length: 20, nullable: true })
  sistemaOrigen: string | null;

  // --- Vigencia ---

  @Column({ default: true })
  vigente: boolean;

  /**
   * Desde cuándo rige: la fecha de la resolución que lo aprobó (se completa al otorgarse, como
   * en las demás tablas con historial). NULL mientras el trámite está en curso; para mostrar,
   * se usa la fecha de carga.
   */
  @Column({ type: 'date', nullable: true })
  desde: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  hasta: Date | null;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
