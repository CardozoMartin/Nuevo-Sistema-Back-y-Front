import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, IsNull, Not, type EntityManager } from 'typeorm';
import { esViolacionDeUnicidad } from '../comun/errores-db.js';
import { hoyISO } from '../comun/validadores/fechas.js';
import { nombreUsuario, type Usuario } from '../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../seguridad/usuarios.service.js';
import { Actuacion } from './entities/actuacion.entity.js';
import { AccionAuditoria, Auditoria } from './entities/auditoria.entity.js';
import { Expediente } from './entities/expediente.entity.js';
import { Movimiento } from './entities/movimiento.entity.js';
import type { BuscarExpedientesQuery } from './dto/buscar-expedientes.query.js';
import {
  Dictamen,
  ESTADOS_FINALES,
  EstadoExpediente,
  Etapa,
  formatearNumeroExpediente,
  NOMBRE_ETAPA,
  NOMBRE_OFICINA,
  NOMBRE_TIPO_TRAMITE,
  Oficina,
  OFICINA_DE_ETAPA,
  ResultadoActuacion,
  TipoActuacion,
  TipoTramite,
} from './expedientes.constantes.js';

export interface AbrirExpedienteInput {
  numero: string;
  reparticion: string;
  anio: number;
  tipoTramite: TipoTramite;
  asunto?: string;
  /** Quien lo registra: queda como creador y lo tiene tomado en la oficina de inicio. */
  usuario: Usuario;
  /** Etapa donde empieza (define la oficina). Por defecto, la carga en Catastro. */
  etapa?: Etapa;
  /** Solicitante, para mostrar en las bandejas. */
  solicitanteNombre?: string | null;
  solicitanteDocumento?: string | null;
}

export interface PaseInput {
  /** Etapa a la que va (define la oficina de destino). */
  etapa: Etapa;
  usuario: Usuario;
  dictamen?: Dictamen;
  observaciones?: string | null;
  esDevolucion?: boolean;
}

interface UsuarioAuditado {
  id: string;
  /** «Apellido, Nombre». */
  nombre: string;
  legajo: string;
}

/** Un paso del expediente por una oficina (auditoría). */
interface PasoPorOficina {
  oficina: string;
  /** Última etapa en la que estuvo en esa oficina. */
  etapa: string;
  llego: Date;
  /** Quién lo envió (null: se inició en esta oficina). */
  enviadoPor: UsuarioAuditado | null;
  esDevolucion: boolean;
  tomadoPor: UsuarioAuditado | null;
  tomadoEn: Date | null;
  /** Cuándo salió (pase) o se cerró; null si sigue ahí. */
  salio: Date | null;
  /** Quién lo pasó o lo cerró. */
  salidaPor: UsuarioAuditado | null;
}

/** Quién consulta el historial: los detalles de cada oficina solo los ve esa oficina (y los administradores). */
export interface VisorHistorial {
  esAdministrador: boolean;
  oficina: { codigo: string } | null;
}

export interface ActuacionInput {
  /** Por defecto, la oficina y la etapa donde está el expediente. */
  oficina?: Oficina;
  etapa?: Etapa;
  tipo: TipoActuacion;
  resultado: ResultadoActuacion;
  usuario: Usuario;
  observaciones?: string | null;
  datos?: Record<string, unknown> | null;
}

/**
 * El expediente y su circuito, comunes a todos los trámites:
 *
 *   disponibilidad  dice si un número de expediente está libre (antes de empezar un trámite).
 *   abrir       registra el expediente en papel (lo tiene tomado la oficina donde empieza).
 *   tomar       la oficina donde está el expediente lo recibe: queda registrado quién y cuándo.
 *   pasar       lo envía a la etapa siguiente (o lo devuelve): nuevo movimiento.
 *   actuar      deja asentado lo que resolvió la oficina (exp_actuacion).
 *   historial   pases + actuaciones + cambios de estado, en orden, con quién hizo cada cosa.
 *   auditoria   quién lo inició, quién lo tuvo en cada oficina y quién lo finalizó (exp_auditoria).
 *   bandeja     expedientes que están en una oficina.
 *
 * Las reglas de cada trámite (qué valida cada oficina) están en el módulo del trámite;
 * acá solo está la mecánica. Los métodos que escriben reciben el EntityManager de la
 * transacción del trámite: o se guarda todo, o nada.
 */
