import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import type { Point } from 'geojson';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { TipoPunto } from '../concesiones.constantes.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Punto con coordenadas declarado en la sección de usos (con_punto): el desagüe y, si algún
 * uso lo exige, el punto de entrega del agua. Uno vigente de cada tipo por concesión.
 *
 * La oficina carga X/Y en POSGAR 2007 faja 3 (EPSG:5345): se guardan tal cual (coord_x,
 * coord_y), como geometría (geom, para QGIS y búsquedas por zona) y PostGIS calcula la
 * latitud/longitud WGS84 que usa el mapa web.
 */
@Entity('con_punto')
@Index('uk_punto_vigente', ['concesion', 'tipo'], { unique: true, where: 'vigente' })
@Check('chk_punto_rango', 'latitud BETWEEN -55 AND -21 AND longitud BETWEEN -74 AND -53')
@Check('chk_punto_posgar', '(coord_x IS NULL) = (coord_y IS NULL) AND (coord_x IS NULL OR (coord_x BETWEEN 3000000 AND 4000000 AND coord_y BETWEEN 6000000 AND 8000000))')
export class Punto extends FilaVersionada {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Concesion, (c) => c.puntos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'concesion_id', foreignKeyConstraintName: 'fk_punto_concesion' })
  concesion: Relation<Concesion>;

  @Column({ type: 'enum', enum: TipoPunto, enumName: 'con_tipo_punto' })
  tipo: TipoPunto;

  /** POSGAR 2007 faja 3, en metros: lo que cargó la oficina. */
  @Column({ name: 'coord_x', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coordX: string | null;

  @Column({ name: 'coord_y', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coordY: string | null;

  /** El mismo punto como geometría POSGAR 07 (índice espacial). NULL si no hay X/Y. */
  @Index('idx_punto_geom', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 5345, nullable: true, select: false })
  geom: Point | null;

  /** WGS84 en grados decimales (6 decimales ≈ 10 cm), calculados por PostGIS desde X/Y. */
  @Column({ type: 'decimal', precision: 9, scale: 6 })
  latitud: string;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  longitud: string;

  /** Descripción del lugar (ej: "Bebedero norte, junto al corral"). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia: string | null;

  /** Trámite que lo declaró. */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_punto_expediente' })
  expediente: Relation<Expediente> | null;
}
