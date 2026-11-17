import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { UbicacionesService, type UbicacionValidada } from '../../catalogos/ubicaciones.service.js';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { Domicilio } from '../../concesiones/entities/domicilio.entity.js';
import { Titular } from '../../concesiones/entities/titular.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Etapa, formatearNumeroExpediente, NOMBRE_TIPO_TRAMITE, Oficina, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { nombrePersona, type Persona } from '../../personas/entities/persona.entity.js';
import { PersonasService } from '../../personas/personas.service.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { GuardarTitularesDto } from '../alta-concesion/dto/guardar-titulares.dto.js';
import { exigirAnioEnCurso } from '../alta-concesion/validaciones/inicio.validaciones.js';
import { exigirDocumentosSinRepetir } from '../alta-concesion/validaciones/titulares.validaciones.js';
import { EstadoCambioTitularidad } from './cambio-titularidad.constantes.js';
import type { IniciarCambioDto } from './dto/iniciar-cambio.dto.js';
import { CambioTitularidad } from './entities/cambio-titularidad.entity.js';
import { DomicilioPropuesto } from './entities/domicilio-propuesto.entity.js';
import { TitularPropuesto } from './entities/titular-propuesto.entity.js';
import { exigirConcesionVigente, exigirSinTramiteEnCurso, exigirTitularesDistintos } from './validaciones/cambio.validaciones.js';

const CAMBIO = TipoTramite.CAMBIO_TITULARIDAD;

/** Etapas en las que Catastro puede editar la propuesta: la carga y la corrección de lo observado. */
const ETAPAS_EDITABLES = [Etapa.CARGA, Etapa.CORRECCION];

/** Una persona, como la ven las pantallas (los datos sensibles los oculta el interceptor según el permiso). */
const personaRespuesta = (p: Persona) => ({
  personaId: p.id,
  nombreCompleto: nombrePersona(p),
  tipoPersona: p.tipoPersona,
  tipoDocumento: p.tipoDocumento,
  documento: p.documento,
  apellido: p.apellido,
  nombre: p.nombre,
  fechaNacimiento: p.fechaNacimiento,
  razonSocial: p.razonSocial,
  fechaConstitucion: p.fechaConstitucion,
  email: p.email,
  telefono: p.telefono,
});

/** Un domicilio legal (vigente o propuesto), con los nombres del catálogo. */
const domicilioRespuesta = (d: Pick<Domicilio, 'calle' | 'numero' | 'departamento' | 'localidad' | 'distrito'>) => ({
  calle: d.calle,
  numero: d.numero,
  departamento: d.departamento?.nombre ?? null,
  localidad: d.localidad?.nombre ?? null,
  distrito: d.distrito?.nombre ?? null,
});

export type RespuestaCambio = Awaited<ReturnType<CambioTitularidadService['obtener']>>;

/**
 * Cambio de Titularidad: inicio y carga en Catastro, y lo común que usa el circuito.
 *
 *   iniciar          Catastro elige una concesión VIGENTE sin otro trámite en curso y registra el
 *                    expediente en papel (año en curso, número libre).
 *   guardarTitulares Catastro carga el / los nuevos titulares y su domicilio legal. Es una
 *                    PROPUESTA: la concesión sigue a nombre del titular actual hasta que el
 *                    trámite finaliza (ver CambioCircuitoConfig.alFinalizar).
 *
 * El circuito por las oficinas está en CambioCircuitoService (+ CambioCircuitoConfig).
 */