@Injectable()
export class ExpedientesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  // ---------------------------------------------------------------------------
  // Apertura
  // ---------------------------------------------------------------------------

  /**
   * ¿El número de expediente está libre? Se consulta antes de empezar un trámite, para no
   * cargar todo y enterarse al final. Si ya está registrado, devuelve de qué trámite es y
   * dónde está. Mismo criterio que abrir(): 0123 y 123 son el mismo número.
   */
  async disponibilidad(input: { numero: string; reparticion: string; anio: number }) {
    const numero = String(Number(input.numero));
    const reparticion = String(Number(input.reparticion));
    const e = await this.dataSource.manager.findOneBy(Expediente, { numero, reparticion, anio: input.anio });
    return {
      numero: formatearNumeroExpediente(numero, reparticion, input.anio),
      disponible: !e,
      expediente: e && {
        id: e.id,
        tipoTramite: e.tipoTramite,
        tipoTramiteNombre: NOMBRE_TIPO_TRAMITE[e.tipoTramite],
        estado: e.estado,
        etapaNombre: NOMBRE_ETAPA[e.etapa],
        oficinaNombre: NOMBRE_OFICINA[e.oficinaActual],
        fechaIngreso: e.fechaIngreso,
      },
    };
  }

  /**
   * Registra en el sistema un expediente que ya existe en papel:
   *   1. Valida que el número no esté usado (409 si ya existe).
   *   2. Crea el expediente en su etapa inicial, tomado por quien lo registra.
   *   3. Asienta el movimiento de apertura (sin oficina de origen), ya recibido.
   *   4. Auditoría: quién lo inició.
   */
  async abrir(tx: EntityManager, input: AbrirExpedienteInput): Promise<Expediente> {
    const numero = String(Number(input.numero));
    const reparticion = String(Number(input.reparticion));
    const textoNumero = formatearNumeroExpediente(numero, reparticion, input.anio);

    // Paso 1: validación previa, para devolver un mensaje claro.
    if (await tx.existsBy(Expediente, { numero, reparticion, anio: input.anio })) {
      throw new ConflictException(`El expediente ${textoNumero} ya está registrado.`);
    }

    // Paso 2: el expediente.
    const etapa = input.etapa ?? Etapa.CARGA;
    const oficina = OFICINA_DE_ETAPA[etapa];
    const ahora = new Date();
    let expediente: Expediente;
    try {
      expediente = await tx.save(
        tx.create(Expediente, {
          numero,
          reparticion,
          anio: input.anio,
          tipoTramite: input.tipoTramite,
          asunto: input.asunto ?? null,
          fechaIngreso: hoyISO(),
          oficinaActual: oficina,
          etapa,
          solicitanteNombre: input.solicitanteNombre ?? null,
          solicitanteDocumento: input.solicitanteDocumento ?? null,
          estado: EstadoExpediente.EN_TRAMITE,
          tomadoPor: input.usuario,
          tomadoEn: ahora,
          creadoUsuarioId: input.usuario.id,
        }),
      );
    } catch (error) {
      // Dos cargas simultáneas del mismo número: la base deja pasar solo una.
      if (esViolacionDeUnicidad(error, 'uk_expediente')) throw new ConflictException(`El expediente ${textoNumero} ya está registrado.`);
      throw error;
    }

    // Paso 3: movimiento de apertura (lo recibe en el acto quien lo registra).
    await tx.save(
      tx.create(Movimiento, {
        expediente,
        oficinaOrigen: null,
        oficinaDestino: oficina,
        etapaDestino: etapa,
        enviadoPor: input.usuario,
        dictamen: Dictamen.SIN_DICTAMEN,
        observaciones: 'Ingreso del expediente al sistema.',
        recibidoPor: input.usuario,
        recibidoEn: ahora,
      }),
    );

    // Paso 4: auditoría.
    await this.auditar(tx, expediente, AccionAuditoria.INICIO, input.usuario);
    return expediente;
  }

  // ---------------------------------------------------------------------------
  // Tomar, exigir y pasar
  // ---------------------------------------------------------------------------

  /** Lee el expediente bloqueando la fila (FOR UPDATE): nadie más lo cambia hasta terminar la transacción. */
  async bloquear(tx: EntityManager, expedienteId: string, tipo?: TipoTramite): Promise<Expediente> {
    const expediente = await tx.findOne(Expediente, {
      where: { id: expedienteId, ...(tipo ? { tipoTramite: tipo } : {}) },
      // Solo se bloquea la fila del expediente (no las de las relaciones que se leen con él).
      lock: { mode: 'pessimistic_write', tables: ['exp_expediente'] },
    });
    if (!expediente) throw new NotFoundException('No se encontró el expediente.');
    return expediente;
  }

  /**
   * La oficina donde está el expediente lo recibe («toma»):
   *   1. Solo un usuario de esa oficina (o un administrador).
   *   2. Si ya lo tiene otro usuario, 409: primero tiene que soltarlo (TODO) o pasarlo.
   *   3. Queda registrado en el expediente, en la recepción del último pase y en la auditoría.
   */
  async tomar(expedienteId: string, usuarioId: string) {
    await this.dataSource.transaction(async (tx) => {
      const expediente = await this.bloquear(tx, expedienteId);
      if (ESTADOS_FINALES.includes(expediente.estado)) throw new ConflictException(`El expediente está ${expediente.estado.toLowerCase()}: ya no circula.`);
      const usuario = await this.usuarios.exigirDeOficina(usuarioId, expediente.oficinaActual);

      if (expediente.tomadoPor) {
        if (expediente.tomadoPor.id === usuario.id) return; // ya lo tenía
        throw new ConflictException(`El expediente ya lo tomó ${nombreUsuario(expediente.tomadoPor)}.`);
      }

      const ahora = new Date();
      await tx.update(Expediente, expediente.id, { tomadoPor: { id: usuario.id }, tomadoEn: ahora });
      const ultimo = await tx.findOne(Movimiento, { where: { expediente: { id: expediente.id }, recibidoEn: IsNull() }, order: { fecha: 'DESC', id: 'DESC' } });
      if (ultimo) await tx.update(Movimiento, ultimo.id, { recibidoPor: { id: usuario.id }, recibidoEn: ahora });
      await this.auditar(tx, expediente, AccionAuditoria.TOMA, usuario);
    });
    return this.resumen(expedienteId);
  }

  /**
   * Exige que el expediente esté en la etapa indicada, circulando, y que lo tenga tomado
   * el usuario que actúa. Devuelve el usuario. Lo usan todas las acciones de las oficinas.
   */
  async exigirParaActuar(expediente: Expediente, etapas: Etapa[], usuarioId: string, estados = [EstadoExpediente.EN_TRAMITE]): Promise<Usuario> {
    if (!etapas.includes(expediente.etapa)) {
      throw new ConflictException(`El expediente no está en esta etapa: hoy está en «${NOMBRE_ETAPA[expediente.etapa]}» (${NOMBRE_OFICINA[expediente.oficinaActual]}).`);
    }
    if (!estados.includes(expediente.estado)) {
      throw new ConflictException(`El expediente está ${expediente.estado.replace('_', ' ').toLowerCase()}: no se puede avanzar.`);
    }
    const usuario = await this.usuarios.exigirDeOficina(usuarioId, expediente.oficinaActual);
    if (expediente.tomadoPor?.id !== usuario.id && !usuario.esAdministrador) {
      throw new ConflictException(
        expediente.tomadoPor ? `El expediente lo tiene tomado ${nombreUsuario(expediente.tomadoPor)}.` : 'Primero hay que tomar el expediente.',
      );
    }
    return usuario;
  }

  /**
   * Lo que hace toda oficina antes de actuar, en un solo paso: bloquea el expediente (del
   * trámite indicado) y exige que esté en una de sus etapas, en uno de los estados admitidos
   * y tomado por quien actúa.
   */
  async bloquearParaActuar(
    tx: EntityManager,
    expedienteId: string,
    tipo: TipoTramite,
    etapas: Etapa[],
    usuarioId: string,
    estados = [EstadoExpediente.EN_TRAMITE],
  ): Promise<{ expediente: Expediente; usuario: Usuario }> {
    const expediente = await this.bloquear(tx, expedienteId, tipo);
    const usuario = await this.exigirParaActuar(expediente, etapas, usuarioId, estados);
    return { expediente, usuario };
  }

  /** Pase a otra etapa (y oficina): nuevo movimiento; la oficina de destino lo tiene que tomar. */
  async pasar(tx: EntityManager, expediente: Expediente, p: PaseInput): Promise<void> {
    const destino = OFICINA_DE_ETAPA[p.etapa];
    await tx.save(
      tx.create(Movimiento, {
        expediente,
        oficinaOrigen: expediente.oficinaActual,
        oficinaDestino: destino,
        etapaDestino: p.etapa,
        enviadoPor: p.usuario,
        dictamen: p.dictamen ?? Dictamen.SIN_DICTAMEN,
        observaciones: p.observaciones ?? null,
        esDevolucion: !!p.esDevolucion,
      }),
    );
    await tx.update(Expediente, expediente.id, {
      oficinaActual: destino,
      etapa: p.etapa,
      tomadoPor: null,
      tomadoEn: null,
      modificadoUsuarioId: p.usuario.id,
    });
    await this.auditar(tx, expediente, p.esDevolucion ? AccionAuditoria.DEVOLUCION : AccionAuditoria.PASE, p.usuario, { oficinaDestino: destino, etapa: p.etapa });
  }

  /** Cambio de etapa dentro de la misma oficina (ej: Catastro, de verificación final a espera de padrón). */
  async cambiarEtapa(tx: EntityManager, expediente: Expediente, etapa: Etapa, usuario: Usuario): Promise<void> {
    await tx.update(Expediente, expediente.id, { etapa, modificadoUsuarioId: usuario.id });
    if (etapa !== expediente.etapa) await this.auditar(tx, expediente, AccionAuditoria.CAMBIO_ETAPA, usuario, { etapa });
  }

  async cambiarEstado(tx: EntityManager, expediente: Expediente, estado: EstadoExpediente, usuario: Usuario, soltar = false): Promise<void> {
    await tx.update(Expediente, expediente.id, { estado, modificadoUsuarioId: usuario.id, ...(soltar ? { tomadoPor: null, tomadoEn: null } : {}) });
    if (estado !== expediente.estado) await this.auditar(tx, expediente, AccionAuditoria.CAMBIO_ESTADO, usuario, { estadoAnterior: expediente.estado, estadoNuevo: estado });
  }

  /** Asienta una fila de auditoría (en la transacción del cambio). Por defecto, la oficina y la etapa actuales. */
  private async auditar(
    tx: EntityManager,
    expediente: Expediente,
    accion: AccionAuditoria,
    usuario: Pick<Usuario, 'id'>,
    extra: Partial<Pick<Auditoria, 'oficinaDestino' | 'etapa' | 'estadoAnterior' | 'estadoNuevo'>> = {},
  ) {
    await tx.insert(Auditoria, { expediente: { id: expediente.id }, accion, usuario: { id: usuario.id }, oficina: expediente.oficinaActual, etapa: expediente.etapa, ...extra });
  }

  async actuar(tx: EntityManager, expediente: Expediente, a: ActuacionInput): Promise<Actuacion> {
    return tx.save(
      tx.create(Actuacion, {
        expediente,
        oficina: a.oficina ?? expediente.oficinaActual,
        etapa: a.etapa ?? expediente.etapa,
        tipo: a.tipo,
        resultado: a.resultado,
        observaciones: a.observaciones ?? null,
        datos: a.datos ?? null,
        usuario: a.usuario,
      }),
    );
  }

  /** Última actuación de un tipo (ej: la última observación, para saber a dónde reenviar). */
  ultimaActuacion(tx: EntityManager, expedienteId: string, tipos: TipoActuacion[], resultado?: ResultadoActuacion): Promise<Actuacion | null> {
    return tx.findOne(Actuacion, {
      where: { expediente: { id: expedienteId }, tipo: In(tipos), ...(resultado ? { resultado } : {}) },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Dónde está el expediente y quién lo tiene. */
  async resumen(expedienteId: string) {
    const e = await this.dataSource.manager.findOneBy(Expediente, { id: expedienteId });
    if (!e) throw new NotFoundException('No se encontró el expediente.');
    return {
      id: e.id,
      numero: formatearNumeroExpediente(e.numero, e.reparticion, e.anio),
      tipoTramite: e.tipoTramite,
      estado: e.estado,
      etapa: e.etapa,
      etapaNombre: NOMBRE_ETAPA[e.etapa],
      oficinaActual: e.oficinaActual,
      oficinaNombre: NOMBRE_OFICINA[e.oficinaActual],
      tomadoPor: e.tomadoPor && { id: e.tomadoPor.id, nombre: nombreUsuario(e.tomadoPor) },
      tomadoEn: e.tomadoEn,
    };
  }

  /**
   * Historial completo: cada pase (quién lo envió, de dónde a dónde, cuándo; quién lo
   * tomó y cuándo) y cada actuación (qué resolvió cada oficina), en orden cronológico.
   *
   * Seguimiento: dónde está, quién lo tomó y las fechas los ve cualquiera. Lo que hizo cada
   * oficina (resultado, observaciones y datos de la actuación) solo lo ve esa oficina; las
   * observaciones y el dictamen de un pase, la oficina que lo envió y la que lo recibe. Los
   * administradores ven todo.
   */
  async historial(expedienteId: string, visor: VisorHistorial) {
    const ve = (...oficinas: (Oficina | null)[]) => visor.esAdministrador || (!!visor.oficina && oficinas.includes(visor.oficina.codigo as Oficina));
    if (!(await this.dataSource.manager.existsBy(Expediente, { id: expedienteId }))) throw new NotFoundException('No se encontró el expediente.');
    const [movimientos, actuaciones, cambiosDeEstado, estados] = await Promise.all([
      this.dataSource.manager.find(Movimiento, { where: { expediente: { id: expedienteId } }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.dataSource.manager.find(Actuacion, { where: { expediente: { id: expedienteId } }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.dataSource.manager.find(Auditoria, { where: { expediente: { id: expedienteId }, accion: AccionAuditoria.CAMBIO_ESTADO }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.nombresDeEstados(),
    ]);

    const pases = movimientos.map((m) => ({
      tipo: 'PASE' as const,
      fecha: m.fecha,
      oficinaOrigen: m.oficinaOrigen && NOMBRE_OFICINA[m.oficinaOrigen],
      oficinaDestino: NOMBRE_OFICINA[m.oficinaDestino],
      etapa: NOMBRE_ETAPA[m.etapaDestino],
      enviadoPor: nombreUsuario(m.enviadoPor),
      recibidoPor: m.recibidoPor && nombreUsuario(m.recibidoPor),
      recibidoEn: m.recibidoEn,
      esDevolucion: m.esDevolucion,
      // La apertura (sin origen) es de la oficina donde empieza.
      ...(ve(m.oficinaOrigen ?? m.oficinaDestino, m.oficinaDestino)
        ? { reservado: false, dictamen: m.dictamen, observaciones: m.observaciones }
        : { reservado: true, dictamen: null, observaciones: null }),
    }));
    const hechos = actuaciones.map((a) => ({
      tipo: 'ACTUACION' as const,
      fecha: a.fecha,
      oficina: NOMBRE_OFICINA[a.oficina],
      etapa: NOMBRE_ETAPA[a.etapa],
      usuario: nombreUsuario(a.usuario),
      ...(ve(a.oficina)
        ? { reservado: false, actuacion: a.tipo, resultado: a.resultado, observaciones: a.observaciones, datos: a.datos }
        : { reservado: true, actuacion: null, resultado: null, observaciones: null, datos: null }),
    }));
    const estadosCambiados = cambiosDeEstado.map((c) => ({
      tipo: 'ESTADO' as const,
      fecha: c.fecha,
      oficina: NOMBRE_OFICINA[c.oficina],
      estado: c.estadoNuevo!,
      estadoNombre: estados.get(c.estadoNuevo!) ?? c.estadoNuevo!,
      estadoAnteriorNombre: c.estadoAnterior && (estados.get(c.estadoAnterior) ?? c.estadoAnterior),
      usuario: nombreUsuario(c.usuario),
    }));
    // Lo que se hace en una misma transacción tiene la misma hora (PostgreSQL usa la de inicio
    // de la transacción): en ese caso va primero la actuación (la decisión), después el cambio
    // de estado y al final el pase (el sort es estable).
    return [...hechos, ...estadosCambiados, ...pases].sort((x, y) => x.fecha.getTime() - y.fecha.getTime());
  }

  /** Nombre de cada estado según el catálogo de la base (cat_estado_expediente). */
  private async nombresDeEstados(): Promise<Map<string, string>> {
    const filas: { codigo: string; nombre: string }[] = await this.dataSource.query('SELECT codigo, nombre FROM cat_estado_expediente');
    return new Map(filas.map((f) => [f.codigo, f.nombre]));
  }

  /**
   * Auditoría del expediente (exp_auditoria), de punta a punta:
   *   iniciado    quién lo registró, dónde y cuándo.
   *   recorrido   cada paso por una oficina: cuándo llegó y quién lo envió, quién lo tomó y
   *               cuándo, cuándo salió y quién lo pasó (o quién lo cerró, si terminó ahí).
   *   finalizado  quién lo cerró (finalizado, rechazado, archivado o anulado), si ya terminó.
   *   eventos     todas las filas, en orden, para el detalle.
   */
  async auditoria(expedienteId: string) {
    if (!(await this.dataSource.manager.existsBy(Expediente, { id: expedienteId }))) throw new NotFoundException('No se encontró el expediente.');
    const [filas, estados] = await Promise.all([
      this.dataSource.manager.find(Auditoria, { where: { expediente: { id: expedienteId } }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.nombresDeEstados(),
    ]);
    const quien = (u: Usuario): UsuarioAuditado => ({ id: u.id, nombre: nombreUsuario(u), legajo: u.legajo });
    const nombreEstado = (e: EstadoExpediente) => estados.get(e) ?? e;

    const recorrido: PasoPorOficina[] = [];
    let iniciado: { usuario: UsuarioAuditado; fecha: Date; oficina: string } | null = null;
    let finalizado: { usuario: UsuarioAuditado; fecha: Date; oficina: string; estado: EstadoExpediente; estadoNombre: string } | null = null;

    for (const f of filas) {
      const actual = recorrido.at(-1);
      switch (f.accion) {
        case AccionAuditoria.INICIO:
          // Quien lo inicia lo tiene tomado desde el primer momento.
          iniciado = { usuario: quien(f.usuario), fecha: f.fecha, oficina: NOMBRE_OFICINA[f.oficina] };
          recorrido.push({ oficina: NOMBRE_OFICINA[f.oficina], etapa: NOMBRE_ETAPA[f.etapa], llego: f.fecha, enviadoPor: null, esDevolucion: false, tomadoPor: quien(f.usuario), tomadoEn: f.fecha, salio: null, salidaPor: null });
          break;
        case AccionAuditoria.TOMA:
          if (actual) Object.assign(actual, { tomadoPor: quien(f.usuario), tomadoEn: f.fecha });
          break;
        case AccionAuditoria.PASE:
        case AccionAuditoria.DEVOLUCION:
          if (actual) Object.assign(actual, { salio: f.fecha, salidaPor: quien(f.usuario) });
          recorrido.push({
            oficina: NOMBRE_OFICINA[f.oficinaDestino!],
            etapa: NOMBRE_ETAPA[f.etapa],
            llego: f.fecha,
            enviadoPor: quien(f.usuario),
            esDevolucion: f.accion === AccionAuditoria.DEVOLUCION,
            tomadoPor: null,
            tomadoEn: null,
            salio: null,
            salidaPor: null,
          });
          break;
        case AccionAuditoria.CAMBIO_ESTADO:
          if (ESTADOS_FINALES.includes(f.estadoNuevo!)) {
            finalizado = { usuario: quien(f.usuario), fecha: f.fecha, oficina: NOMBRE_OFICINA[f.oficina], estado: f.estadoNuevo!, estadoNombre: nombreEstado(f.estadoNuevo!) };
            if (actual) Object.assign(actual, { salio: f.fecha, salidaPor: quien(f.usuario) });
          }
          break;
        case AccionAuditoria.CAMBIO_ETAPA:
          if (actual) actual.etapa = NOMBRE_ETAPA[f.etapa];
          break;
      }
    }

    const eventos = filas.map((f) => ({
      id: f.id,
      accion: f.accion,
      fecha: f.fecha,
      usuario: quien(f.usuario),
      oficina: NOMBRE_OFICINA[f.oficina],
      oficinaDestino: f.oficinaDestino && NOMBRE_OFICINA[f.oficinaDestino],
      etapa: NOMBRE_ETAPA[f.etapa],
      estadoAnterior: f.estadoAnterior && nombreEstado(f.estadoAnterior),
      estadoNuevo: f.estadoNuevo && nombreEstado(f.estadoNuevo),
    }));
    return { iniciado, finalizado, recorrido, eventos };
  }

  /**
   * Bandeja de una oficina: los expedientes que están en ella y siguen circulando, con su
   * etapa, quién los tiene, desde cuándo están en la oficina y de qué oficina vinieron (el
   * último pase; null si se inició ahí).
   */
  async bandeja(oficina: Oficina) {
    const expedientes = await this.dataSource.manager.find(Expediente, {
      where: { oficinaActual: oficina, estado: Not(In(ESTADOS_FINALES)) },
      order: { modificadoEn: 'ASC' },
    });
    const ultimos: { expediente_id: string; fecha: Date; oficina_origen: Oficina | null; es_devolucion: boolean }[] = expedientes.length
      ? await this.dataSource.query(
          `SELECT DISTINCT ON (expediente_id) expediente_id, fecha, oficina_origen, es_devolucion FROM exp_movimiento
           WHERE expediente_id = ANY($1) ORDER BY expediente_id, fecha DESC, id DESC`,
          [expedientes.map((e) => e.id)],
        )
      : [];
    const ultimoDe = new Map(ultimos.map((u) => [String(u.expediente_id), u]));
    return expedientes.map((e) => {
      const ultimo = ultimoDe.get(e.id);
      return {
        id: e.id,
        numero: formatearNumeroExpediente(e.numero, e.reparticion, e.anio),
        tipoTramite: e.tipoTramite,
        estado: e.estado,
        etapa: e.etapa,
        etapaNombre: NOMBRE_ETAPA[e.etapa],
        titular: e.solicitanteNombre,
        tomadoPor: e.tomadoPor && nombreUsuario(e.tomadoPor),
        enLaOficinaDesde: ultimo?.fecha ?? null,
        vieneDe: ultimo?.oficina_origen ?? null,
        vieneDeNombre: ultimo?.oficina_origen ? NOMBRE_OFICINA[ultimo.oficina_origen] : null,
        /** Volvió observado (para corregir). */
        esDevolucion: ultimo?.es_devolucion ?? false,
      };
    });
  }

  /**
   * Búsqueda general (buscador de Catastro): cualquier expediente, en curso o terminado, con
   * dónde está, de qué oficina vino y desde cuándo. Los nombres de oficinas, trámites, estados y
   * etapas salen de los catálogos de la base. Más recientes primero (por el último pase).
   */
  async buscar(q: BuscarExpedientesQuery) {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    const param = (v: unknown) => `$${params.push(v)}`;

    if (q.texto) {
      const t = param(`%${q.texto.replace(/[%_\\]/g, '\\$&')}%`);
      // El número se compara como se muestra (123/332-2026), sin ceros a la izquierda.
      condiciones.push(
        `((e.numero::int)::text || '/' || (e.reparticion::int)::text || '-' || e.anio ILIKE ${t}` +
          ` OR e.solicitante_nombre ILIKE ${t} OR e.solicitante_documento ILIKE ${t})`,
      );
    }
    if (q.tipoTramite) condiciones.push(`e.tipo_tramite = ${param(q.tipoTramite)}`);
    if (q.estado === 'PENDIENTES') condiciones.push(`e.estado <> ALL(${param(ESTADOS_FINALES)}::exp_estado_expediente[])`);
    else if (q.estado) condiciones.push(`e.estado = ${param(q.estado)}`);
    if (q.oficina) condiciones.push(`e.oficina_actual = ${param(q.oficina)}`);
    if (q.desde) condiciones.push(`e.fecha_ingreso >= ${param(q.desde)}`);
    if (q.hasta) condiciones.push(`e.fecha_ingreso <= ${param(q.hasta)}`);

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limite = param(q.porPagina);
    const desplazamiento = param((q.pagina - 1) * q.porPagina);

    const filas: Record<string, string | null>[] = await this.dataSource.query(
      `SELECT e.id, e.numero, e.reparticion, e.anio, to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
              e.tipo_tramite, tt.nombre AS tramite_nombre, e.estado, es.nombre AS estado_nombre, es.color AS estado_color,
              e.etapa, et.nombre AS etapa_nombre, e.solicitante_nombre, e.solicitante_documento,
              e.oficina_actual, oa.nombre AS oficina_actual_nombre,
              ant.oficina_origen AS oficina_anterior, oo.nombre AS oficina_anterior_nombre,
              ult.fecha AS ultimo_pase, count(*) OVER () AS total
         FROM exp_expediente e
         -- Último pase: cuándo llegó a donde está.
         LEFT JOIN LATERAL (SELECT m.fecha FROM exp_movimiento m WHERE m.expediente_id = e.id
                             ORDER BY m.fecha DESC, m.id DESC LIMIT 1) ult ON true
         -- Oficina anterior: la última que se lo pasó a otra (un cambio de etapa dentro de la misma oficina no cuenta).
         LEFT JOIN LATERAL (SELECT m.oficina_origen FROM exp_movimiento m
                             WHERE m.expediente_id = e.id AND m.oficina_origen IS NOT NULL AND m.oficina_origen <> m.oficina_destino
                             ORDER BY m.fecha DESC, m.id DESC LIMIT 1) ant ON true
         LEFT JOIN seg_oficina oa ON oa.codigo = e.oficina_actual::text
         LEFT JOIN seg_oficina oo ON oo.codigo = ant.oficina_origen::text
         LEFT JOIN cat_tipo_tramite tt ON tt.codigo = e.tipo_tramite::text
         LEFT JOIN cat_estado_expediente es ON es.codigo = e.estado::text
         LEFT JOIN cat_etapa et ON et.codigo = e.etapa::text
         ${where}
        ORDER BY coalesce(ult.fecha, e.creado_en) DESC, e.id DESC
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      params,
    );

    return {
      total: filas.length ? Number(filas[0].total) : 0,
      pagina: q.pagina,
      porPagina: q.porPagina,
      expedientes: filas.map((f) => ({
        id: String(f.id),
        numero: formatearNumeroExpediente(f.numero!, f.reparticion!, Number(f.anio)),
        fechaIngreso: f.fecha_ingreso,
        tipoTramite: f.tipo_tramite,
        tramiteNombre: f.tramite_nombre ?? f.tipo_tramite,
        estado: f.estado,
        estadoNombre: f.estado_nombre ?? f.estado,
        estadoColor: f.estado_color ?? 'gris',
        etapa: f.etapa,
        etapaNombre: f.etapa_nombre ?? f.etapa,
        titular: f.solicitante_nombre,
        documento: f.solicitante_documento,
        oficinaActual: f.oficina_actual,
        oficinaActualNombre: f.oficina_actual_nombre ?? f.oficina_actual,
        oficinaAnterior: f.oficina_anterior,
        oficinaAnteriorNombre: f.oficina_anterior_nombre ?? f.oficina_anterior,
        ultimoPase: f.ultimo_pase,
      })),
    };
  }
}
