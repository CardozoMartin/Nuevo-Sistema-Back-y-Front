import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { EstadoExpediente, Etapa, Oficina } from '../expedientes.constantes.js';
import { Expediente } from './expediente.entity.js';

/** Qué pasó con el expediente en el circuito. */
export enum AccionAuditoria {
  /** Se registró en el sistema (quién lo inició). */
  INICIO = 'INICIO',
  /** Un usuario de la oficina donde está lo tomó. */
  TOMA = 'TOMA',
  /** Lo envió a otra oficina. */
  PASE = 'PASE',
  /** Lo devolvió a una oficina anterior (observado). */
  DEVOLUCION = 'DEVOLUCION',
  /** Cambió de etapa sin salir de la oficina. */
  CAMBIO_ETAPA = 'CAMBIO_ETAPA',
  /** Cambió de estado: observado, en espera, finalizado, rechazado… */
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
}

/**
 * Auditoría del expediente (exp_auditoria): cada cosa que pasó en el circuito, quién la hizo y
 * cuándo, desde que se inicia hasta que se finaliza. La escribe solo ExpedientesService, en la
 * misma transacción que el cambio. Las filas no se modifican ni se borran.
 *
 * Lo que resolvió cada oficina (deuda, informe, dictamen…) está en exp_actuacion, también con su usuario.
 */
@Entity('exp_auditoria')
@Index('idx_auditoria_expediente', ['expediente', 'fecha'])
@Index('idx_auditoria_usuario', ['usuario', 'fecha'])
export class Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Expediente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_auditoria_expediente' })
  expediente: Relation<Expediente>;

  @Column({ type: 'enum', enum: AccionAuditoria, enumName: 'exp_accion_auditoria' })
  accion: AccionAuditoria;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;

  /** Quién lo hizo. */
  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_auditoria_usuario' })
  usuario: Relation<Usuario>;

  /** Oficina donde estaba el expediente (en un pase, la de origen). */
  @Column({ type: 'enum', enum: Oficina, enumName: 'exp_oficina' })
  oficina: Oficina;

  /** Solo en pases y devoluciones. */
  @Column({ name: 'oficina_destino', type: 'enum', enum: Oficina, enumName: 'exp_oficina', nullable: true })
  oficinaDestino: Oficina | null;

  /** Etapa en la que queda el expediente después de la acción. */
  @Column({ type: 'enum', enum: Etapa, enumName: 'exp_etapa' })
  etapa: Etapa;

  /** Solo en los cambios de estado. */
  @Column({ name: 'estado_anterior', type: 'enum', enum: EstadoExpediente, enumName: 'exp_estado_expediente', nullable: true })
  estadoAnterior: EstadoExpediente | null;

  @Column({ name: 'estado_nuevo', type: 'enum', enum: EstadoExpediente, enumName: 'exp_estado_expediente', nullable: true })
  estadoNuevo: EstadoExpediente | null;
}
