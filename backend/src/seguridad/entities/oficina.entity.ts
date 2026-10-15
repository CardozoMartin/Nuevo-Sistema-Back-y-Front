import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Padrón de oficinas de la DRH (seg_oficina). Por ellas circulan los expedientes.
 * El código es el mismo que usa el frontend (catastro, recaudacion…).
 */
@Entity('seg_oficina')
export class OficinaDrh {
  @PrimaryColumn({ length: 30 })
  codigo: string;

  @Column({ length: 80 })
  nombre: string;

  /** Qué hace la oficina (se muestra en su pantalla de inicio). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion: string | null;

  /** Qué hay en su bandeja de expedientes. */
  @Column({ name: 'descripcion_bandeja', type: 'varchar', length: 200, nullable: true })
  descripcionBandeja: string | null;

  /** Orden en el circuito de los trámites de concesiones (para listados). */
  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ default: true })
  activa: boolean;
}
