import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, type EntityManager } from 'typeorm';
import type { UsuarioSesion } from './auth.decorators.js';
import { OficinaDrh } from './entities/oficina.entity.js';
import { PermisoDrh, RolPermiso, UsuarioPermiso } from './entities/permiso.entity.js';
import { RolDrh } from './entities/rol.entity.js';
import type { Usuario } from './entities/usuario.entity.js';
import { Permiso, permisoDeLaOficina } from './permisos.constantes.js';

/**
 * Qué puede hacer cada usuario: los permisos que le asignó Informática (seg_usuario_permiso),
 * solo los de su oficina (y los generales). Los roles son plantillas para precargarlos.
 */
@Injectable()
export class PermisosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RolPermiso) private readonly matriz: Repository<RolPermiso>,
    @InjectRepository(UsuarioPermiso) private readonly asignados: Repository<UsuarioPermiso>,
    @InjectRepository(RolDrh) private readonly roles: Repository<RolDrh>,
    @InjectRepository(PermisoDrh) private readonly permisos: Repository<PermisoDrh>,
    @InjectRepository(OficinaDrh) private readonly oficinas: Repository<OficinaDrh>,
  ) {}

  /** El administrador puede todo; el resto, lo asignado que corresponda a su oficina. */
  async permisosDe(u: Pick<Usuario, 'id' | 'esAdministrador' | 'oficina'>): Promise<string[]> {
    if (u.esAdministrador) return Object.values(Permiso);
    const filas = await this.asignados.findBy({ usuarioId: u.id });
    return filas.map((f) => f.permisoCodigo).filter((p) => permisoDeLaOficina(p, u.oficina?.codigo));
  }

  /** Lo asignado tal cual (para la pantalla de Informática). */
  async asignadosA(usuarioId: string): Promise<string[]> {
    return (await this.asignados.findBy({ usuarioId })).map((f) => f.permisoCodigo);
  }

  /** La plantilla de un rol en una oficina. */
  async plantilla(oficina: string, rol: string): Promise<string[]> {
    return (await this.matriz.findBy({ oficinaCodigo: oficina, rolCodigo: rol })).map((f) => f.permisoCodigo);
  }

  /** Exige que todos los permisos existan y se puedan asignar en esa oficina. */
  validarParaOficina(permisos: string[], oficina: string | null) {
    const desconocidos = permisos.filter((p) => !Object.values(Permiso).includes(p as Permiso));
    if (desconocidos.length) throw new BadRequestException(`Permisos desconocidos: ${desconocidos.join(', ')}.`);
    const deOtra = permisos.filter((p) => !permisoDeLaOficina(p, oficina));
    if (deOtra.length) throw new BadRequestException(`Estos permisos son de otra oficina: ${deOtra.join(', ')}.`);
  }

  /** Reemplaza los permisos de un usuario (dentro de la transacción del ABM). */
  async asignar(tx: EntityManager, usuarioId: string, permisos: string[]) {
    await tx.delete(UsuarioPermiso, { usuarioId });
    const unicos = [...new Set(permisos)];
    if (unicos.length) await tx.insert(UsuarioPermiso, unicos.map((permisoCodigo) => ({ usuarioId, permisoCodigo })));
  }

  async armarSesion(u: Usuario): Promise<UsuarioSesion> {
    return {
      id: u.id,
      legajo: u.legajo,
      apellido: u.apellido,
      nombre: u.nombre,
      email: u.email,
      oficina: u.oficina ? { codigo: u.oficina.codigo, nombre: u.oficina.nombre } : null,
      rol: u.rol ? { codigo: u.rol.codigo, nombre: u.rol.nombre } : null,
      esAdministrador: u.esAdministrador,
      debeCambiarClave: u.debeCambiarClave,
      permisos: await this.permisosDe(u),
    };
  }

  /** Para la pantalla «Roles y permisos»: oficinas, roles, permisos y qué está otorgado. */
  async obtenerMatriz() {
    const [oficinas, roles, permisos, otorgados] = await Promise.all([
      this.oficinas.find({ where: { activa: true }, order: { orden: 'ASC' } }),
      this.roles.find({ where: { activo: true }, order: { orden: 'ASC' } }),
      this.permisos.find({ order: { orden: 'ASC' } }),
      this.matriz.find(),
    ]);
    return {
      oficinas: oficinas.map((o) => ({ codigo: o.codigo, nombre: o.nombre })),
      roles: roles.map((r) => ({ codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion })),
      permisos: permisos.map((p) => ({ codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, grupo: p.grupo, oficina: p.oficina?.codigo ?? null })),
      otorgados: otorgados.map((o) => ({ oficina: o.oficinaCodigo, rol: o.rolCodigo, permiso: o.permisoCodigo })),
    };
  }

  /** Reemplaza la plantilla de un rol en una oficina (no cambia a los usuarios que ya existen). */
  async actualizar(oficina: string, rol: string, permisos: string[]) {
    const [hayOficina, hayRol, validos] = await Promise.all([
      this.oficinas.existsBy({ codigo: oficina }),
      this.roles.existsBy({ codigo: rol }),
      this.permisos.findBy({ codigo: In(permisos) }),
    ]);
    if (!hayOficina) throw new BadRequestException(`No existe la oficina ${oficina}.`);
    if (!hayRol) throw new BadRequestException(`No existe el rol ${rol}.`);
    const desconocidos = permisos.filter((p) => !validos.some((v) => v.codigo === p));
    if (desconocidos.length) throw new BadRequestException(`Permisos desconocidos: ${desconocidos.join(', ')}.`);
    this.validarParaOficina(permisos, oficina);

    await this.dataSource.transaction(async (tx) => {
      await tx.delete(RolPermiso, { oficinaCodigo: oficina, rolCodigo: rol });
      if (permisos.length) await tx.insert(RolPermiso, [...new Set(permisos)].map((permisoCodigo) => ({ oficinaCodigo: oficina, rolCodigo: rol, permisoCodigo })));
    });
    return this.obtenerMatriz();
  }
}
