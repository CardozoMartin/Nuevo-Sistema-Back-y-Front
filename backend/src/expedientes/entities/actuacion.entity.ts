import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { Etapa, Oficina, ResultadoActuacion, TipoActuacion } from '../expedientes.constantes.js';
import { Expediente } from './expediente.entity.js';

/**
 * Lo que resolvió una oficina sobre el expediente (exp_actuacion): verificación de deuda,
 * informe de Distrito, dictamen de Jurídico, resolución, padrón… Con el resultado (apto,
 * no apto, observado, con/sin deuda), las observaciones y quién lo hizo.
 *
 * Junto con los pases (exp_movimiento) forma el historial completo del expediente.
 * Las filas no se modifican ni se borran.
 */
@Entity('exp_actuacion')
@Index('idx_actuacion_expediente', ['expediente', 'fecha'])
export class Actuacion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Expediente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_actuacion_expediente' })
  expediente: Relation<Expediente>;

  @Column({ type: 'enum', enum: Oficina, enumName: 'exp_oficina' })
  oficina: Oficina;

  /** Etapa del circuito en la que se hizo (sirve, por ejemplo, para saber a dónde reenviar una observación). */
  @Column({ type: 'enum', enum: Etapa, enumName: 'exp_etapa' })
  etapa: Etapa;

  @Column({ type: 'enum', enum: TipoActuacion, enumName: 'exp_tipo_actuacion' })
  tipo: TipoActuacion;

  @Column({ type: 'enum', enum: ResultadoActuacion, enumName: 'exp_resultado_actuacion' })
  resultado: ResultadoActuacion;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** Datos propios de cada actuación (número de resolución, padrón, deudas detectadas…). */
  @Column({ type: 'jsonb', nullable: true })
  datos: Record<string, unknown> | null;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_actuacion_usuario' })
  usuario: Relation<Usuario>;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;
}
