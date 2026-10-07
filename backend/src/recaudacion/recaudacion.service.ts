import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { Expediente } from '../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Oficina, ResultadoActuacion, TipoActuacion } from '../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../expedientes/expedientes.service.js';
import { nombrePersona } from '../personas/entities/persona.entity.js';
import type { Usuario } from '../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../seguridad/usuarios.service.js';
import { Deuda, EstadoDeuda } from './entities/deuda.entity.js';

export interface NuevaDeuda {
  personaId: string;
  detalle: string;
  monto?: number;
}

/**
 * Deudas de los titulares. La deuda es de la persona: mientras tenga una pendiente, sus
 * expedientes quedan EN_ESPERA en Recaudación; al cancelarla se reanudan solos.
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
    return tx.find(Deuda, { where: { persona: { id: In(personaIds) }, estado: EstadoDeuda.PENDIENTE }, order: { creadoEn: 'ASC' } });
  }

  async registrar(tx: EntityManager, expediente: Expediente, deudas: NuevaDeuda[], usuario: Usuario): Promise<Deuda[]> {
    return tx.save(
      deudas.map((d) =>
        tx.create(Deuda, {
          persona: { id: d.personaId },
          expediente,
          detalle: d.detalle,
          monto: d.monto === undefined ? null : String(d.monto),
          registradoPor: usuario,
        }),
      ),
    );
  }

  listar(personaId?: string) {
    return this.dataSource.manager.find(Deuda, {
      where: personaId ? { persona: { id: personaId } } : { estado: EstadoDeuda.PENDIENTE },
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

      await tx.update(Deuda, deuda.id, { estado: EstadoDeuda.CANCELADA, canceladoPor: { id: usuario.id }, canceladoEn: new Date(), comprobantePago: comprobante ?? null });

      // Expedientes en espera donde esta persona es titular, y los titulares de cada uno.
      const filas: { expediente_id: string; personas: string[] }[] = await tx.query(
        `SELECT e.id AS expediente_id, array_agg(DISTINCT t.persona_id::text) AS personas
           FROM exp_expediente e
           JOIN con_concesion c ON c.expediente_id = e.id
           JOIN con_titular t   ON t.concesion_id = c.id
          WHERE e.estado = $1
            AND e.id IN (SELECT c2.expediente_id FROM con_concesion c2 JOIN con_titular t2 ON t2.concesion_id = c2.id WHERE t2.persona_id = $2)
          GROUP BY e.id`,
        [EstadoExpediente.EN_ESPERA, deuda.persona.id],
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
          observaciones: `${nombrePersona(deuda.persona)} canceló la deuda. El expediente se reanuda.`,
          datos: { deudaId: deuda.id, comprobante: comprobante ?? null },
        });
        ids.push(expediente.id);
      }
      return ids;
    });
    return { deudaId, estado: EstadoDeuda.CANCELADA, expedientesReanudados: reanudados };
  }
}
