import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { hoyISO } from '../../comun/validadores/fechas.js';
import { EstadoConcesion } from '../../concesiones/concesiones.constantes.js';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { Titular } from '../../concesiones/entities/titular.entity.js';
import { Actuacion } from '../../expedientes/entities/actuacion.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import {
  Dictamen,
  EstadoExpediente,
  Etapa,
  formatearNumeroExpediente,
  NOMBRE_ETAPA,
  NOMBRE_OFICINA,
  Oficina,
  ResultadoActuacion,
  TipoActuacion,
  TipoTramite,
} from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { nombrePersona } from '../../personas/entities/persona.entity.js';
import { BajaPozo } from '../../pozos/entities/baja-pozo.entity.js';
import { Pozo } from '../../pozos/entities/pozo.entity.js';
import { BAJAS_ABIERTAS, DOCUMENTOS_BAJA, EstadoBaja, EstadoPozo, OrigenBaja } from '../../pozos/pozos.constantes.js';
import { PozosService, type FichaPozo } from '../../pozos/pozos.service.js';
import { RecaudacionService } from '../../recaudacion/recaudacion.service.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { nombreUsuario } from '../../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { ObservacionesDto } from '../circuito/dto/circuito.dto.js';
import type {
  BajaDeOficioDto,
  ClausuraDto,
  DatosBajaDto,
  DictamenJuridicoDto,
  DocumentacionDto,
  EvaluacionTecnicaDto,
  IniciarBajaPozoDto,
  ResolucionBajaDto,
} from './dto/baja-pozo.dto.js';

/** Estados del pozo que ya no admiten una baja. */
const SIN_BAJA = [EstadoPozo.BAJA, EstadoPozo.ANULADO];

/** Deuda pendiente de un titular por la tasa de uso del agua (para los antecedentes y Jurídico). */
interface DeudaTasa {
  persona: string;
  detalle: string;
  monto: number | null;
}

export interface RespuestaBaja {
  expediente: Awaited<ReturnType<ExpedientesService['resumen']>>;
  baja: {
    id: string;
    origen: OrigenBaja;
    estado: EstadoBaja;
    motivo: string;
    solicitanteNombre: string | null;
    solicitanteDocumento: string | null;
    /** Checklist: cada documento de la lista, si se presentó y si es obligatorio. */
    documentacion: { codigo: string; descripcion: string; obligatorio: boolean; presentado: boolean }[];
    inspeccionRealizada: boolean | null;
    fechaInspeccion: string | null;
    observacionesInspeccion: string | null;
    informeTecnico: string | null;
    requiereClausura: boolean | null;
    anularConcesion: boolean | null;
    estadoPozoAnterior: EstadoPozo;
    /** Número de la concesión que abastecía el pozo al iniciar la baja. */
    concesionAnterior: string | null;
    resolucion: string | null;
    fechaBaja: string | null;
    clausura: { fecha: string; acta: string; observaciones: string | null } | null;
    avisoDistrito: { enviado: Date; visto: Date | null } | null;
    creadoEn: Date;
  };
  pozo: FichaPozo;
  /** Deudas pendientes de los titulares de la concesión (tasa de uso del agua). */
  deudasTasa: DeudaTasa[];
}

/**
 * Baja de Pozo. La baja es LÓGICA: el pozo queda en estado BAJA y se conserva todo su
 * registro técnico. Hay dos formas:
 *
 * DE OFICIO (darDeBajaDeOficio): la DRH ya sabe que el pozo no existe o no funciona. Pozos lo
 * da de baja en el acto: sin expediente, sin circuito, sin resolución y sin clausura.
 *
 * A SOLICITUD del titular, con expediente:
 *   Pozos      1. documentación (mesa de entrada): COMPLETA ► antecedentes | PENDIENTE ► en espera
 *              2. antecedentes verificados ► evaluación técnica
 *              3. evaluación técnica: FAVORABLE ► Jurídico | REQUIERE_SUBSANACION ► en espera
 *   Jurídico   dictamen (y si se anula la concesión): APTO ► Secretaría | OBSERVADO ► Pozos corrige y
 *              reenvía | NO_APTO ► RECHAZADO
 *   Secretaría resolución: RECHAZAR ► RECHAZADO | APROBAR ► pozo en BAJA (+ concesión ANULADA si se
 *              decidió) y aviso a Distrito ► clausura física (si corresponde) o FINALIZADO
 *   Pozos      clausura física: acta ► FINALIZADO
 *   Distrito   solo TOMA CONOCIMIENTO de las bajas aprobadas: no dictamina ni frena el trámite.
 *
 * Mismas reglas que el resto de los circuitos: cada acción en su etapa, la oficina tiene
 * que TOMAR el expediente antes de actuar, y todo queda en el historial.
 */
