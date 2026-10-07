import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import { EstadoBaja, EstadoPozo, OrigenBaja } from '../pozos.constantes.js';
import { Pozo } from './pozo.entity.js';

/**
 * Trámite de baja de un pozo (poz_baja), según Documentacion/esquema_drh.sql.
 *
 * La baja es LÓGICA: al confirmarse, el pozo pasa a estado BAJA pero se conserva todo su
 * registro técnico (lo piden los estudios hidrogeológicos). Se guarda acá el estado y la
 * concesión que tenía el pozo antes de la baja, para que el historial no se pierda.
 *
 * Dos formas (origen):
 *   A_SOLICITUD  con expediente: Pozos (documentación, antecedentes, evaluación técnica) →
 *                Jurídico (y si se anula la concesión) → Secretaría General (resolución) →
 *                Pozos (clausura física, si corresponde). Distrito solo toma conocimiento.
 *   DE_OFICIO    la DRH ya sabe que el pozo no existe o no funciona: Pozos lo da de baja en
 *                el acto, sin expediente ni circuito (nace CONFIRMADA).
 *
 * Diferencias con el esquema MySQL: el circuito que pidió la oficina es el de arriba, en vez
 * de Planificación Hidrológica → Catastro; y expediente_id admite NULL (baja de oficio).
 */
@Entity('poz_baja')
// Un pozo tiene a lo sumo UNA baja abierta (las rechazadas no bloquean otra nueva).
// (El nombre cambió al sumar EN_ESPERA: synchronize no actualiza la condición de un índice existente.)
@Index('uk_baja_pozo_sin_resolver', ['pozo'], { unique: true, where: `estado IN ('EN_TRAMITE', 'EN_ESPERA', 'OBSERVADA')` })
@Check('chk_baja_motivo', 'char_length(motivo) >= 10')
@Check('chk_baja_solicitante', `origen = 'DE_OFICIO' OR solicitante_nombre IS NOT NULL`)
// A solicitud siempre tiene expediente; de oficio, nunca.
@Check('chk_baja_expediente', `(origen = 'A_SOLICITUD') = (expediente_id IS NOT NULL)`)
export class BajaPozo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Pozo, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'pozo_id', foreignKeyConstraintName: 'fk_baja_pozo' })
  pozo: Relation<Pozo>;

  @Index('uk_baja_expediente', { unique: true })
  @OneToOne(() => Expediente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expediente_id', foreignKeyConstraintName: 'fk_baja_expediente' })
  expediente: Relation<Expediente> | null;

  @Column({ type: 'enum', enum: OrigenBaja, enumName: 'poz_origen_baja' })
  origen: OrigenBaja;

  @Index('idx_baja_estado')
  @Column({ type: 'enum', enum: EstadoBaja, enumName: 'poz_estado_baja', default: EstadoBaja.EN_TRAMITE })
  estado: EstadoBaja;

  /** Por qué se da de baja (pozo cegado, seco, inexistente, reemplazado…). */
  @Column({ type: 'text' })
  motivo: string;

  // --- Solicitante (solo A_SOLICITUD) ---

  @Column({ name: 'solicitante_nombre', type: 'varchar', length: 200, nullable: true })
  solicitanteNombre: string | null;

  @Column({ name: 'solicitante_documento', type: 'varchar', length: 20, nullable: true })
  solicitanteDocumento: string | null;

  /** Códigos de DOCUMENTOS_BAJA que trae el expediente (solo a solicitud). */
  @Column({ name: 'documentacion_presentada', type: 'text', array: true, default: () => "'{}'" })
  documentacionPresentada: string[];

  // --- Evaluación técnica (Pozos) ---

  /** NULL mientras no se evaluó; true si se hizo inspección de campo. */
  @Column({ name: 'inspeccion_realizada', type: 'boolean', nullable: true })
  inspeccionRealizada: boolean | null;

  @Column({ name: 'fecha_inspeccion', type: 'date', nullable: true })
  fechaInspeccion: string | null;

  @Column({ name: 'observaciones_inspeccion', type: 'text', nullable: true })
  observacionesInspeccion: string | null;

  @Column({ name: 'informe_tecnico', type: 'text', nullable: true })
  informeTecnico: string | null;

  /** Si la perforación tiene que clausurarse (sellarse) físicamente. Lo determina el área técnica. */
  @Column({ name: 'requiere_clausura', type: 'boolean', nullable: true })
  requiereClausura: boolean | null;

  // --- Jurídico: la concesión ---

  /** Si se anula también la concesión que abastece el pozo (NULL si no tiene o no se decidió). */
  @Column({ name: 'anular_concesion', type: 'boolean', nullable: true })
  anularConcesion: boolean | null;

  // --- Clausura física (Pozos, después de la resolución) ---

  @Column({ name: 'clausura_fecha', type: 'date', nullable: true })
  clausuraFecha: string | null;

  @Column({ name: 'clausura_acta', type: 'varchar', length: 50, nullable: true })
  clausuraActa: string | null;

  @Column({ name: 'clausura_observaciones', type: 'text', nullable: true })
  clausuraObservaciones: string | null;

  // --- Aviso a Distrito (toma conocimiento; no dictamina) ---

  @Column({ name: 'aviso_distrito_en', type: 'timestamptz', nullable: true })
  avisoDistritoEn: Date | null;

  @Column({ name: 'distrito_visto_en', type: 'timestamptz', nullable: true })
  distritoVistoEn: Date | null;

  @Column({ name: 'distrito_visto_por_usuario_id', type: 'bigint', nullable: true })
  distritoVistoPorUsuarioId: string | null;

  // --- Cómo estaba el pozo al iniciar (para el historial) ---

  @Column({ name: 'estado_pozo_anterior', type: 'enum', enum: EstadoPozo, enumName: 'poz_estado_pozo' })
  estadoPozoAnterior: EstadoPozo;

  @Column({ name: 'concesion_anterior_id', type: 'bigint', nullable: true })
  concesionAnteriorId: string | null;

  // --- Resolución que confirma la baja ---

  @ManyToOne(() => Resolucion, { nullable: true, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'resolucion_id', foreignKeyConstraintName: 'fk_baja_resolucion' })
  resolucion: Relation<Resolucion> | null;

  @Column({ name: 'fecha_baja', type: 'date', nullable: true })
  fechaBaja: string | null;

  @Column({ name: 'creado_usuario_id', type: 'bigint' })
  creadoUsuarioId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'modificado_en', type: 'timestamptz' })
  modificadoEn: Date;
}
