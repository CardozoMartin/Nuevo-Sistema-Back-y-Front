import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Tipo de trámite (cat_tipo_tramite): nombre, descripción e ícono con que se ofrece.
 * El código es el del enum TipoTramite de expedientes (ALTA_CONCESION, BAJA_POZO…).
 */
@Entity('cat_tipo_tramite')
export class TipoTramiteCatalogo {
  @PrimaryColumn({ length: 40 })
  codigo: string;

  @Column({ length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion: string | null;

  /** Ícono de Material Symbols (ej: add_location_alt). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  icono: string | null;

  /** Se ofrece en el menú de trámites sobre concesiones de Catastro. */
  @Column({ name: 'en_menu_catastro', default: false })
  enMenuCatastro: boolean;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