@Injectable()
export class BajaPozoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly usuarios: UsuariosService,
    private readonly pozos: PozosService,
    private readonly recaudacion: RecaudacionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Documentación que se presenta para la baja (lista provisoria, ver DOCUMENTOS_BAJA). */
  documentos() {
    return DOCUMENTOS_BAJA;
  }

  /** Bajas sin terminar (o todas, con `todas`), de la más nueva a la más vieja. */
  async listar(todas = false) {
    const bajas = await this.dataSource.manager.find(BajaPozo, {
      where: todas ? {} : { estado: In([...BAJAS_ABIERTAS, EstadoBaja.CLAUSURA_PENDIENTE]) },
      relations: { expediente: true },
      order: { creadoEn: 'DESC' },
      take: 200,
    });
    // Las de oficio no tienen expediente: sus datos de expediente van en null.
    return bajas.map((b) => {
      const e = b.expediente;
      return {
        expedienteId: e?.id ?? null,
        expediente: e ? formatearNumeroExpediente(e.numero, e.reparticion, e.anio) : null,
        pozo: { id: b.pozo.id, idInterno: b.pozo.idInterno, alias: b.pozo.alias },
        origen: b.origen,
        estado: b.estado,
        etapa: e?.etapa ?? null,
        etapaNombre: e ? NOMBRE_ETAPA[e.etapa] : null,
        oficina: e?.oficinaActual ?? null,
        oficinaNombre: e ? NOMBRE_OFICINA[e.oficinaActual] : null,
        tomadoPor: e?.tomadoPor ? nombreUsuario(e.tomadoPor) : null,
        solicitante: b.solicitanteNombre,
        iniciada: b.creadoEn,
        fechaBaja: b.fechaBaja,
      };
    });
  }

  /** La baja completa: dónde está, sus datos, la ficha del pozo y la deuda de la tasa. */
  async obtener(expedienteId: string): Promise<RespuestaBaja> {
    const tx = this.dataSource.manager;
    const baja = await tx.findOne(BajaPozo, { where: { expediente: { id: expedienteId } } });
    if (!baja) throw new NotFoundException('No se encontró la baja de pozo.');
    const [expediente, pozo, deudasTasa, concesionAnterior] = await Promise.all([
      this.expedientes.resumen(expedienteId),
      this.pozos.obtener(baja.pozo.id),
      this.deudasDeLaConcesion(tx, baja.concesionAnteriorId),
      baja.concesionAnteriorId ? tx.findOneBy(Concesion, { id: baja.concesionAnteriorId }) : null,
    ]);
    const presentados = new Set(baja.documentacionPresentada);
    return {
      expediente,
      baja: {
        id: baja.id,
        origen: baja.origen,
        estado: baja.estado,
        motivo: baja.motivo,
        solicitanteNombre: baja.solicitanteNombre,
        solicitanteDocumento: baja.solicitanteDocumento,
        documentacion: DOCUMENTOS_BAJA.map((d) => ({ ...d, presentado: presentados.has(d.codigo) })),
        inspeccionRealizada: baja.inspeccionRealizada,
        fechaInspeccion: baja.fechaInspeccion,
        observacionesInspeccion: baja.observacionesInspeccion,
        informeTecnico: baja.informeTecnico,
        requiereClausura: baja.requiereClausura,
        anularConcesion: baja.anularConcesion,
        estadoPozoAnterior: baja.estadoPozoAnterior,
        concesionAnterior: concesionAnterior?.numero ?? null,
        resolucion: baja.resolucion && `${baja.resolucion.numero}/${baja.resolucion.anio}`,
        fechaBaja: baja.fechaBaja,
        clausura: baja.clausuraFecha ? { fecha: baja.clausuraFecha, acta: baja.clausuraActa!, observaciones: baja.clausuraObservaciones } : null,
        avisoDistrito: baja.avisoDistritoEn ? { enviado: baja.avisoDistritoEn, visto: baja.distritoVistoEn } : null,
        creadoEn: baja.creadoEn,
      },
      pozo,
      deudasTasa,
    };
  }

  // ---------------------------------------------------------------------------
  // Pozos: mesa de entrada
  // ---------------------------------------------------------------------------

  /**
   * Baja A SOLICITUD: Pozos (mesa de entrada) registra el expediente en papel.
   *   1. Lo inicia un usuario de Pozos, con un expediente del año en curso y el solicitante.
   *   2. El pozo existe, no está dado de baja ni anulado, y no tiene otra baja abierta.
   *   3. Expediente (queda en Pozos, tomado por quien lo registra) + la baja con el checklist.
   */
  async iniciar(dto: IniciarBajaPozoDto, usuarioId: string): Promise<RespuestaBaja> {
    const usuario = await this.exigirDePozos(usuarioId, 'iniciar la baja de un pozo');
    if (dto.expediente.anio !== new Date().getFullYear()) throw new BadRequestException('El expediente tiene que ser del año en curso.');

    const expedienteId = await this.dataSource.transaction(async (tx) => {
      const pozo = await this.pozoParaBaja(tx, dto.pozoId);
      const expediente = await this.expedientes.abrir(tx, {
        ...dto.expediente,
        tipoTramite: TipoTramite.BAJA_POZO,
        etapa: Etapa.INICIO_POZOS,
        asunto: `Baja del pozo ${pozo.idInterno}${pozo.alias ? ` (${pozo.alias})` : ''}`,
        solicitanteNombre: dto.solicitanteNombre,
        solicitanteDocumento: dto.solicitanteDocumento ?? null,
        usuario,
      });
      try {
        await tx.save(
          tx.create(BajaPozo, {
            pozo,
            expediente,
            origen: OrigenBaja.A_SOLICITUD,
            ...datosSolicitud(dto),
            estadoPozoAnterior: pozo.estado,
            concesionAnteriorId: pozo.concesion?.id ?? null,
            creadoUsuarioId: usuario.id,
          }),
        );
      } catch (error) {
        if (esViolacionDeUnicidad(error, 'uk_baja_pozo_sin_resolver')) throw new ConflictException(`El pozo ${pozo.idInterno} ya tiene una baja en trámite.`);
        throw error;
      }
      return expediente.id;
    });
    return this.obtener(expedienteId);
  }

  /** Pozos corrige los datos de la solicitud (en la mesa de entrada o al corregir observaciones). */
  async actualizar(expedienteId: string, dto: DatosBajaDto, usuarioId: string): Promise<RespuestaBaja> {
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      await this.expedientes.exigirParaActuar(expediente, [Etapa.INICIO_POZOS, Etapa.CORRECCION_POZOS], usuarioId, [
        EstadoExpediente.EN_TRAMITE,
        EstadoExpediente.EN_ESPERA,
        EstadoExpediente.OBSERVADO,
      ]);
      const baja = await this.bajaDe(tx, expedienteId);
      await tx.update(BajaPozo, baja.id, datosSolicitud(dto));
      await tx.update(Expediente, expediente.id, { solicitanteNombre: dto.solicitanteNombre, solicitanteDocumento: dto.solicitanteDocumento ?? null });
    });
    return this.obtener(expedienteId);
  }

  /**
   * Mesa de entrada: control de la documentación.
   *   COMPLETA   todos los obligatorios presentados → pasa a la verificación de antecedentes
   *              (si estaba en espera, se reanuda).
   *   PENDIENTE  falta documentación → el expediente queda EN ESPERA hasta que se complete.
   */
  async controlarDocumentacion(expedienteId: string, dto: DocumentacionDto, usuarioId: string): Promise<RespuestaBaja> {
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.INICIO_POZOS], usuarioId, [EstadoExpediente.EN_TRAMITE, EstadoExpediente.EN_ESPERA]);
      const baja = await this.bajaDe(tx, expedienteId);
      const faltan = DOCUMENTOS_BAJA.filter((d) => d.obligatorio && !baja.documentacionPresentada.includes(d.codigo)).map((d) => d.descripcion);

      if (dto.resultado === 'COMPLETA') {
        if (faltan.length) throw new BadRequestException(`Falta documentación obligatoria: ${faltan.join('; ')}.`);
        await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.DOCUMENTACION, resultado: ResultadoActuacion.APTO, usuario, observaciones: dto.observaciones });
        await this.reanudar(tx, expediente, baja, usuario);
        await this.expedientes.cambiarEtapa(tx, expediente, Etapa.ANTECEDENTES_POZOS, usuario);
        return;
      }
      const detalle = dto.observaciones ?? (faltan.length ? `Falta: ${faltan.join('; ')}.` : null);
      if (!detalle) throw new BadRequestException('Indique qué documentación falta.');
      await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.DOCUMENTACION, resultado: ResultadoActuacion.OBSERVADO, usuario, observaciones: detalle, datos: { faltan } });
      await this.pausar(tx, expediente, baja, usuario);
    });
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Pozos: antecedentes y evaluación técnica
  // ---------------------------------------------------------------------------

  /** Pozos revisó los antecedentes del pozo (lo que la DRH ya tiene) → evaluación técnica. */
  async verificarAntecedentes(expedienteId: string, dto: ObservacionesDto, usuarioId: string): Promise<RespuestaBaja> {
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.ANTECEDENTES_POZOS], usuarioId);
      const baja = await this.bajaDe(tx, expedienteId);
      const deudas = await this.deudasDeLaConcesion(tx, baja.concesionAnteriorId);
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.ANTECEDENTES,
        resultado: ResultadoActuacion.APTO,
        usuario,
        observaciones: dto.observaciones,
        datos: { deudasTasaPendientes: deudas.length },
      });
      await this.expedientes.cambiarEtapa(tx, expediente, Etapa.EVALUACION_TECNICA_POZOS, usuario);
    });
    return this.obtener(expedienteId);
  }

  /**
   * Evaluación técnica (Pozos): inspección, informe y si corresponde la clausura física.
   *   FAVORABLE             pasa a Jurídico (si estaba en espera, se reanuda).
   *   REQUIERE_SUBSANACION  el expediente queda EN ESPERA hasta que se subsane; después se
   *                         vuelve a evaluar.
   */
  async evaluarTecnicamente(expedienteId: string, dto: EvaluacionTecnicaDto, usuarioId: string): Promise<RespuestaBaja> {
    if (dto.inspeccionRealizada && !dto.fechaInspeccion) throw new BadRequestException('Ingrese la fecha de la inspección.');
    if (dto.resultado === 'FAVORABLE' && dto.requiereClausura === undefined) throw new BadRequestException('Indique si corresponde la clausura física de la perforación.');

    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.EVALUACION_TECNICA_POZOS], usuarioId, [EstadoExpediente.EN_TRAMITE, EstadoExpediente.EN_ESPERA]);
      const baja = await this.bajaDe(tx, expedienteId);
      await tx.update(BajaPozo, baja.id, {
        inspeccionRealizada: dto.inspeccionRealizada,
        fechaInspeccion: dto.inspeccionRealizada ? dto.fechaInspeccion! : null,
        observacionesInspeccion: dto.observacionesInspeccion ?? null,
        informeTecnico: dto.informeTecnico,
        requiereClausura: dto.requiereClausura ?? null,
      });
      const favorable = dto.resultado === 'FAVORABLE';
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.EVALUACION_TECNICA,
        resultado: favorable ? ResultadoActuacion.APTO : ResultadoActuacion.OBSERVADO,
        usuario,
        observaciones: dto.informeTecnico,
        datos: { inspeccion: dto.inspeccionRealizada, fechaInspeccion: dto.fechaInspeccion ?? null, requiereClausura: dto.requiereClausura ?? null },
      });
      if (!favorable) return this.pausar(tx, expediente, baja, usuario);
      await this.reanudar(tx, expediente, baja, usuario);
      await this.expedientes.pasar(tx, expediente, { etapa: Etapa.JURIDICO, usuario, dictamen: Dictamen.APTO, observaciones: 'Evaluación técnica favorable.' });
    });
    return this.obtener(expedienteId);
  }

  /** Pozos corrigió lo que observó Jurídico y se lo reenvía. */
  async reenviar(expedienteId: string, dto: ObservacionesDto, usuarioId: string): Promise<RespuestaBaja> {
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.CORRECCION_POZOS], usuarioId, [EstadoExpediente.OBSERVADO]);
      const observacion = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.DICTAMEN_JURIDICO], ResultadoActuacion.OBSERVADO);
      if (!observacion) throw new ConflictException('No se encontró la observación que originó la corrección.');

      await this.expedientes.actuar(tx, expediente, { tipo: TipoActuacion.CORRECCION, resultado: ResultadoActuacion.APTO, usuario, observaciones: dto.observaciones, datos: { respondeA: observacion.id } });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_TRAMITE, usuario);
      await tx.update(BajaPozo, { expediente: { id: expediente.id } }, { estado: EstadoBaja.EN_TRAMITE });
      await this.expedientes.pasar(tx, expediente, { etapa: observacion.etapa, usuario, dictamen: Dictamen.APTO, observaciones: dto.observaciones ?? 'Observaciones corregidas.' });
    });
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Jurídico
  // ---------------------------------------------------------------------------

  /**
   * Jurídico revisa los aspectos legales y, si el pozo abastece una concesión, decide si se
   * anula también (con la documentación y la tasa a la vista):
   *   APTO       pasa a Secretaría General.
   *   OBSERVADO  vuelve a Pozos para corregir (motivo obligatorio); después se reenvía acá.
   *   NO_APTO    el trámite termina: RECHAZADO; el pozo sigue como estaba.
   */
  async dictaminarJuridico(expedienteId: string, dto: DictamenJuridicoDto, usuarioId: string): Promise<RespuestaBaja> {
    if (dto.resultado !== 'APTO' && !dto.observaciones) {
      throw new BadRequestException(dto.resultado === 'OBSERVADO' ? 'Indique qué hay que corregir.' : 'Indique el motivo por el que no es apto.');
    }
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.JURIDICO], usuarioId);
      const baja = await this.bajaDe(tx, expedienteId);
      const tieneConcesion = !!baja.concesionAnteriorId;
      if (dto.resultado === 'APTO' && tieneConcesion && dto.anularConcesion === undefined) {
        throw new BadRequestException('El pozo abastece una concesión: indique si se anula también la concesión.');
      }
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.DICTAMEN_JURIDICO,
        resultado: ResultadoActuacion[dto.resultado],
        usuario,
        observaciones: dto.observaciones,
        datos: tieneConcesion && dto.resultado === 'APTO' ? { anularConcesion: dto.anularConcesion } : null,
      });

      if (dto.resultado === 'APTO') {
        await tx.update(BajaPozo, baja.id, { anularConcesion: tieneConcesion ? dto.anularConcesion! : null });
        await this.expedientes.pasar(tx, expediente, { etapa: Etapa.SECRETARIA_GENERAL, usuario, dictamen: Dictamen.APTO, observaciones: dto.observaciones });
      } else if (dto.resultado === 'OBSERVADO') {
        await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.OBSERVADO, usuario);
        await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.OBSERVADA });
        await this.expedientes.pasar(tx, expediente, { etapa: Etapa.CORRECCION_POZOS, usuario, dictamen: Dictamen.OBSERVADO, observaciones: dto.observaciones, esDevolucion: true });
      } else {
        await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.RECHAZADA });
        await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.RECHAZADO, usuario, true);
      }
    });
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Secretaría General: resolución
  // ---------------------------------------------------------------------------

  /**
   * Secretaría dicta la resolución (acto administrativo):
   *   RECHAZAR  con el motivo → RECHAZADO; el pozo sigue como estaba.
   *   APROBAR   (con todos los vistos buenos en el historial):
   *             - el pozo pasa a BAJA y se desvincula de la concesión;
   *             - si Jurídico lo decidió, la concesión queda ANULADA;
   *             - se avisa a Distrito (toma conocimiento, sin frenar el trámite);
   *             - si corresponde clausura física, pasa a Pozos; si no, FINALIZADO.
   */
  async resolver(expedienteId: string, dto: ResolucionBajaDto, usuarioId: string): Promise<RespuestaBaja> {
    if (Number(dto.fecha.slice(0, 4)) !== dto.anio) throw new BadRequestException('La fecha de la resolución no coincide con el año.');
    if (dto.decision === 'RECHAZAR' && !dto.observaciones) throw new BadRequestException('Indique el motivo del rechazo.');

    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.SECRETARIA_GENERAL], usuarioId);
      const baja = await this.bajaDe(tx, expedienteId);
      const aprobar = dto.decision === 'APROBAR';
      if (aprobar) await this.exigirVistosBuenos(tx, expediente);

      let resolucion: Resolucion;
      try {
        resolucion = await tx.save(
          tx.create(Resolucion, { numero: String(Number(dto.numero)), anio: dto.anio, fecha: dto.fecha, expediente, observaciones: dto.observaciones ?? null, creadoPor: usuario }),
        );
      } catch (error) {
        if (esViolacionDeUnicidad(error, 'uk_resolucion')) throw new ConflictException(`La resolución ${Number(dto.numero)}/${dto.anio} ya está registrada.`);
        throw error;
      }
      const textoResolucion = `${resolucion.numero}/${resolucion.anio}`;

      if (!aprobar) {
        await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.RECHAZADA, resolucion: { id: resolucion.id } });
        await this.expedientes.actuar(tx, expediente, {
          tipo: TipoActuacion.RESOLUCION,
          resultado: ResultadoActuacion.NO_APTO,
          usuario,
          observaciones: dto.observaciones,
          datos: { resolucion: textoResolucion, fecha: dto.fecha, decision: 'RECHAZAR' },
        });
        await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.RECHAZADO, usuario, true);
        return;
      }

      // Pozo dado de baja; concesión anulada si se decidió.
      await tx.update(Pozo, baja.pozo.id, { estado: EstadoPozo.BAJA, concesion: null });
      const anula = !!baja.anularConcesion && !!baja.concesionAnteriorId;
      if (anula) await tx.update(Concesion, baja.concesionAnteriorId!, { estado: EstadoConcesion.ANULADA, modificadoUsuarioId: usuario.id });

      const clausura = !!baja.requiereClausura;
      await tx.update(BajaPozo, baja.id, {
        estado: clausura ? EstadoBaja.CLAUSURA_PENDIENTE : EstadoBaja.CONFIRMADA,
        resolucion: { id: resolucion.id },
        fechaBaja: dto.fecha,
        avisoDistritoEn: new Date(),
      });
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.RESOLUCION,
        resultado: ResultadoActuacion.APTO,
        usuario,
        observaciones: dto.observaciones,
        datos: { resolucion: textoResolucion, fecha: dto.fecha, decision: 'APROBAR', pozo: baja.pozo.idInterno, concesionAnulada: anula, requiereClausura: clausura },
      });
      if (clausura) {
        await this.expedientes.pasar(tx, expediente, {
          etapa: Etapa.CLAUSURA_POZOS,
          usuario,
          dictamen: Dictamen.APTO,
          observaciones: `Resolución ${textoResolucion}: baja aprobada. Falta registrar la clausura física.`,
        });
      } else {
        await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.FINALIZADO, usuario, true);
      }
    });
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Pozos: clausura física
  // ---------------------------------------------------------------------------

  /** Pozos registra la clausura física (acta) y el trámite FINALIZA. */
  async registrarClausura(expedienteId: string, dto: ClausuraDto, usuarioId: string): Promise<RespuestaBaja> {
    if (dto.fecha > hoyISO()) throw new BadRequestException('La fecha de la clausura no puede ser futura.');
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.BAJA_POZO);
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.CLAUSURA_POZOS], usuarioId);
      const baja = await this.bajaDe(tx, expedienteId);
      await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.CONFIRMADA, clausuraFecha: dto.fecha, clausuraActa: dto.acta, clausuraObservaciones: dto.observaciones ?? null });
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.CLAUSURA,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: dto.observaciones,
        datos: { acta: dto.acta, fecha: dto.fecha },
      });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.FINALIZADO, usuario, true);
    });
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Baja de oficio
  // ---------------------------------------------------------------------------

  /**
   * Baja DE OFICIO: la DRH ya sabe que el pozo no existe o no funciona. Un usuario de Pozos
   * lo da de baja en el acto, sin expediente, circuito ni clausura:
   *   1. El pozo existe, no está dado de baja ni anulado, y no tiene una baja a solicitud abierta.
   *   2. Baja CONFIRMADA con la fecha de hoy, el motivo y la inspección (si la hubo).
   *   3. Pozo en BAJA y desvinculado de la concesión (la baja guarda cuál era). Aviso a Distrito.
   * Devuelve la ficha del pozo actualizada.
   */
  async darDeBajaDeOficio(pozoId: string, dto: BajaDeOficioDto, usuarioId: string): Promise<FichaPozo> {
    const usuario = await this.exigirDePozos(usuarioId, 'dar de baja un pozo de oficio');
    await this.dataSource.transaction(async (tx) => {
      const pozo = await this.pozoParaBaja(tx, pozoId);
      await tx.save(
        tx.create(BajaPozo, {
          pozo,
          expediente: null,
          origen: OrigenBaja.DE_OFICIO,
          estado: EstadoBaja.CONFIRMADA,
          motivo: dto.motivo,
          documentacionPresentada: [],
          inspeccionRealizada: dto.fechaInspeccion ? true : null,
          fechaInspeccion: dto.fechaInspeccion ?? null,
          observacionesInspeccion: dto.observacionesInspeccion ?? null,
          requiereClausura: false,
          estadoPozoAnterior: pozo.estado,
          concesionAnteriorId: pozo.concesion?.id ?? null,
          fechaBaja: hoyISO(),
          avisoDistritoEn: new Date(),
          creadoUsuarioId: usuario.id,
        }),
      );
      await tx.update(Pozo, pozo.id, { estado: EstadoPozo.BAJA, concesion: null });
    });
    return this.pozos.obtener(pozoId);
  }

  // ---------------------------------------------------------------------------
  // Distrito: toma de conocimiento
  // ---------------------------------------------------------------------------

  /**
   * Bajas aprobadas (a solicitud o de oficio) de las que Distrito tiene que tomar conocimiento.
   * Con `todos`, también las ya vistas (las últimas 100).
   */
  async avisosDistrito(todos = false) {
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT b.id, b.origen::text AS origen, b.fecha_baja, b.motivo, b.aviso_distrito_en, b.distrito_visto_en,
              b.anular_concesion, b.requiere_clausura, b.estado::text AS estado,
              p.id AS pozo_id, p.id_interno, p.alias,
              c.numero AS concesion, i.distrito, i.departamento, i.localidad,
              e.id AS expediente_id, e.numero || '/' || e.reparticion || '-' || e.anio AS expediente,
              r.numero || '/' || r.anio AS resolucion,
              u.apellido || ', ' || u.nombre AS visto_por
         FROM poz_baja b
         JOIN poz_pozo p ON p.id = b.pozo_id
         LEFT JOIN con_concesion c ON c.id = b.concesion_anterior_id
         LEFT JOIN con_v_inmueble i ON i.concesion_id = c.id
         LEFT JOIN exp_expediente e ON e.id = b.expediente_id
         LEFT JOIN exp_resolucion r ON r.id = b.resolucion_id
         LEFT JOIN seg_usuario u ON u.id = b.distrito_visto_por_usuario_id
        WHERE b.aviso_distrito_en IS NOT NULL AND ($1 OR b.distrito_visto_en IS NULL)
        ORDER BY b.distrito_visto_en IS NULL DESC, b.aviso_distrito_en DESC
        LIMIT 100`,
      [todos],
    );
    return filas.map((f) => ({
      bajaId: String(f.id),
      origen: f.origen as OrigenBaja,
      estado: f.estado as EstadoBaja,
      fechaBaja: f.fecha_baja as string | null,
      motivo: f.motivo as string,
      pozo: { id: String(f.pozo_id), idInterno: f.id_interno as string, alias: f.alias as string | null },
      concesion: f.concesion as string | null,
      concesionAnulada: !!f.anular_concesion,
      requiereClausura: !!f.requiere_clausura,
      ubicacion: { distrito: f.distrito as string | null, departamento: f.departamento as string | null, localidad: f.localidad as string | null },
      expedienteId: f.expediente_id ? String(f.expediente_id) : null,
      expediente: f.expediente as string | null,
      resolucion: f.resolucion as string | null,
      avisado: f.aviso_distrito_en as Date,
      visto: f.distrito_visto_en ? { en: f.distrito_visto_en as Date, por: f.visto_por as string } : null,
    }));
  }

  /**
   * Distrito toma conocimiento de una baja: queda registrado quién y cuándo (y, si tiene
   * expediente, en su historial). No dictamina ni cambia nada del trámite.
   */
  async tomarConocimiento(bajaId: string, usuarioId: string) {
    let usuario: Usuario;
    try {
      usuario = await this.usuarios.exigirDeOficina(usuarioId, Oficina.DISTRITO);
    } catch (error) {
      if (error instanceof ForbiddenException) throw new ForbiddenException('Solo un usuario de Distrito puede tomar conocimiento de la baja.');
      throw error;
    }
    await this.dataSource.transaction(async (tx) => {
      const baja = await tx.findOne(BajaPozo, { where: { id: bajaId }, relations: { expediente: true }, lock: { mode: 'pessimistic_write', tables: ['poz_baja'] } });
      if (!baja?.avisoDistritoEn) throw new NotFoundException('No hay un aviso de baja con ese número.');
      if (baja.distritoVistoEn) return; // ya lo vio alguien de Distrito
      await tx.update(BajaPozo, baja.id, { distritoVistoEn: new Date(), distritoVistoPorUsuarioId: usuario.id });
      if (baja.expediente) {
        await this.expedientes.actuar(tx, baja.expediente, {
          oficina: Oficina.DISTRITO,
          tipo: TipoActuacion.TOMA_CONOCIMIENTO,
          resultado: ResultadoActuacion.REGISTRADO,
          usuario,
          observaciones: `Distrito tomó conocimiento de la baja del pozo ${baja.pozo.idInterno}.`,
        });
      }
    });
    return { bajaId, visto: true };
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  /** Pausa el trámite (falta documentación o hay que subsanar): sigue en Pozos, tomado. */
  private async pausar(tx: EntityManager, expediente: Expediente, baja: BajaPozo, usuario: Usuario) {
    await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_ESPERA, usuario);
    await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.EN_ESPERA });
  }

  /** Si estaba en espera, lo reanuda. */
  private async reanudar(tx: EntityManager, expediente: Expediente, baja: BajaPozo, usuario: Usuario) {
    if (expediente.estado !== EstadoExpediente.EN_ESPERA) return;
    await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_TRAMITE, usuario);
    await tx.update(BajaPozo, baja.id, { estado: EstadoBaja.EN_TRAMITE });
  }

  /** Deudas pendientes de los titulares vigentes de una concesión (tasa de uso del agua). */
  private async deudasDeLaConcesion(tx: EntityManager, concesionId: string | null): Promise<DeudaTasa[]> {
    if (!concesionId) return [];
    const titulares = await tx.find(Titular, { where: { concesion: { id: concesionId }, vigente: true } });
    const deudas = await this.recaudacion.pendientesDe(
      tx,
      titulares.map((t) => t.persona.id),
    );
    return deudas.map((d) => ({ persona: nombrePersona(d.persona), detalle: d.detalle, monto: d.monto === null ? null : Number(d.monto) }));
  }

  /**
   * El pozo que se va a dar de baja, bloqueado (FOR UPDATE: dos bajas simultáneas del mismo
   * pozo no pueden pasar las dos). Tiene que existir, no estar dado de baja ni anulado, y no
   * tener otra baja abierta.
   */
  private async pozoParaBaja(tx: EntityManager, pozoId: string): Promise<Pozo> {
    const pozo = await tx.findOne(Pozo, { where: { id: pozoId }, relations: { concesion: true }, lock: { mode: 'pessimistic_write', tables: ['poz_pozo'] } });
    if (!pozo) throw new NotFoundException('El pozo no existe en el sistema.');
    if (SIN_BAJA.includes(pozo.estado)) throw new ConflictException(`El pozo ${pozo.idInterno} ya está ${pozo.estado === EstadoPozo.BAJA ? 'dado de baja' : 'anulado'}.`);
    const abierta = await tx.findOne(BajaPozo, { where: { pozo: { id: pozo.id }, estado: In(BAJAS_ABIERTAS) }, relations: { expediente: true } });
    if (abierta?.expediente) {
      const e = abierta.expediente;
      throw new ConflictException(`El pozo ${pozo.idInterno} ya tiene una baja en trámite (expediente ${formatearNumeroExpediente(e.numero, e.reparticion, e.anio)}).`);
    }
    return pozo;
  }

  /** Usuario de Pozos (o administrador). El mensaje dice qué se intentó, no «el expediente está en…». */
  private async exigirDePozos(usuarioId: string, accion: string) {
    try {
      return await this.usuarios.exigirDeOficina(usuarioId, Oficina.POZOS);
    } catch (error) {
      if (error instanceof ForbiddenException) throw new ForbiddenException(`Solo un usuario de Pozos puede ${accion}.`);
      throw error;
    }
  }

  private async bajaDe(tx: EntityManager, expedienteId: string): Promise<BajaPozo> {
    const baja = await tx.findOne(BajaPozo, { where: { expediente: { id: expedienteId } } });
    if (!baja) throw new NotFoundException('No se encontró la baja de pozo.');
    return baja;
  }

  /**
   * Defensa en profundidad: antes de aprobar, la última actuación de cada paso tiene que ser
   * favorable (documentación, antecedentes, evaluación técnica y Jurídico).
   */
  private async exigirVistosBuenos(tx: EntityManager, expediente: Expediente): Promise<void> {
    const pasos: [TipoActuacion, string][] = [
      [TipoActuacion.DOCUMENTACION, 'documentación completa'],
      [TipoActuacion.ANTECEDENTES, 'antecedentes verificados'],
      [TipoActuacion.EVALUACION_TECNICA, 'evaluación técnica favorable'],
      [TipoActuacion.DICTAMEN_JURIDICO, 'dictamen jurídico apto'],
    ];
    const faltan: string[] = [];
    for (const [tipo, nombre] of pasos) {
      const ultima = await tx.findOne(Actuacion, { where: { expediente: { id: expediente.id }, tipo }, order: { fecha: 'DESC', id: 'DESC' } });
      if (ultima?.resultado !== ResultadoActuacion.APTO) faltan.push(nombre);
    }
    if (faltan.length) throw new ConflictException(`No se puede aprobar la baja: falta ${faltan.join(', ')}.`);
  }
}

/** Columnas de la solicitud que vienen del formulario de mesa de entrada. */
function datosSolicitud(dto: DatosBajaDto) {
  return {
    motivo: dto.motivo,
    solicitanteNombre: dto.solicitanteNombre,
    solicitanteDocumento: dto.solicitanteDocumento ?? null,
    documentacionPresentada: dto.documentacionPresentada,
  };
}
