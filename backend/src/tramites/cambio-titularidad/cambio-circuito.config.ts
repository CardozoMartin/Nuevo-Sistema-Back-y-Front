import { ConflictException, Injectable, type OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { Domicilio } from '../../concesiones/entities/domicilio.entity.js';
import { Titular } from '../../concesiones/entities/titular.entity.js';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import type { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import { TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { nombrePersona, type Persona } from '../../personas/entities/persona.entity.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import type { ConfigTramite } from '../circuito/config-tramite.js';
import { RegistroTramitesService } from '../circuito/registro-tramites.service.js';
import { EstadoCambioTitularidad } from './cambio-titularidad.constantes.js';
import { CambioTitularidadService } from './cambio-titularidad.service.js';
import { CambioTitularidad } from './entities/cambio-titularidad.entity.js';
import { DomicilioPropuesto } from './entities/domicilio-propuesto.entity.js';
import { TitularPropuesto } from './entities/titular-propuesto.entity.js';
import { exigirConcesionVigente, exigirFechaDeResolucion, exigirPropuestaCompleta, exigirTitularesDistintos, unirPersonas } from './validaciones/cambio.validaciones.js';

/**
 * Lo propio del Cambio de Titularidad en el circuito por las oficinas (ver tramites/circuito/).
 * Se registra sola al arrancar: las oficinas la buscan por el tipo de trámite del expediente.
 *
 * Diferencias con el alta:
 *   - No pide número de concesión (la concesión ya lo tiene).
 *   - No espera el padrón de Rentas: el padrón es del inmueble y no cambia. Finaliza en la
 *     verificación final de Catastro, y ahí la concesión cambia de titular.
 *     (A CONFIRMAR con la oficina si Rentas tiene que intervenir.)
 */
@Injectable()
export class CambioCircuitoConfig implements ConfigTramite, OnModuleInit {
  readonly tipoTramite = TipoTramite.CAMBIO_TITULARIDAD;
  readonly pideNumeroConcesion = false;
  readonly esperaPadron = false;

  constructor(
    private readonly cambios: CambioTitularidadService,
    private readonly registro: RegistroTramitesService,
  ) {}

  onModuleInit() {
    this.registro.registrar(this);
  }

  /**
   * Recaudación verifica la deuda de los titulares ACTUALES (la concesión que se transfiere no
   * puede tener deuda) y de los NUEVOS (sus otras concesiones). Los que siguen, una sola vez.
   */
  async personasAVerificar(tx: EntityManager, expediente: Expediente): Promise<Persona[]> {
    const cambio = await this.cambios.cargar(tx, expediente.id);
    const actuales = await tx.find(Titular, { where: { concesion: { id: cambio.concesion.id }, vigente: true }, order: { orden: 'ASC' } });
    const nuevos = await tx.find(TitularPropuesto, { where: { cambio: { id: cambio.id } }, order: { orden: 'ASC' } });
    return unirPersonas(
      actuales.map((t) => t.persona),
      nuevos.map((t) => t.persona),
    );
  }

  /**
   * Antes de enviar, reenviar o cerrar:
   *   1. El cambio sigue en trámite y la concesión sigue vigente (pudo anularse por otra vía).
   *   2. Hay nuevo titular y domicilio legal.
   *   3. Los nuevos no son exactamente los actuales.
   */
  async validarCarga(tx: EntityManager, expediente: Expediente): Promise<void> {
    const cambio = await this.cambios.cargar(tx, expediente.id);

    //1.- En trámite, sobre una concesión vigente.
    if (cambio.estado !== EstadoCambioTitularidad.EN_TRAMITE) throw new ConflictException(`El cambio de titularidad está ${cambio.estado.toLowerCase()}.`);
    exigirConcesionVigente(cambio.concesion);

    //2.- La propuesta completa.
    const nuevos = await tx.find(TitularPropuesto, { where: { cambio: { id: cambio.id } } });
    const domicilios = await tx.count(DomicilioPropuesto, { where: { cambio: { id: cambio.id } } });
    exigirPropuestaCompleta(nuevos.length, domicilios);

    //3.- Que haya un cambio.
    const actuales = await tx.find(Titular, { where: { concesion: { id: cambio.concesion.id }, vigente: true } });
    exigirTitularesDistintos(
      actuales.map((t) => t.persona.documento),
      nuevos.map((t) => t.persona.documento ?? ''),
    );
  }

  /** «No apto»: el cambio no se aprueba. La concesión sigue igual, a nombre del titular actual. */
  async alRechazar(tx: EntityManager, expediente: Expediente, usuario: Usuario): Promise<void> {
    const cambio = await this.cambios.cargar(tx, expediente.id);
    await tx.update(CambioTitularidad, cambio.id, { estado: EstadoCambioTitularidad.RECHAZADO, modificadoUsuarioId: usuario.id });
  }

  /** No pide número de concesión (pideNumeroConcesion = false): el circuito no llega a llamarlas. */
  async etiquetasNumero(): Promise<string[]> {
    return [];
  }

  async alAsignarNumeros(): Promise<void> {
    throw new ConflictException('Un cambio de titularidad no lleva número de concesión: la concesión ya lo tiene.');
  }

  /** La resolución queda enlazada al cambio: su fecha es desde cuándo rige el nuevo titular. */
  async alRegistrarResolucion(tx: EntityManager, expediente: Expediente, resolucion: Resolucion, usuario: Usuario): Promise<string> {
    const cambio = await this.cambios.cargar(tx, expediente.id);
    await tx.update(CambioTitularidad, cambio.id, { resolucion: { id: resolucion.id }, modificadoUsuarioId: usuario.id });
    return `Cambio de titularidad de la concesión N° ${cambio.concesion.numero ?? cambio.concesion.id}.`;
  }

  /**
   * Con todos los vistos buenos, la concesión cambia de titular. Nada se borra:
   *   1. Los titulares y domicilios vigentes se cierran (vigente = false, hasta = fecha de la resolución).
   *   2. Los propuestos pasan a ser los vigentes (desde = esa fecha), con el expediente del cambio.
   *   3. El cambio queda FINALIZADO.
   * Devuelve los titulares anteriores y los nuevos, para el historial.
   */
  async alFinalizar(tx: EntityManager, expediente: Expediente, _padron: string | null, usuario: Usuario): Promise<Record<string, unknown>> {
    const cambio = await this.cambios.cargar(tx, expediente.id);
    const fecha = exigirFechaDeResolucion(cambio.resolucion);
    const concesion = cambio.concesion;
    exigirConcesionVigente(concesion);

    const vigentes = { concesion: { id: concesion.id }, vigente: true };
    const anteriores = await tx.find(Titular, { where: vigentes, order: { orden: 'ASC' } });
    const nuevos = await tx.find(TitularPropuesto, { where: { cambio: { id: cambio.id } }, order: { orden: 'ASC' } });
    const domicilios = await tx.find(DomicilioPropuesto, { where: { cambio: { id: cambio.id } }, order: { orden: 'ASC' } });
    exigirPropuestaCompleta(nuevos.length, domicilios.length);

    //1.- Se cierra lo vigente (queda en el historial de la concesión).
    await tx.update(Titular, vigentes, { vigente: false, hasta: fecha });
    await tx.update(Domicilio, vigentes, { vigente: false, hasta: fecha });

    //2.- Lo propuesto pasa a regir desde la resolución.
    await tx.save(nuevos.map((t) => tx.create(Titular, { concesion, persona: t.persona, orden: t.orden, expediente, vigente: true, desde: fecha })));
    await tx.save(
      domicilios.map((d) =>
        tx.create(Domicilio, {
          concesion,
          orden: d.orden,
          calle: d.calle,
          numero: d.numero,
          departamento: d.departamento,
          localidad: d.localidad,
          distrito: d.distrito,
          expediente,
          vigente: true,
          desde: fecha,
        }),
      ),
    );

    //3.- El cambio terminó.
    await tx.update(CambioTitularidad, cambio.id, { estado: EstadoCambioTitularidad.FINALIZADO, modificadoUsuarioId: usuario.id });
    await tx.update(Concesion, concesion.id, { modificadoUsuarioId: usuario.id });

    return {
      numeroConcesion: concesion.numero,
      vigenteDesde: fecha,
      titularesAnteriores: anteriores.map((t) => nombrePersona(t.persona)),
      titularesNuevos: nuevos.map((t) => nombrePersona(t.persona)),
    };
  }
}
