import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { SituacionLegal } from '../../catalogos/entities/situacion-legal.entity.js';
import { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoConcesion, OrigenConcesion, TipoDerecho } from '../concesiones.constantes.js';
import { Condicion } from './condicion.entity.js';
import { Domicilio } from './domicilio.entity.js';
import { Inmueble } from './inmueble.entity.js';
import { Punto } from './punto.entity.js';
import { Suministro } from './suministro.entity.js';
import { Titular } from './titular.entity.js';
import { Uso } from './uso.entity.js';

/**
 * Concesión de uso de agua (con_concesion).
 *
 * Ciclo de vida en el alta:
 *   1. Catastro inicia el alta → se crea EN_TRAMITE, sin número.
 *   2. Se le cargan titulares, domicilios, inmueble, ubicación, usos y suministro.
 *   3. Circula por Recaudación → Distrito → Jurídico → Secretaría General.
 *   4. Catastro cierra: asigna el número definitivo y pasa a VIGENTE.
 *
 * Esta tabla guarda solo lo que identifica a la concesión y no cambia. Todo lo que un
 * trámite posterior puede modificar (titulares, domicilios, inmueble, condiciones, usos,
 * puntos, suministro, polígono) está en su propia tabla, con historial (FilaVersionada).
 */
@Entity('con_concesion')
@Index('idx_concesion_estado', ['estado'])
// Solo las concesiones importadas del padrón anterior pueden no tener expediente digital.
@Check('chk_concesion_expediente', "expediente_id IS NOT NULL OR origen = 'MIGRACION'")
export class Concesion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Número definitivo. NULL mientras está en trámite (lo asigna Catastro en el cierre). */
  @Index('uk_concesion_numero', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  /**
   * Expediente que la tramita (el alta). Los trámites posteriores tienen sus propios expedientes.
   * NULL solo en las migradas: el padrón anterior no registra el expediente digital.
   */
  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_concesion_expediente' })
  expediente: Relation<Expediente> | null;

  @Column({ type: 'enum', enum: OrigenConcesion, enumName: 'con_origen_concesion', default: OrigenConcesion.SISTEMA })
  origen: OrigenConcesion;

  /** Año de otorgamiento (el padrón anterior trae solo el año, no la fecha). */
  @Column({ name: 'anio_otorgamiento', type: 'smallint', nullable: true })
  anioOtorgamiento: number | null;

  /** Fecha de la resolución que la otorgó (las del sistema; las migradas tienen solo el año). */
  @Column({ name: 'fecha_otorgamiento', type: 'date', nullable: true })
  fechaOtorgamiento: string | null;

  /** Resolución de Secretaría General que la otorga. */
  @ManyToOne(() => Resolucion, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'resolucion_id', foreignKeyConstraintName: 'fk_concesion_resolucion' })
  resolucion: Relation<Resolucion> | null;

  @Column({ name: 'tipo_derecho', type: 'enum', enum: TipoDerecho, enumName: 'con_tipo_derecho', default: TipoDerecho.CONCESION })
  tipoDerecho: TipoDerecho;

  @Column({ type: 'enum', enum: EstadoConcesion, enumName: 'con_estado_concesion', default: EstadoConcesion.EN_TRAMITE })
  estado: EstadoConcesion;

  /** Obligatoria en el alta (paso 1); el padrón anterior no la registra, así que puede faltar en las migradas. */
  @ManyToOne(() => SituacionLegal, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'situacion_legal_codigo', foreignKeyConstraintName: 'fk_concesion_situacion' })
  situacionLegal: Relation<SituacionLegal> | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  // --- Autoría ---

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'modificado_usuario_id', type: 'bigint', nullable: true })
  modificadoUsuarioId: string | null;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;

  // --- Datos que cuelgan de la concesión, con historial (vigentes e históricos) ---
  // Para leer solo lo vigente: cargarDatosVigentes (concesiones/datos-vigentes.ts).

  @OneToMany(() => Titular, (t) => t.concesion)
  titulares: Relation<Titular[]>;

  @OneToMany(() => Domicilio, (d) => d.concesion)
  domicilios: Relation<Domicilio[]>;

  @OneToMany(() => Inmueble, (i) => i.concesion)
  inmuebles: Relation<Inmueble[]>;

  @OneToMany(() => Condicion, (c) => c.concesion)
  condiciones: Relation<Condicion[]>;

  @OneToMany(() => Uso, (u) => u.concesion)
  usos: Relation<Uso[]>;

  /** Desagüe y punto de entrega. */
  @OneToMany(() => Punto, (p) => p.concesion)
  puntos: Relation<Punto[]>;

  @OneToMany(() => Suministro, (s) => s.concesion)
  suministros: Relation<Suministro[]>;
}
