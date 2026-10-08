import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { LineString } from 'geojson';
import { CHECK_BAJA, FilaCatalogo } from '../../catalogos/entities/fila-catalogo.js';

/**
 * Ríos y canales (sig.cauce): capa de referencia del visor y de QGIS. Está en el esquema «sig»
 * porque es una capa geográfica para leer (el rol drh_lector_sig la ve sin permisos extra).
 *
 * Hoy se carga del trazado de OpenStreetMap (recursos/sig/cauces-osm.json, npm run sig:cauces).
 * Cuando la DRH tenga su propia capa de cauces y canales de riego, se carga con otra `fuente`
 * y conviven (o se reemplaza la de OSM).
 *
 * Se administra por la API (POST/PUT/DELETE /api/catalogos/cauces), con baja lógica: un cauce
 * dado de baja deja de verse en el visor y de usarse para los avisos, pero la fila queda.
 */
@Entity({ schema: 'sig', name: 'cauce' })
@Check('chk_cauce_tipo', `tipo IN ('RIO', 'CANAL')`)
@Check('chk_cauce_baja', CHECK_BAJA)
export class Cauce extends FilaCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  /** NULL en los arroyos y acequias sin nombre. */
  @Index('idx_cauce_nombre')
  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre: string | null;

  @Column({ length: 10 })
  tipo: 'RIO' | 'CANAL';

  /** De dónde salió el trazado (ej: «OpenStreetMap», «DRH»). La carga de un archivo reemplaza los de la misma fuente. */
  @Column({ length: 60 })
  fuente: string;

  @Index('idx_cauce_geom', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 5345, select: false })
  geom: LineString;

  /** Calculado por PostGIS al cargar. */
  @Column({ name: 'largo_km', type: 'decimal', precision: 8, scale: 2 })
  largoKm: string;
}