@Injectable()
export class CambioTitularidadService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly usuarios: UsuariosService,
    private readonly personas: PersonasService,
    private readonly ubicaciones: UbicacionesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Cambios en trámite (o todos, con `todos`), del más nuevo al más viejo. */
  async listar(todos = false) {
    const cambios = await this.dataSource.manager.find(CambioTitularidad, {
      where: todos ? {} : { estado: EstadoCambioTitularidad.EN_TRAMITE },
      relations: { expediente: true, titulares: true },
      order: { creadoEn: 'DESC' },
      take: 200,
    });
    return cambios.map((c) => ({
      expedienteId: c.expediente.id,
      expediente: formatearNumeroExpediente(c.expediente.numero, c.expediente.reparticion, c.expediente.anio),
      concesion: { id: c.concesion.id, numero: c.concesion.numero },
      estado: c.estado,
      etapa: c.expediente.etapa,
      oficinaActual: c.expediente.oficinaActual,
      nuevoTitular: [...c.titulares].sort((a, b) => a.orden - b.orden).map((t) => nombrePersona(t.persona))[0] ?? null,
      creadoEn: c.creadoEn,
    }));
  }

  /** Todo el cambio: expediente, concesión, titulares actuales y propuestos, resolución y aviso de deuda. */
  async obtener(expedienteId: string) {
    const tx = this.dataSource.manager;
    const cambio = await this.cargar(tx, expedienteId);
    const { concesion } = cambio;
    const vigentes = { concesion: { id: concesion.id }, vigente: true };
    const titularesActuales = await tx.find(Titular, { where: vigentes, order: { orden: 'ASC' } });
    const domiciliosActuales = await tx.find(Domicilio, { where: vigentes, order: { orden: 'ASC' }, relations: { departamento: true, localidad: true, distrito: true } });
    const propuestos = await tx.find(TitularPropuesto, { where: { cambio: { id: cambio.id } }, order: { orden: 'ASC' } });
    const domiciliosPropuestos = await tx.find(DomicilioPropuesto, { where: { cambio: { id: cambio.id } }, order: { orden: 'ASC' } });

    return {
      expediente: await this.expedientes.resumen(expedienteId),
      cambio: {
        id: cambio.id,
        estado: cambio.estado,
        concesion: { id: concesion.id, numero: concesion.numero, estado: concesion.estado, fechaOtorgamiento: concesion.fechaOtorgamiento },
        /** Lo vigente hoy. Después de finalizar, son los NUEVOS (los anteriores quedan en el historial de la concesión). */
        titularesActuales: titularesActuales.map((t) => personaRespuesta(t.persona)),
        domiciliosActuales: domiciliosActuales.map(domicilioRespuesta),
        /** Lo propuesto en el expediente («Nuevo titular (propuesto)» hasta que el cambio finaliza). */
        nuevosTitulares: propuestos.map((t) => personaRespuesta(t.persona)),
        nuevosDomicilios: domiciliosPropuestos.map(domicilioRespuesta),
        cargaCompleta: propuestos.length > 0 && domiciliosPropuestos.length > 0,
        resolucion: cambio.resolucion && { numero: `${cambio.resolucion.numero}/${cambio.resolucion.anio}`, fecha: cambio.resolucion.fecha },
      },
      avisoDeuda: await this.expedientes.avisoDeuda(expedienteId),
    };
  }

  // ---------------------------------------------------------------------------
  // Catastro: inicio y carga
  // ---------------------------------------------------------------------------

  async iniciar(datos: IniciarCambioDto, usuarioId: string): Promise<RespuestaCambio> {
    const { numero, reparticion, anio } = datos.expediente;

    //1.- Lo inicia un usuario de Catastro.
    const usuario = await this.usuarios.exigirDeOficina(usuarioId, Oficina.CATASTRO);

    //2.- El expediente tiene que ser del año en curso (misma regla que el alta).
    exigirAnioEnCurso(anio);

    const expedienteId = await this.dataSource.transaction(async (tx) => {
      //3.- La concesión: que exista y esté vigente. Se bloquea su fila para que dos inicios
      //    simultáneos sobre la misma concesión se ordenen (el índice único igual lo garantiza).
      const concesion = await tx.findOne(Concesion, { where: { id: datos.concesionId }, lock: { mode: 'pessimistic_write', tables: ['con_concesion'] } });
      if (!concesion) throw new NotFoundException('No se encontró la concesión.');
      exigirConcesionVigente(concesion);

      //4.- Sin otro trámite en curso sobre la concesión.
      exigirSinTramiteEnCurso(concesion.numero, await this.tramiteEnCurso(tx, concesion.id));

      //5.- El expediente (409 si el número ya existe), con el titular actual como solicitante
      //    hasta que se cargue el nuevo.
      const [principal] = await tx.find(Titular, { where: { concesion: { id: concesion.id }, vigente: true }, order: { orden: 'ASC' }, take: 1 });
      const expediente = await this.expedientes.abrir(tx, {
        numero,
        reparticion,
        anio,
        tipoTramite: CAMBIO,
        asunto: `Cambio de titularidad de la concesión N° ${concesion.numero ?? concesion.id}`,
        usuario,
        solicitanteNombre: principal ? nombrePersona(principal.persona) : null,
        solicitanteDocumento: principal?.persona.documento ?? null,
      });

      //6.- El cambio, ligado a la concesión.
      try {
        await tx.save(tx.create(CambioTitularidad, { expediente, concesion, creadoUsuarioId: usuario.id }));
      } catch (error) {
        if (esViolacionDeUnicidad(error, 'uk_cambio_concesion_en_tramite')) throw new ConflictException('La concesión ya tiene un cambio de titularidad en curso.');
        throw error;
      }
      return expediente.id;
    });

    //7.- Se devuelve el cambio recién creado.
    return this.obtener(expedienteId);
  }

  /**
   * Nuevos titulares y domicilios legales (lista completa: reemplaza lo cargado antes).
   * Cada titular es una PERSONA única por documento (per_persona): si ya existe se reutiliza.
   */
  async guardarTitulares(expedienteId: string, datos: GuardarTitularesDto, usuarioId: string): Promise<RespuestaCambio> {
    //1.- Un mismo documento no figura dos veces.
    exigirDocumentosSinRepetir(datos.titulares);

    await this.dataSource.transaction(async (tx) => {
      //2.- Catastro, con el expediente tomado, en la carga o corrigiendo lo observado.
      const { expediente, usuario, cambio } = await this.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Tiene que haber un cambio: los nuevos no pueden ser exactamente los actuales.
      const actuales = await tx.find(Titular, { where: { concesion: { id: cambio.concesion.id }, vigente: true } });
      exigirTitularesDistintos(
        actuales.map((t) => t.persona.documento),
        datos.titulares.map((t) => t.documento),
      );

      //4.- Cada domicilio, contra el catálogo (departamento → localidad → distrito).
      const ubicaciones: UbicacionValidada[] = [];
      for (const domicilio of datos.domicilios) ubicaciones.push(await this.ubicaciones.exigirUbicacion(domicilio, tx));

      //5.- Cada titular se busca por documento: si ya existe se reutiliza (y se actualizan sus datos).
      const personas: Persona[] = [];
      for (const titular of datos.titulares) personas.push(await this.personas.guardar(tx, titular, usuario.id));

      //6.- Se reemplaza la propuesta anterior por la nueva.
      await tx.delete(TitularPropuesto, { cambio: { id: cambio.id } });
      await tx.delete(DomicilioPropuesto, { cambio: { id: cambio.id } });
      await tx.save(personas.map((persona, orden) => tx.create(TitularPropuesto, { cambio, persona, orden })));
      await tx.save(datos.domicilios.map((d, orden) => tx.create(DomicilioPropuesto, { cambio, orden, calle: d.calle, numero: d.numero ?? null, ...ubicaciones[orden] })));

      //7.- El nuevo titular principal es el solicitante del expediente (bandejas y búsquedas).
      await tx.update(Expediente, expediente.id, { solicitanteNombre: nombrePersona(personas[0]), solicitanteDocumento: personas[0].documento, modificadoUsuarioId: usuario.id });
      await tx.update(CambioTitularidad, cambio.id, { modificadoUsuarioId: usuario.id });
    });

    //8.- Se devuelve el cambio actualizado.
    return this.obtener(expedienteId);
  }

  // ---------------------------------------------------------------------------
  // Lo común (lo usan también el circuito y su configuración)
  // ---------------------------------------------------------------------------

  /** El cambio de un expediente (404 si el expediente no es un cambio de titularidad). */
  async cargar(tx: EntityManager, expedienteId: string): Promise<CambioTitularidad> {
    const cambio = await tx.findOne(CambioTitularidad, { where: { expediente: { id: expedienteId } }, relations: { expediente: true } });
    if (!cambio) throw new NotFoundException('No se encontró el cambio de titularidad.');
    return cambio;
  }

  /**
   * Trámite en curso sobre la concesión, si hay uno. Hoy: otro cambio de titularidad.
   * TODO: cuando se migren Anulación, Subdivisión, Reducción / Ampliación y Reubicación, sumar
   * acá sus trámites en curso (o pasar a una tabla común expediente ↔ concesión).
   */
  async tramiteEnCurso(tx: EntityManager, concesionId: string): Promise<{ expediente: string; tramite: string } | null> {
    const cambio = await tx.findOne(CambioTitularidad, { where: { concesion: { id: concesionId }, estado: EstadoCambioTitularidad.EN_TRAMITE }, relations: { expediente: true } });
    if (!cambio) return null;
    const e = cambio.expediente;
    return { expediente: formatearNumeroExpediente(e.numero, e.reparticion, e.anio), tramite: NOMBRE_TIPO_TRAMITE[CAMBIO] };
  }

  /** Catastro puede editar la propuesta: en la carga (en trámite) o en la corrección (observado), con el expediente tomado. */
  private async exigirEditable(tx: EntityManager, expedienteId: string, usuarioId: string): Promise<{ expediente: Expediente; usuario: Usuario; cambio: CambioTitularidad }> {
    const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, CAMBIO, ETAPAS_EDITABLES, usuarioId, [EstadoExpediente.EN_TRAMITE, EstadoExpediente.OBSERVADO]);
    const cambio = await this.cargar(tx, expedienteId);
    return { expediente, usuario, cambio };
  }
}
