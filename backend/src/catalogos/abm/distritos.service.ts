import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type FindOptionsWhere } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import type { BajaCatalogoDto, DistritoDto, FiltroCatalogoDto } from '../dto/abm-ubicaciones.dto.js';
import { Distrito } from '../entities/distrito.entity.js';
import { Localidad } from '../entities/localidad.entity.js';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, quitarBaja } from './abm-comun.js';

/**
 * ABM de distritos de riego (cat_distrito).
 *
 * - El código (número romano) es único.
 * - No se da de baja un distrito con localidades activas: primero se pasan a otro distrito.
 */
@Injectable()
export class DistritosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  async listar(filtro: FiltroCatalogoDto) {
    //1.- Por defecto solo los activos; con todas=true, también los dados de baja.
    const where: FindOptionsWhere<Distrito> = filtro.todas ? {} : { activo: true };
    const distritos = await this.dataSource.manager.find(Distrito, { where, order: { id: 'ASC' } });

    //2.- Con la cantidad de localidades activas de cada uno.
    const filas: { distrito_id: number; cantidad: string }[] = await this.dataSource.query(
      `SELECT distrito_id, count(*) AS cantidad FROM cat_localidad WHERE activo GROUP BY distrito_id`,
    );
    const cantidades = new Map(filas.map((f) => [Number(f.distrito_id), Number(f.cantidad)]));
    return distritos.map((d) => this.respuesta(d, cantidades.get(d.id) ?? 0));
  }

  async obtener(id: number) {
    const distrito = exigirExistente(await this.dataSource.manager.findOneBy(Distrito, { id }), `el distrito ${id}`);
    return this.respuesta(distrito, await this.localidadesActivas(id));
  }

  async crear(datos: DistritoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Se valida que el código no exista (activo o dado de baja).
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Distrito, { codigo: datos.codigo }), `el distrito ${datos.codigo}`);

    //3.- Se crea; si no se indica el nombre, «Distrito <código>».
    const distrito = this.dataSource.manager.create(Distrito, { codigo: datos.codigo, nombre: datos.nombre ?? `Distrito ${datos.codigo}`, creadoUsuarioId: usuario.id });
    return this.obtener((await this.guardar(distrito)).id);
  }

  async editar(id: number, datos: DistritoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activo; el código nuevo no lo puede tener otro distrito.
    const distrito = exigirExistente(await this.dataSource.manager.findOneBy(Distrito, { id }), `el distrito ${id}`);
    exigirActiva(distrito, `El distrito ${distrito.codigo}`);
    exigirClaveLibre(await this.dataSource.manager.findOneBy(Distrito, { codigo: datos.codigo }), `el distrito ${datos.codigo}`, id);

    //3.- Se guarda. Las localidades y concesiones lo guardan por id: muestran el código nuevo.
    Object.assign(distrito, { codigo: datos.codigo, nombre: datos.nombre ?? `Distrito ${datos.codigo}`, modificadoUsuarioId: usuario.id });
    await this.guardar(distrito);
    return this.obtener(id);
  }

  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir, estar activo y no tener localidades activas.
    const distrito = exigirExistente(await this.dataSource.manager.findOneBy(Distrito, { id }), `el distrito ${id}`);
    exigirActiva(distrito, `El distrito ${distrito.codigo}`);
    const activas = await this.localidadesActivas(id);
    if (activas) throw new ConflictException(`El distrito ${distrito.codigo} tiene ${activas} localidad(es) activa(s): primero páselas a otro distrito o délas de baja.`);

    //3.- Baja lógica con motivo, fecha y usuario.
    aplicarBaja(distrito, datos.motivo, usuario);
    await this.dataSource.manager.save(distrito);
    return this.obtener(id);
  }

  async reactivar(id: number, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar dado de baja.
    const distrito = exigirExistente(await this.dataSource.manager.findOneBy(Distrito, { id }), `el distrito ${id}`);
    if (distrito.activo) throw new ConflictException(`El distrito ${distrito.codigo} ya está activo.`);

    //3.- Vuelve a estar disponible.
    quitarBaja(distrito, usuario);
    await this.dataSource.manager.save(distrito);
    return this.obtener(id);
  }

  // ---------------------------------------------------------------------------

  private respuesta(d: Distrito, localidadesActivas: number) {
    return { id: d.id, codigo: d.codigo, nombre: d.nombre, localidadesActivas, ...estadoDeFila(d) };
  }

  private localidadesActivas(distritoId: number): Promise<number> {
    return this.dataSource.manager.countBy(Localidad, { distrito: { id: distritoId }, activo: true });
  }

  /** Guarda y traduce la violación del índice único (dos cargas simultáneas) a un 409. */
  private async guardar(distrito: Distrito): Promise<Distrito> {
    try {
      return await this.dataSource.manager.save(distrito);
    } catch (error) {
      if (esViolacionDeUnicidad(error, 'uk_distrito_codigo')) throw new ConflictException(`Ya existe el distrito ${distrito.codigo}.`);
      throw error;
    }
  }
}
