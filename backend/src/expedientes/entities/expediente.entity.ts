import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { EstadoExpediente, Etapa, Oficina, TipoTramite } from '../expedientes.constantes.js';
import { Movimiento } from './movimiento.entity.js';

/**
 * Expediente administrativo (exp_expediente). Es el eje del sistema: todo trámite
 * nace como expediente en papel, se registra acá y se mueve entre oficinas.
 */
@Entity('exp_expediente')
// El número se reinicia cada año, por eso la clave única es el trío completo. Un expediente
// ANULADO (iniciado por error) no ocupa el número: se puede volver a registrar.
@Index('uk_expediente', ['numero', 'reparticion', 'anio'], { unique: true, where: `estado <> 'ANULADO'` })
// Bandeja de entrada de cada oficina: la consulta más frecuente del sistema.
@Index('idx_exp_bandeja', ['oficinaActual', 'estado'])
@Index('idx_exp_tipo', ['tipoTramite', 'estado'])
export class Expediente {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Se guarda sin ceros a la izquierda ("0123" y "123" son el mismo expediente). */
  @Column({ length: 20 })
  numero: string;

  @Column({ length: 10 })
  reparticion: string;

  @Column({ type: 'smallint' })
  anio: number;

  @Column({ name: 'tipo_tramite', type: 'enum', enum: TipoTramite, enumName: 'exp_tipo_tramite' })
  tipoTramite: TipoTramite;

  @Column({ type: 'varchar', length: 255, nullable: true })
  asunto: string | null;

  @Column({ name: 'fecha_ingreso', type: 'date' })
  fechaIngreso: string;

  /**
   * Desnormalización deliberada: dónde está hoy el expediente. Tiene que coincidir siempre
   * con el destino del último movimiento (lo mantiene ExpedientesService, nunca a mano).
   */
  @Column({ name: 'oficina_actual', type: 'enum', enum: Oficina, enumName: 'exp_oficina' })
  oficinaActual: Oficina;

  @Column({ type: 'enum', enum: EstadoExpediente, enumName: 'exp_estado_expediente', default: EstadoExpediente.EN_TRAMITE })
  estado: EstadoExpediente;

  // --- Solicitante (se copia del primer titular para mostrar en bandejas y buscar) ---

  @Column({ name: 'solicitante_nombre', type: 'varchar', length: 200, nullable: true })
  solicitanteNombre: string | null;

  @Index('idx_exp_documento')
  @Column({ name: 'solicitante_documento', type: 'varchar', length: 20, nullable: true })
  solicitanteDocumento: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  // --- Circuito ---

  /** En qué paso del circuito está (cada etapa pertenece a una oficina: OFICINA_DE_ETAPA). */
  @Column({ type: 'enum', enum: Etapa, enumName: 'exp_etapa', default: Etapa.CARGA })
  etapa: Etapa;

  /**
   * Quién tiene el expediente en este momento dentro de su oficina. Se completa al «tomarlo»
   * y se vacía en cada pase: la oficina que lo recibe tiene que tomarlo antes de actuar.
   */
  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'tomado_por_usuario_id', foreignKeyConstraintName: 'fk_exp_tomado_por' })
  tomadoPor: Relation<Usuario> | null;

  @Column({ name: 'tomado_en', type: 'timestamptz', nullable: true })
  tomadoEn: Date | null;

  // --- Autoría ---

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;

  @OneToMany(() => Movimiento, (m) => m.expediente)
  movimientos: Relation<Movimiento[]>;
}
