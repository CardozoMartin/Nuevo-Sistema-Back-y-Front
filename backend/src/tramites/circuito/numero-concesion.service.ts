import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, type EntityManager, type FindOptionsWhere } from 'typeorm';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { SolicitudNumero } from '../../expedientes/entities/solicitud-numero.entity.js';
import { EstadoExpediente, EstadoSolicitudNumero, Etapa, formatearNumeroExpediente, Oficina, ResultadoActuacion, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { nombreUsuario } from '../../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { FiltroSolicitudesDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { normalizarNumerosConcesion } from './validaciones/circuito.validaciones.js';

/**
 * Número de concesión, en dos pasos y sin mover el expediente (sigue en Secretaría):
 *   1. Secretaría General lo PIDE (solicitar): queda un pedido pendiente en la bandeja de Catastro.
 *   2. Catastro lo toma de su libro de concesiones («Petete») y lo CARGA (asignar). El
 *      sistema controla que no esté usado y muestra el último registrado como referencia.
 * Después Secretaría carga la resolución, que lleva el número (EtapaResolucionService).
 */
@Injectable()
export class NumeroConcesionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly usuarios: UsuariosService,
    private readonly registro: RegistroTramitesService,
  ) {}

  /** Secretaría pide el número. Si ya hay un pedido (pendiente o asignado), no se repite. */
  async solicitar(tipo: TipoTramite, expedienteId: string, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Secretaría tiene que tener tomado el expediente, en su etapa.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.SECRETARIA_GENERAL], usuarioId);

      //2.- Si ya lo pidió (o ya lo tiene), no se crea otro pedido.
      if (await tx.existsBy(SolicitudNumero, { expediente: { id: expediente.id } })) return;

      //3.- El pedido, con lo que defina el trámite (alta: un número; subdivisión: uno por fracción).
      const etiquetas = await this.registro.de(tipo).etiquetasNumero(tx, expediente);
      await tx.save(tx.create(SolicitudNumero, { expediente, etiquetas, solicitadoPor: usuario }));
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.SOLICITUD_NUMERO,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: 'Se pidió a Catastro el número de concesión.',
        datos: etiquetas.length ? { etiquetas } : null,
      });
    });
  }

  /** Bandeja de Catastro: los pedidos, los pendientes primero (el orden del enum) y los más viejos arriba. */
  async listar(filtro: FiltroSolicitudesDto) {
    const where: FindOptionsWhere<SolicitudNumero> = {};
    if (filtro.estado) where.estado = filtro.estado as EstadoSolicitudNumero;
    if (filtro.expedienteId) where.expediente = { id: filtro.expedienteId };
    const solicitudes = await this.dataSource.manager.find(SolicitudNumero, { where, order: { estado: 'ASC', solicitadoEn: 'ASC' }, take: 200 });
    return solicitudes.map((s) => this.respuesta(s));
  }

  /** Referencia para Catastro: el último número de concesión registrado en el sistema. */
  async ultimoRegistrado(): Promise<{ ultimoNumero: string | null }> {
    const [fila] = await this.dataSource.query(`SELECT max(numero::bigint)::text AS ultimo FROM con_concesion WHERE numero ~ '^[0-9]{1,15}$'`);
    return { ultimoNumero: fila?.ultimo ?? null };
  }

  /** Catastro carga el número del libro. */
  async asignar(solicitudId: string, numeros: string[], usuarioId: string) {
    //1.- Solo un usuario de Catastro (o un administrador).
    const usuario = await this.usuarios.obtener(usuarioId);
    if (!usuario.esAdministrador && usuario.oficina?.codigo !== Oficina.CATASTRO) throw new ForbiddenException('El número de concesión lo carga Catastro.');

    await this.dataSource.transaction(async (tx) => {
      //2.- El pedido tiene que existir y estar pendiente.
      const solicitud = await tx.findOne(SolicitudNumero, { where: { id: solicitudId }, lock: { mode: 'pessimistic_write', tables: ['exp_solicitud_numero'] } });
      if (!solicitud) throw new NotFoundException('No se encontró el pedido de número de concesión.');
      if (solicitud.estado !== EstadoSolicitudNumero.PENDIENTE) throw new ConflictException(`El pedido ya tiene número asignado: ${solicitud.numeros.join(', ')}.`);

      //3.- El expediente tiene que seguir en Secretaría, circulando.
      const expediente = await this.expedientes.bloquear(tx, solicitud.expediente.id);
      if (expediente.etapa !== Etapa.SECRETARIA_GENERAL || expediente.estado !== EstadoExpediente.EN_TRAMITE) {
        throw new ConflictException('El expediente ya no está esperando el número en Secretaría General.');
      }

      //4.- Se validan los números: tantos como se pidieron, sin repetir y sin usar.
      const normalizados = normalizarNumerosConcesion(numeros, Math.max(solicitud.etiquetas.length, 1));
      await this.exigirNumerosLibres(tx, normalizados);

      //5.- El trámite los aplica (alta: a su concesión) y el pedido queda asignado.
      await this.registro.de(expediente.tipoTramite).alAsignarNumeros(tx, expediente, normalizados, usuario);
      await tx.update(SolicitudNumero, solicitud.id, { estado: EstadoSolicitudNumero.ASIGNADA, numeros: normalizados, asignadoPor: { id: usuario.id }, asignadoEn: new Date() });

      //6.- Queda en el historial: lo cargó Catastro (el expediente sigue en Secretaría).
      await this.expedientes.actuar(tx, expediente, {
        oficina: Oficina.CATASTRO,
        tipo: TipoActuacion.NUMERO_CONCESION,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: `Número de concesión ${normalizados.join(', ')}.`,
        datos: { numeros: normalizados, solicitudId: solicitud.id },
      });
    });
    return this.respuesta(await this.dataSource.manager.findOneByOrFail(SolicitudNumero, { id: solicitudId }));
  }

  /** Los números asignados al expediente (vacío si Catastro todavía no los cargó). */
  async asignadosA(tx: EntityManager, expedienteId: string): Promise<string[]> {
    const solicitud = await tx.findOneBy(SolicitudNumero, { expediente: { id: expedienteId }, estado: EstadoSolicitudNumero.ASIGNADA });
    return solicitud?.numeros ?? [];
  }

  // ---------------------------------------------------------------------------

  /** Ningún número puede estar usado por otra concesión. */
  private async exigirNumerosLibres(tx: EntityManager, numeros: string[]): Promise<void> {
    const usadas = await tx.find(Concesion, { where: { numero: In(numeros) } });
    if (usadas.length) throw new ConflictException(`El número de concesión ${usadas.map((c) => c.numero).join(', ')} ya está usado.`);
  }

  private respuesta(s: SolicitudNumero) {
    const e = s.expediente;
    return {
      id: s.id,
      expediente: { id: e.id, numero: formatearNumeroExpediente(e.numero, e.reparticion, e.anio), tipoTramite: e.tipoTramite, titular: e.solicitanteNombre },
      estado: s.estado,
      etiquetas: s.etiquetas,
      numeros: s.numeros,
      solicitadoPor: nombreUsuario(s.solicitadoPor),
      solicitadoEn: s.solicitadoEn,
      asignadoPor: s.asignadoPor && nombreUsuario(s.asignadoPor),
      asignadoEn: s.asignadoEn,
    };
  }
}
