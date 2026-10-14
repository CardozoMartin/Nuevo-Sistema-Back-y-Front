import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { EstadoConcesion } from '../concesiones/concesiones.constantes.js';
import { Expediente } from '../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Oficina, ResultadoActuacion, TipoActuacion } from '../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../expedientes/expedientes.service.js';
import { nombrePersona } from '../personas/entities/persona.entity.js';
import type { Usuario } from '../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../seguridad/usuarios.service.js';
import { Deuda, EstadoDeuda } from './entities/deuda.entity.js';

/** Una concesión otorgada de los titulares de un trámite, con sus titulares y si tiene deuda. */
export interface ConcesionConDeuda {
  id: string;
  numero: string | null;
  departamento: string | null;
  localidad: string | null;
  titulares: { personaId: string; nombre: string }[];
  tieneDeuda: boolean;
}

/** Nombre de la persona en SQL (alias p): razón social, «Apellido, Nombre» o la denominación del padrón anterior. */
const NOMBRE_SQL = `COALESCE(NULLIF(p.razon_social, ''), NULLIF(concat_ws(', ', p.apellido, p.nombre), ''), p.denominacion, 'Sin nombre')`;

/**
 * Deudas de las concesiones y sus titulares. Por ahora solo importa SI una concesión tiene deuda
 * (sin monto): Recaudación la marca y queda una deuda pendiente por cada titular vigente. Mientras
 * alguno de los titulares de un expediente tenga una deuda pendiente, el expediente queda EN_ESPERA
 * en Recaudación; al cancelarla se reanuda solo.
 */
