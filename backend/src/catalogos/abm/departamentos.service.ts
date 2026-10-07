import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, ILike, type EntityManager, type FindOptionsWhere } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { BajaCatalogoDto, FiltroCatalogoDto, NombreCatalogoDto } from '../dto/abm-ubicaciones.dto.js';
import { Departamento } from '../entities/departamento.entity.js';
import { Localidad } from '../entities/localidad.entity.js';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, normalizarNombre, quitarBaja } from './abm-comun.js';

/**
 * ABM de departamentos (cat_departamento).
 *
 * - El nombre es único (aunque el otro esté dado de baja).
 * - No se da de baja un departamento con localidades activas: primero se dan de baja (o se
 *   pasan a otro departamento) sus localidades.
 */
@Injectable()
export class DepartamentosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  async listar(filtro: FiltroCatalogoDto) {
    //1.- Por defecto solo los activos; con todas=true, también los dados de baja.
    const where: FindOptionsWhere<Departamento> = {};
    if (!filtro.todas) where.activo = true;
    if (filtro.q) where.nombre = ILike(`%${normalizarNombre(filtro.q)}%`);
    const departamentos = await this.dataSource.manager.find(Departamento, { where, order: { nombre: 'ASC' } });

    //2.- Con la cantidad de localidades activas de cada uno.
    const cantidades = await this.localidadesActivasPorDepartamento();
    return departamentos.map((d) => this.respuesta(d, cantidades.get(d.id) ?? 0));
  }

  async obtener(id: number) {
    const departamento = exigirExistente(await this.dataSource.manager.findOneBy(Departamento, { id }), `el departamento ${id}`);
    return this.respuesta(departamento, await this.contarLocalidadesActivas(this.dataSource.manager, id));
  }

  async crear(datos: NombreCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Se valida que el nombre no exista (activo o dado de baja).
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Departamento, { nombre }), `el departamento ${nombre}`);

    //3.- Se crea, a nombre de quien lo carga.
    const departamento = await this.guardar(this.dataSource.manager.create(Departamento, { nombre, creadoUsuarioId: usuario.id }), nombre);
    return this.respuesta(departamento, 0);
  }

  async editar(id: number, datos: NombreCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activo.
    const departamento = exigirExistente(await this.dataSource.manager.findOneBy(Departamento, { id }), `el departamento ${id}`);
    exigirActiva(departamento, `El departamento ${departamento.nombre}`);

    //3.- Se valida que el nombre nuevo no lo tenga otro departamento.
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Departamento, { nombre }), `el departamento ${nombre}`, id);

    //4.- Se renombra. Las concesiones lo guardan por id: todas pasan a mostrar el nombre nuevo.
    departamento.nombre = nombre;
    departamento.modificadoUsuarioId = usuario.id;
    await this.guardar(departamento, nombre);
    return this.obtener(id);
  }

  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    await this.dataSource.transaction(async (tx) => {
      //2.- Tiene que existir y estar activo.
      const departamento = exigirExistente(await tx.findOne(Departamento, { where: { id }, lock: { mode: 'pessimistic_write' } }), `el departamento ${id}`);
      exigirActiva(departamento, `El departamento ${departamento.nombre}`);

      //3.- Se valida que no le queden localidades activas.
      const activas = await this.contarLocalidadesActivas(tx, id);
      if (activas) {
        throw new ConflictException(`El departamento ${departamento.nombre} tiene ${activas} localidad(es) activa(s): primero dé de baja o pase a otro departamento sus localidades.`);
      }

      //4.- Baja lógica con motivo, fecha y usuario.
      aplicarBaja(departamento, datos.motivo, usuario);
      await tx.save(departamento);
    });
    return this.obtener(id);
  }

  async reactivar(id: number, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar dado de baja.
    const departamento = exigirExistente(await this.dataSource.manager.findOneBy(Departamento, { id }), `el departamento ${id}`);
    if (departamento.activo) throw new ConflictException(`El departamento ${departamento.nombre} ya está activo.`);

    //3.- Vuelve a estar disponible (sus localidades se reactivan una por una, si corresponde).
    quitarBaja(departamento, usuario);
    await this.dataSource.manager.save(departamento);
    return this.obtener(id);
  }

  // ---------------------------------------------------------------------------

  private respuesta(d: Departamento, localidadesActivas: number) {
    return { id: d.id, nombre: d.nombre, localidadesActivas, ...estadoDeFila(d) };
  }

  /** Guarda y traduce la violación del índice único (dos cargas simultáneas) a un 409. */
  private async guardar(departamento: Departamento, nombre: string): Promise<Departamento> {
    try {
      return await this.dataSource.manager.save(departamento);
    } catch (error) {
      if (esViolacionDeUnicidad(error, 'uk_departamento_nombre')) throw new ConflictException(`Ya existe el departamento ${nombre}.`);
      throw error;
    }
  }

  private contarLocalidadesActivas(tx: EntityManager, departamentoId: number): Promise<number> {
    return tx.countBy(Localidad, { departamento: { id: departamentoId }, activo: true });
  }

  private async localidadesActivasPorDepartamento(): Promise<Map<number, number>> {
    const filas: { departamento_id: number; cantidad: string }[] = await this.dataSource.query(
      `SELECT departamento_id, count(*) AS cantidad FROM cat_localidad WHERE activo GROUP BY departamento_id`,
    );
    return new Map(filas.map((f) => [Number(f.departamento_id), Number(f.cantidad)]));
  }
}
