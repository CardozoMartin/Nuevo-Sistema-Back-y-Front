import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import type { Point } from 'geojson';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { SistemaCoordenadas } from '../../sig/kml/sistema-coordenadas.js';
import { TipoPunto } from '../concesiones.constantes.js';
import { Concesion } from './concesion.entity.js';
import { FilaVersionada } from './fila-versionada.js';

/**
 * Punto con coordenadas declarado en la sección de usos (con_punto): el desagüe y, si algún
 * uso lo exige, el punto de entrega del agua. Uno vigente de cada tipo por concesión.
 *
 * Se puede cargar en X/Y POSGAR 2007 faja 3 (EPSG:5345, lo habitual en la oficina) o en
 * latitud/longitud (grados). Sea cual sea, se guardan siempre las dos formas, calculadas por
 * PostGIS: X/Y (coord_x, coord_y y geom, para QGIS y búsquedas por zona) y la latitud/longitud
 * WGS84 que usa el mapa web. `sistema_carga` recuerda en cuál se cargó, para volver a mostrarlo igual.
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

  /** En qué sistema se cargó: el valor de ese sistema es el original, el otro es calculado. */
  @Column({ name: 'sistema_carga', type: 'enum', enum: SistemaCoordenadas, enumName: 'con_sistema_coordenadas', default: SistemaCoordenadas.POSGAR_FAJA3 })
  sistemaCarga: SistemaCoordenadas;

  /** POSGAR 2007 faja 3, en metros (NULL solo en puntos viejos, anteriores a guardar las dos formas). */
  @Column({ name: 'coord_x', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coordX: string | null;

  @Column({ name: 'coord_y', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coordY: string | null;

  /** El mismo punto como geometría POSGAR 07 (índice espacial). NULL si no hay X/Y. */
  @Index('idx_punto_geom', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 5345, nullable: true, select: false })
  geom: Point | null;

  /** WGS84 en grados decimales (6 decimales ≈ 10 cm). */
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
