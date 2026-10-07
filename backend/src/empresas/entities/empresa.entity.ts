import { Check, Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { Maquina } from './maquina.entity.js';

/**
 * Estados del circuito de alta (los mismos que usa el frontend).
 * El esquema MySQL de Documentacion/ todavía tiene ACTIVA | BAJA | PENDIENTE_RESOLUCION.
 */
export enum EstadoEmpresa {
  EN_TRAMITE = 'EN_TRAMITE',
  OBSERVADA = 'OBSERVADA',
  RECHAZADA = 'RECHAZADA',
  ACTIVA = 'ACTIVA',
  BAJA = 'BAJA',
}

/**
 * Empresa perforadora (RF05, RF06) — tabla emp_empresa de Documentacion/esquema_drh.sql.
 * Pendiente: FKs a seg_usuario, cat_departamento, cat_localidad, exp_resolucion y exp_expediente
 * cuando existan esos módulos; por ahora los ids se guardan sin relación.
 */
@Entity('emp_empresa')
@Check('chk_empresa_nombre', `(persona_juridica AND razon_social IS NOT NULL) OR (NOT persona_juridica AND nombre IS NOT NULL AND apellido IS NOT NULL)`)
export class Empresa {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'persona_juridica' })
  personaJuridica: boolean;

  @Index('uk_empresa_cuit', { unique: true })
  @Column({ length: 13 })
  cuit: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 200, nullable: true })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nombre: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apellido: string | null;

  @Column({ name: 'ingresos_brutos', type: 'varchar', length: 30, nullable: true })
  ingresosBrutos: string | null;

  @Column({ name: 'convenio_multilateral', default: false })
  convenioMultilateral: boolean;

  @Column({ name: 'registro_comercio', type: 'varchar', length: 30, nullable: true })
  registroComercio: string | null;

  @Column({ name: 'domicilio_fiscal', type: 'varchar', length: 255, nullable: true })
  domicilioFiscal: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, default: 'Tucumán' })
  provincia: string | null;

  @Column({ name: 'departamento_id', type: 'int', nullable: true })
  departamentoId: number | null;

  @Column({ name: 'localidad_id', type: 'int', nullable: true })
  localidadId: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Index('idx_empresa_estado')
  @Column({ type: 'enum', enum: EstadoEmpresa, enumName: 'emp_estado_empresa', default: EstadoEmpresa.EN_TRAMITE })
  estado: EstadoEmpresa;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz', nullable: true })
  modificadoEn: Date | null;

  @OneToMany(() => Maquina, (maquina) => maquina.empresa, { cascade: ['insert'] })
  maquinas: Relation<Maquina[]>;
}
