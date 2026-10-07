import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, ILike, type FindOptionsWhere } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { BajaCatalogoDto, FiltroLocalidadesDto, LocalidadDto } from '../dto/abm-ubicaciones.dto.js';
import { Departamento } from '../entities/departamento.entity.js';
import { Distrito } from '../entities/distrito.entity.js';
import { Localidad } from '../entities/localidad.entity.js';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, normalizarNombre, quitarBaja } from './abm-comun.js';

/**
 * ABM de localidades (cat_localidad): para agregar las que falten (ej: «BELLA VISTA», Leales),
 * corregir nombres o pasarlas de distrito, y dar de baja las que no correspondan.
 *
 * - El nombre es único dentro del departamento (aunque la otra esté dada de baja).
 * - El departamento y el distrito tienen que existir y estar activos.
 * - Se puede dar de baja aunque haya concesiones que la usan: esas la conservan; lo que cambia
 *   es que deja de ofrecerse para las cargas nuevas. La respuesta dice cuántas la usan.
 */
@Injectable()
export class LocalidadesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  async listar(filtro: FiltroLocalidadesDto) {
    //1.- Filtros: departamento, distrito, texto; por defecto solo las activas.
    const where: FindOptionsWhere<Localidad> = {};
    if (!filtro.todas) where.activo = true;
    if (filtro.departamentoId) where.departamento = { id: filtro.departamentoId };
    if (filtro.distritoId) where.distrito = { id: filtro.distritoId };
    if (filtro.q) where.nombre = ILike(`%${normalizarNombre(filtro.q)}%`);
    const localidades = await this.dataSource.manager.find(Localidad, {
      where,
      relations: { departamento: true, distrito: true },
      order: { departamento: { nombre: 'ASC' }, nombre: 'ASC' },
    });