@Injectable()
export class RecaudacionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly usuarios: UsuariosService,
  ) {}

  pendientesDe(tx: EntityManager, personaIds: string[]): Promise<Deuda[]> {
    if (!personaIds.length) return Promise.resolve([]);
    return tx.find(Deuda, { where: { persona: { id: In(personaIds) }, estado: EstadoDeuda.PENDIENTE }, relations: { concesion: true }, order: { creadoEn: 'ASC' } });
  }

  /**
   * Concesiones otorgadas (VIGENTES) de las que alguna de estas personas es titular vigente,
   * salvo la del propio expediente, con todos sus titulares y si tienen deuda pendiente.
   */
  async concesionesDe(tx: EntityManager, personaIds: string[], expedienteId: string): Promise<ConcesionConDeuda[]> {
    if (!personaIds.length) return [];
    const filas: { id: string; numero: string | null; departamento: string | null; localidad: string | null; titulares: { personaId: string; nombre: string }[]; tiene_deuda: boolean }[] =
      await tx.query(
        `SELECT c.id::text AS id, c.numero, i.departamento, i.localidad,
                json_agg(json_build_object('personaId', t.persona_id::text, 'nombre', ${NOMBRE_SQL}) ORDER BY t.orden) AS titulares,
                EXISTS (SELECT 1 FROM rec_deuda d WHERE d.concesion_id = c.id AND d.estado = $4) AS tiene_deuda
           FROM con_concesion c
           JOIN con_titular t ON t.concesion_id = c.id AND t.vigente
           JOIN per_persona p ON p.id = t.persona_id
           LEFT JOIN con_v_inmueble i ON i.concesion_id = c.id
          WHERE c.estado = $1
            AND c.expediente_id IS DISTINCT FROM $2
            AND c.id IN (SELECT t2.concesion_id FROM con_titular t2 WHERE t2.vigente AND t2.persona_id = ANY($3::bigint[]))
          GROUP BY c.id, i.departamento, i.localidad
          ORDER BY c.numero NULLS LAST, c.id`,
        [EstadoConcesion.VIGENTE, expedienteId, personaIds, EstadoDeuda.PENDIENTE],
      );
    return filas.map(({ tiene_deuda, ...c }) => ({ ...c, tieneDeuda: tiene_deuda }));
  }

  /**
   * La concesión tiene deuda: una deuda pendiente por cada titular vigente (si ya la tenía
   * marcada, no se duplica). Devuelve las que se registraron.
   */
  async marcarDeuda(tx: EntityManager, concesion: ConcesionConDeuda, expediente: Expediente, usuario: Usuario): Promise<Deuda[]> {
    if (await tx.existsBy(Deuda, { concesion: { id: concesion.id }, estado: EstadoDeuda.PENDIENTE })) return [];
    return tx.save(
      concesion.titulares.map((t) =>
        tx.create(Deuda, {
          persona: { id: t.personaId },
          concesion: { id: concesion.id },
          expediente,
          detalle: `Deuda de la concesión N° ${concesion.numero ?? concesion.id}`,
          monto: null,
          registradoPor: usuario,
        }),
      ),
    );
  }

  /** La concesión ya no tiene deuda: se cancelan sus deudas pendientes (y se reanudan los expedientes que esperaban). */
  async quitarDeuda(tx: EntityManager, concesion: ConcesionConDeuda, usuario: Usuario): Promise<string[]> {
    const pendientes = await tx.find(Deuda, { where: { concesion: { id: concesion.id }, estado: EstadoDeuda.PENDIENTE } });
    return this.cancelarEn(tx, pendientes, usuario, null, `Recaudación registró que la concesión N° ${concesion.numero ?? concesion.id} ya no tiene deuda.`);
  }

  listar(personaId?: string) {
    return this.dataSource.manager.find(Deuda, {
      where: personaId ? { persona: { id: personaId } } : { estado: EstadoDeuda.PENDIENTE },
      relations: { concesion: true },
      order: { creadoEn: 'DESC' },
      take: 500,
    });
  }

  /**
   * Recaudación registra el pago de una deuda:
   *   1. Solo un usuario de Recaudación.
   *   2. La deuda pasa a CANCELADA con quién, cuándo y el comprobante.
   *   3. Cada expediente EN_ESPERA en el que la persona es titular se reanuda si ya ninguno
   *      de sus titulares debe nada (queda EN_TRAMITE en Recaudación, que lo puede pasar).
   */
  async cancelar(deudaId: string, usuarioId: string, comprobante?: string) {
    const usuario = await this.usuarios.exigirDeOficina(usuarioId, Oficina.RECAUDACION);
    const reanudados = await this.dataSource.transaction(async (tx) => {
      const deuda = await tx.findOne(Deuda, { where: { id: deudaId }, lock: { mode: 'pessimistic_write', tables: ['rec_deuda'] } });
      if (!deuda) throw new NotFoundException('No se encontró la deuda.');
      if (deuda.estado === EstadoDeuda.CANCELADA) throw new ConflictException('La deuda ya estaba cancelada.');
      return this.cancelarEn(tx, [deuda], usuario, comprobante ?? null, `${nombrePersona(deuda.persona)} canceló la deuda. El expediente se reanuda.`);
    });
    return { deudaId, estado: EstadoDeuda.CANCELADA, expedientesReanudados: reanudados };
  }

  /**
   * Cancela deudas pendientes y reanuda los expedientes EN_ESPERA de sus personas en los que ya
   * ningún titular debe nada. Devuelve los ids de los expedientes reanudados.
   */
  private async cancelarEn(tx: EntityManager, deudas: Deuda[], usuario: Usuario, comprobante: string | null, motivo: string): Promise<string[]> {
    if (!deudas.length) return [];
    await tx.update(Deuda, { id: In(deudas.map((d) => d.id)) }, { estado: EstadoDeuda.CANCELADA, canceladoPor: { id: usuario.id }, canceladoEn: new Date(), comprobantePago: comprobante });

    // Expedientes en espera donde alguna de estas personas es titular, y los titulares de cada uno.
    const personaIds = [...new Set(deudas.map((d) => d.persona.id))];
    const filas: { expediente_id: string; personas: string[] }[] = await tx.query(
      `SELECT e.id AS expediente_id, array_agg(DISTINCT t.persona_id::text) AS personas
         FROM exp_expediente e
         JOIN con_concesion c ON c.expediente_id = e.id
         JOIN con_titular t   ON t.concesion_id = c.id
        WHERE e.estado = $1
          AND e.id IN (SELECT c2.expediente_id FROM con_concesion c2 JOIN con_titular t2 ON t2.concesion_id = c2.id WHERE t2.persona_id = ANY($2::bigint[]))
        GROUP BY e.id`,
      [EstadoExpediente.EN_ESPERA, personaIds],
    );

    const ids: string[] = [];
    for (const f of filas) {
      if ((await this.pendientesDe(tx, f.personas)).length) continue; // otro titular todavía debe
      const expediente = await this.expedientes.bloquear(tx, String(f.expediente_id));
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_TRAMITE, usuario);
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.DEUDA_CANCELADA,
        resultado: ResultadoActuacion.SIN_DEUDA,
        usuario,
        observaciones: motivo,
        datos: { deudas: deudas.map((d) => d.id), comprobante },
      });
      ids.push(expediente.id);
    }
    return ids;
  }
}
