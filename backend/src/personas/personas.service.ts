import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { dniDeDocumento } from '../comun/validadores/cuit.js';
import { TipoPersona, type TipoDocumento } from '../concesiones/concesiones.constantes.js';
import { Persona } from './entities/persona.entity.js';

/** Datos de una persona como los carga el formulario de titulares. */
export interface DatosPersona {
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  documento: string;
  apellido?: string;
  nombre?: string;
  fechaNacimiento?: string;
  razonSocial?: string;
  fechaConstitucion?: string;
  email?: string;
  telefono?: string;
}

@Injectable()
export class PersonasService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * La persona con ese documento o, si es una persona física, la cargada con el documento
   * equivalente: un DNI encuentra a quien está con su CUIL / CUIT y al revés (el CUIL lleva
   * el DNI en el medio). Así no se crea dos veces a la misma persona.
   *
   * Si hubiera más de una (duplicados de antes), gana la del documento exacto y después la que
   * tiene CUIL / CUIT (el dato más completo).
   */
  async buscarEquivalente(manager: EntityManager, documento: string, tipoPersona?: TipoPersona): Promise<Persona | null> {
    const dni = tipoPersona === TipoPersona.JURIDICA ? null : dniDeDocumento(documento);
    const consulta = manager.createQueryBuilder(Persona, 'p').where('p.documento = :documento', { documento });
    if (dni) {
      consulta.orWhere(
        `(p.tipo_persona = :fisica AND
          CASE WHEN p.documento ~ '^[0-9]{7,8}$' THEN ltrim(p.documento, '0')
               WHEN p.documento ~ '^(20|23|24|27)[0-9]{9}$' THEN ltrim(substr(p.documento, 3, 8), '0')
          END = :dni)`,
        { fisica: TipoPersona.FISICA, dni },
      );
    }
    const encontradas = await consulta.getMany();
    const prioridad = (p: Persona) => (p.documento === documento ? 0 : p.documento?.length === 11 ? 1 : 2);
    return encontradas.sort((a, b) => prioridad(a) - prioridad(b) || Number(a.id) - Number(b.id))[0] ?? null;
  }

  /**
   * Busca una persona por documento (o su equivalente DNI ↔ CUIL / CUIT) y devuelve sus datos,
   * las concesiones de las que es titular (vigente) y sus deudas pendientes. Es lo que usa el
   * formulario para autocompletar un titular que ya está cargado. 404 si no existe.
   */
  async buscarPorDocumento(documento: string) {
    const persona = await this.buscarEquivalente(this.dataSource.manager, documento);
    if (!persona) throw new NotFoundException('No hay ninguna persona cargada con ese documento.');

    const concesiones: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT c.id, c.numero, c.estado, i.departamento, i.localidad,
              e.numero || '/' || e.reparticion || '-' || e.anio AS expediente
         FROM con_titular t
         JOIN con_concesion c ON c.id = t.concesion_id
         LEFT JOIN con_v_inmueble i ON i.concesion_id = c.id
         LEFT JOIN exp_expediente e ON e.id = c.expediente_id
        WHERE t.persona_id = $1 AND t.vigente
        ORDER BY c.id`,
      [persona.id],
    );
    const deudas: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT id, detalle, monto, creado_en FROM rec_deuda WHERE persona_id = $1 AND estado = 'PENDIENTE' ORDER BY creado_en`,
      [persona.id],
    );

    const { creadoUsuarioId: _c, modificadoUsuarioId: _m, ...datos } = persona;
    return {
      persona: datos,
      concesiones: concesiones.map((c) => ({ ...c, id: String(c.id) })),
      deudasPendientes: deudas.map((d) => ({ ...d, id: String(d.id), monto: d.monto === null ? null : Number(d.monto) })),
    };
  }

  /**
   * Alta o actualización de la persona por documento (dentro de la transacción del trámite):
   *   1. Si no existe, se crea.
   *   2. Si existe, se actualizan sus datos con los últimos declarados (el formulario los
   *      precargó desde la ficha, así que lo que llega es lo vigente).
   *   3. Una persona física no puede pasar a ser jurídica ni al revés con el mismo documento.
   *   4. Si estaba con DNI y ahora llega su CUIL / CUIT, se le guarda el CUIL / CUIT; si
   *      estaba con CUIL / CUIT y llega el DNI, se queda con el CUIL / CUIT (no se pierde dato).
   */
  async guardar(tx: EntityManager, d: DatosPersona, usuarioId: string): Promise<Persona> {
    const fisica = d.tipoPersona === TipoPersona.FISICA;
    const datos = {
      tipoPersona: d.tipoPersona,
      tipoDocumento: d.tipoDocumento,
      documento: d.documento,
      apellido: fisica ? (d.apellido ?? null) : null,
      nombre: fisica ? (d.nombre ?? null) : null,
      fechaNacimiento: fisica ? (d.fechaNacimiento ?? null) : null,
      razonSocial: fisica ? null : (d.razonSocial ?? null),
      fechaConstitucion: fisica ? null : (d.fechaConstitucion ?? null),
      email: d.email ?? null,
      telefono: d.telefono ?? null,
    };

    const existente = await this.buscarEquivalente(tx, d.documento, d.tipoPersona);
    if (!existente) return tx.save(tx.create(Persona, { ...datos, creadoUsuarioId: usuarioId }));
    if (existente.documento?.length === 11 && d.documento.length < 11) {
      datos.documento = existente.documento;
      datos.tipoDocumento = existente.tipoDocumento!;
    }

    if (existente.tipoPersona !== d.tipoPersona) {
      throw new ConflictException(
        `El documento ${d.documento} ya está cargado como persona ${existente.tipoPersona === TipoPersona.FISICA ? 'física' : 'jurídica'}.`,
      );
    }
    await tx.update(Persona, existente.id, { ...datos, modificadoUsuarioId: usuarioId });
    return tx.findOneByOrFail(Persona, { id: existente.id });
  }
}