    //2.- Con cuántas concesiones vigentes la usan (ubicación o domicilio legal).
    const uso = await this.concesionesQueLaUsan(localidades.map((l) => l.id));
    return localidades.map((l) => this.respuesta(l, uso.get(l.id) ?? 0));
  }

  async obtener(id: number) {
    const localidad = exigirExistente(await this.buscar(id), `la localidad ${id}`);
    return this.respuesta(localidad, (await this.concesionesQueLaUsan([id])).get(id) ?? 0);
  }

  async crear(datos: LocalidadDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Se valida que el departamento y el distrito existan y estén activos.
    const { departamento, distrito } = await this.exigirDepartamentoYDistrito(datos.departamentoId, datos.distritoId);

    //3.- Se valida que el nombre no exista en ese departamento (activa o dada de baja).
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.buscarPorNombre(departamento.id, nombre), `la localidad ${nombre} en ${departamento.nombre}`);

    //4.- Se crea, a nombre de quien la carga.
    const localidad = await this.guardar(this.dataSource.manager.create(Localidad, { departamento, distrito, nombre, creadoUsuarioId: usuario.id }), nombre, departamento);
    return this.obtener(localidad.id);
  }

  async editar(id: number, datos: LocalidadDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activa.
    const localidad = exigirExistente(await this.buscar(id), `la localidad ${id}`);
    exigirActiva(localidad, `La localidad ${localidad.nombre}`);

    //3.- Se validan el departamento y el distrito nuevos, y que el nombre esté libre en ese departamento.
    const { departamento, distrito } = await this.exigirDepartamentoYDistrito(datos.departamentoId, datos.distritoId);
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.buscarPorNombre(departamento.id, nombre), `la localidad ${nombre} en ${departamento.nombre}`, id);

    //4.- Se guarda. Las concesiones la guardan por id: muestran el nombre nuevo. El distrito de
    //    cada concesión no cambia (se guardó aparte cuando se cargó).
    Object.assign(localidad, { departamento, distrito, nombre, modificadoUsuarioId: usuario.id });
    await this.guardar(localidad, nombre, departamento);
    return this.obtener(id);
  }

  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activa.
    const localidad = exigirExistente(await this.buscar(id), `la localidad ${id}`);
    exigirActiva(localidad, `La localidad ${localidad.nombre}`);

    //3.- Baja lógica con motivo, fecha y usuario. Las concesiones que ya la usan la conservan.
    aplicarBaja(localidad, datos.motivo, usuario);
    await this.dataSource.manager.save(localidad);
    return this.obtener(id);
  }

  async reactivar(id: number, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar dada de baja.
    const localidad = exigirExistente(await this.buscar(id), `la localidad ${id}`);
    if (localidad.activo) throw new ConflictException(`La localidad ${localidad.nombre} ya está activa.`);

    //3.- Se valida que su departamento y su distrito estén activos.
    exigirActiva(localidad.departamento, `El departamento ${localidad.departamento.nombre}`);
    exigirActiva(localidad.distrito, `El distrito ${localidad.distrito.codigo}`);

    //4.- Vuelve a ofrecerse en las cargas nuevas.
    quitarBaja(localidad, usuario);
    await this.dataSource.manager.save(localidad);
    return this.obtener(id);
  }

  // ---------------------------------------------------------------------------

  private respuesta(l: Localidad, concesionesVigentes: number) {
    return {
      id: l.id,
      nombre: l.nombre,
      departamento: { id: l.departamento.id, nombre: l.departamento.nombre },
      distrito: { id: l.distrito.id, codigo: l.distrito.codigo },
      /** Concesiones vigentes o en trámite que la usan en su ubicación o en el domicilio legal. */
      concesionesVigentes,
      ...estadoDeFila(l),
    };
  }

  private buscar(id: number) {
    return this.dataSource.manager.findOne(Localidad, { where: { id }, relations: { departamento: true, distrito: true } });
  }

  private buscarPorNombre(departamentoId: number, nombre: string) {
    return this.dataSource.manager.findOneBy(Localidad, { departamento: { id: departamentoId }, nombre });
  }

  private async exigirDepartamentoYDistrito(departamentoId: number, distritoId: number) {
    const departamento = exigirExistente(await this.dataSource.manager.findOneBy(Departamento, { id: departamentoId }), `el departamento ${departamentoId}`);
    exigirActiva(departamento, `El departamento ${departamento.nombre}`);
    const distrito = exigirExistente(await this.dataSource.manager.findOneBy(Distrito, { id: distritoId }), `el distrito ${distritoId}`);
    exigirActiva(distrito, `El distrito ${distrito.codigo}`);
    return { departamento, distrito };
  }

  /** Guarda y traduce la violación del índice único (dos cargas simultáneas) a un 409. */
  private async guardar(localidad: Localidad, nombre: string, departamento: Departamento): Promise<Localidad> {
    try {
      return await this.dataSource.manager.save(localidad);
    } catch (error) {
      if (esViolacionDeUnicidad(error, 'uk_localidad')) throw new ConflictException(`Ya existe la localidad ${nombre} en ${departamento.nombre}.`);
      throw error;
    }
  }

  /** Cuántas concesiones (no anuladas ni denegadas) usan cada localidad en lo vigente. */
  private async concesionesQueLaUsan(ids: number[]): Promise<Map<number, number>> {
    if (!ids.length) return new Map();
    const filas: { localidad_id: number; cantidad: string }[] = await this.dataSource.query(
      `SELECT u.localidad_id, count(DISTINCT u.concesion_id) AS cantidad
         FROM (SELECT localidad_id, concesion_id FROM con_inmueble  WHERE vigente AND localidad_id = ANY($1)
               UNION ALL
               SELECT localidad_id, concesion_id FROM con_domicilio WHERE vigente AND localidad_id = ANY($1)) u
         JOIN con_concesion c ON c.id = u.concesion_id
        WHERE c.estado NOT IN ('ANULADA', 'DENEGADA')
        GROUP BY u.localidad_id`,
      [ids],
    );
    return new Map(filas.map((f) => [Number(f.localidad_id), Number(f.cantidad)]));
  }
}
