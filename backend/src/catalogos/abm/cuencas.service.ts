import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, ILike, type FindOptionsWhere } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { BajaCatalogoDto, FiltroCatalogoDto, NombreCatalogoDto } from '../dto/abm-ubicaciones.dto.js';
import { Cuenca } from '../entities/cuenca.entity.js';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, normalizarNombre, quitarBaja } from './abm-comun.js';

/**
 * ABM de cuencas hídricas (cat_cuenca).
 *
 * - El nombre es único (aunque la otra esté dada de baja).
 * - Se puede dar de baja aunque haya concesiones en esa cuenca: esas la conservan.
 */
@Injectable()
export class CuencasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  async listar(filtro: FiltroCatalogoDto) {
    //1.- Por defecto solo las activas; con todas=true, también las dadas de baja.
    const where: FindOptionsWhere<Cuenca> = {};
    if (!filtro.todas) where.activo = true;
    if (filtro.q) where.nombre = ILike(`%${normalizarNombre(filtro.q)}%`);
    const cuencas = await this.dataSource.manager.find(Cuenca, { where, order: { nombre: 'ASC' } });
    return cuencas.map((c) => this.respuesta(c));
  }

  async obtener(id: number) {
    return this.respuesta(exigirExistente(await this.dataSource.manager.findOneBy(Cuenca, { id }), `la cuenca ${id}`));
  }

  async crear(datos: NombreCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Se valida que el nombre no exista (activa o dada de baja).
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Cuenca, { nombre }), `la cuenca ${nombre}`);

    //3.- Se crea, a nombre de quien la carga.
    return this.respuesta(await this.guardar(this.dataSource.manager.create(Cuenca, { nombre, creadoUsuarioId: usuario.id })));
  }

  async editar(id: number, datos: NombreCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activa; el nombre nuevo no lo puede tener otra cuenca.
    const cuenca = exigirExistente(await this.dataSource.manager.findOneBy(Cuenca, { id }), `la cuenca ${id}`);
    exigirActiva(cuenca, `La cuenca ${cuenca.nombre}`);
    const nombre = normalizarNombre(datos.nombre);
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Cuenca, { nombre }), `la cuenca ${nombre}`, id);

    //3.- Se renombra (las concesiones la guardan por id: muestran el nombre nuevo).
    Object.assign(cuenca, { nombre, modificadoUsuarioId: usuario.id });
    return this.respuesta(await this.guardar(cuenca));
  }

  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activa.
    const cuenca = exigirExistente(await this.dataSource.manager.findOneBy(Cuenca, { id }), `la cuenca ${id}`);
    exigirActiva(cuenca, `La cuenca ${cuenca.nombre}`);

    //3.- Baja lógica con motivo, fecha y usuario.
    aplicarBaja(cuenca, datos.motivo, usuario);
    return this.respuesta(await this.dataSource.manager.save(cuenca));
  }

  async reactivar(id: number, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar dada de baja.
    const cuenca = exigirExistente(await this.dataSource.manager.findOneBy(Cuenca, { id }), `la cuenca ${id}`);
    if (cuenca.activo) throw new ConflictException(`La cuenca ${cuenca.nombre} ya está activa.`);

    //3.- Vuelve a estar disponible.
    quitarBaja(cuenca, usuario);
    return this.respuesta(await this.dataSource.manager.save(cuenca));
  }

  // ---------------------------------------------------------------------------

  private respuesta(c: Cuenca) {
    return { id: c.id, nombre: c.nombre, ...estadoDeFila(c) };
  }

  /** Guarda y traduce la violación del índice único (dos cargas simultáneas) a un 409. */
  private async guardar(cuenca: Cuenca): Promise<Cuenca> {
    try {
      return await this.dataSource.manager.save(cuenca);
    } catch (error) {
      if (esViolacionDeUnicidad(error, 'uk_cuenca_nombre')) throw new ConflictException(`Ya existe la cuenca ${cuenca.nombre}.`);
      throw error;
    }
  }
}
