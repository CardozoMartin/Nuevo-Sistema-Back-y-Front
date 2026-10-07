import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TipoDocumento, TipoPersona } from '../../concesiones/concesiones.constantes.js';

/**
 * Persona (física o jurídica) que es o fue titular de concesiones (per_persona).
 *
 * Es UNA sola por documento: si alguien ya es titular de otra concesión, el alta nueva
 * apunta a la misma persona. Así:
 *   - al cargar un titular ya existente se completan sus datos solos;
 *   - la deuda es de la persona (Recaudación la verifica para todas sus concesiones);
 *   - se puede ver de qué concesiones es titular cada uno.
 *
 * Las personas migradas del padrón anterior pueden no tener documento: esas no se pueden
 * unificar con otras (no hay con qué compararlas) y quedan con su «denominación».
 */
@Entity('per_persona')
// El documento identifica a la persona (índice único parcial: los NULL no cuentan).
@Index('uk_persona_documento', ['documento'], { unique: true, where: 'documento IS NOT NULL' })
@Check(
  'chk_persona_identidad',
  `(tipo_persona = 'JURIDICA' AND razon_social IS NOT NULL AND (tipo_documento IS NULL OR tipo_documento = 'CUIT')) OR
   (tipo_persona = 'FISICA' AND ((apellido IS NOT NULL AND nombre IS NOT NULL) OR denominacion IS NOT NULL))`,
)
@Check('chk_persona_documento', '(documento IS NULL) = (tipo_documento IS NULL)')
export class Persona {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'tipo_persona', type: 'enum', enum: TipoPersona, enumName: 'per_tipo_persona' })
  tipoPersona: TipoPersona;

  @Column({ name: 'tipo_documento', type: 'enum', enum: TipoDocumento, enumName: 'per_tipo_documento', nullable: true })
  tipoDocumento: TipoDocumento | null;

  /** Solo dígitos: DNI de 7-8 o CUIT/CUIL de 11. */
  @Column({ type: 'varchar', length: 11, nullable: true })
  documento: string | null;

  // Persona física
  @Column({ type: 'varchar', length: 100, nullable: true })
  apellido: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nombre: string | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: string | null;

  // Persona jurídica
  @Column({ name: 'razon_social', type: 'varchar', length: 200, nullable: true })
  razonSocial: string | null;

  @Column({ name: 'fecha_constitucion', type: 'date', nullable: true })
  fechaConstitucion: string | null;

  /** Nombre tal como figura en el padrón anterior (ej: «ABELLA JOSE»). Solo en personas migradas. */
  @Column({ type: 'varchar', length: 250, nullable: true })
  denominacion: string | null;

  // Contacto (el último declarado)
  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;
}

/** Nombre para mostrar: razón social, «Apellido, Nombre» o la denominación del padrón anterior. */
export function nombrePersona(p: Pick<Persona, 'tipoPersona' | 'razonSocial' | 'apellido' | 'nombre' | 'denominacion'>): string {
  if (p.tipoPersona === TipoPersona.JURIDICA && p.razonSocial) return p.razonSocial;
  if (p.apellido && p.nombre) return `${p.apellido}, ${p.nombre}`;
  return p.denominacion ?? p.razonSocial ?? '—';
}
