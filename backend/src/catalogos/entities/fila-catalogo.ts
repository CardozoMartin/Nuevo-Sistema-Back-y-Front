import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { USUARIO_SISTEMA } from '../../comun/usuario-sistema.js';

/**
 * Columnas comunes de las filas de un catálogo que se administra desde la API
 * (departamentos, localidades, distritos, cuencas, el catálogo de suministro y los cauces):
 * autoría y BAJA LÓGICA.
 *
 * Nada se borra (RN-A04): dar de baja es poner activo = false con el motivo, la fecha y
 * quién lo hizo. Una fila dada de baja deja de ofrecerse para las cargas nuevas, pero las
 * concesiones que ya la usan la conservan. Se puede reactivar.
 *
 * Cada entidad declara además su CHECK `chk_<tabla>_baja`: si está inactiva, tiene que
 * tener motivo y fecha de baja.
 */
export abstract class FilaCatalogo {
  @Column({ default: true })
  activo: boolean;

  // --- Autoría (la carga inicial queda a nombre del usuario SISTEMA) ---

  @Column({ name: 'creado_usuario_id', type: 'bigint', default: USUARIO_SISTEMA })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;

  // --- Baja lógica ---

  @Column({ name: 'baja_motivo', type: 'text', nullable: true })
  bajaMotivo: string | null;

  @Column({ name: 'baja_en', type: 'timestamptz', nullable: true })
  bajaEn: Date | null;

  @Column({ name: 'baja_usuario_id', type: 'bigint', nullable: true })
  bajaUsuarioId: string | null;
}

/** Expresión del CHECK de baja (la usa cada entidad con su propio nombre de restricción). */
export const CHECK_BAJA = 'activo OR (baja_motivo IS NOT NULL AND baja_en IS NOT NULL)';
