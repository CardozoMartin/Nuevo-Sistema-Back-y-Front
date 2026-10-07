import { Column } from 'typeorm';

/**
 * Columnas comunes de los datos de una concesión que guardan historial (titulares,
 * domicilios, inmueble, condiciones, usos, puntos y suministro).
 *
 * Cómo funciona:
 *   1. Cada dato vigente es una fila con vigente = true.
 *   2. Un trámite posterior (cambio de titularidad, reubicación, ampliación…) NO pisa la
 *      fila: la cierra (vigente = false, hasta = fecha) e inserta la nueva.
 *   3. Cada tabla, además, guarda el expediente que creó la fila (expediente_id). Esa
 *      relación se declara en cada entidad para que la clave foránea tenga su propio nombre.
 *
 * Mientras el alta está en carga, lo cargado es una propuesta del mismo expediente: se
 * reemplaza al guardar. `desde` se completa cuando la concesión se otorga.
 */
export abstract class FilaVersionada {
  @Column({ default: true })
  vigente: boolean;

  /** Desde cuándo rige (fecha de la resolución que lo otorgó o lo cambió). NULL mientras está en trámite. */
  @Column({ type: 'date', nullable: true })
  desde: string | null;

  /** Hasta cuándo rigió. NULL mientras está vigente. */
  @Column({ type: 'date', nullable: true })
  hasta: string | null;
}
