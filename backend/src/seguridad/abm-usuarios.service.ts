import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Not, Repository } from 'typeorm';
import { USUARIO_SISTEMA } from '../comun/usuario-sistema.js';
import { AuthService } from './auth.service.js';
import { cifrarClave, claveTemporal } from './claves.js';
import { permisoDeLaOficina } from './permisos.constantes.js';
import type { BajaUsuarioDto, ListarUsuariosQuery, UsuarioDto } from './dto/seguridad.dto.js';
import { OficinaDrh } from './entities/oficina.entity.js';
import { RolDrh } from './entities/rol.entity.js';
import { UsuarioPermiso } from './entities/permiso.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PermisosService } from './permisos.service.js';

const comoListado = (u: Usuario, permisos: string[] = []) => ({
  id: u.id,
  legajo: u.legajo,
  apellido: u.apellido,
  nombre: u.nombre,
  email: u.email,
  oficina: u.oficina ? { codigo: u.oficina.codigo, nombre: u.oficina.nombre } : null,
  rol: u.rol ? { codigo: u.rol.codigo, nombre: u.rol.nombre } : null,
  esAdministrador: u.esAdministrador,
  activo: u.activo,
  debeCambiarClave: u.debeCambiarClave,
  bloqueadoHasta: u.bloqueadoHasta && u.bloqueadoHasta > new Date() ? u.bloqueadoHasta : null,
  ultimoAcceso: u.ultimoAcceso,
  bajaMotivo: u.bajaMotivo,
  bajaEn: u.bajaEn,
  /** El usuario «Sistema» firma los procesos automáticos: no se edita ni entra al sistema. */
  esSistema: u.id === USUARIO_SISTEMA,
  /** Lo asignado (el administrador puede todo igual). */
  permisos,
});

/**
 * ABM de usuarios (solo administradores). Nada se borra: la baja es lógica y cierra las
 * sesiones abiertas. La contraseña nunca la elige el administrador: se genera una temporal que
 * se muestra una sola vez y el usuario la cambia al entrar.
 */
@Injectable()
export class AbmUsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(OficinaDrh) private readonly oficinas: Repository<OficinaDrh>,
    @InjectRepository(RolDrh) private readonly roles: Repository<RolDrh>,
    @InjectRepository(UsuarioPermiso) private readonly asignados: Repository<UsuarioPermiso>,
    private readonly auth: AuthService,
    private readonly permisos: PermisosService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(q: ListarUsuariosQuery) {
    const consulta = this.usuarios.createQueryBuilder('u').leftJoinAndSelect('u.oficina', 'oficina').leftJoinAndSelect('u.rol', 'rol');
    if (q.texto) {
      const t = `%${q.texto.replace(/[%_\\]/g, '\\$&')}%`;
      consulta.andWhere(new Brackets((w) => w.where('u.legajo ILIKE :t OR u.apellido ILIKE :t OR u.nombre ILIKE :t OR u.email ILIKE :t', { t })));
    }
    if (q.oficina) consulta.andWhere('oficina.codigo = :oficina', { oficina: q.oficina });
    if (q.estado !== 'todos') consulta.andWhere('u.activo = :activo', { activo: q.estado !== 'baja' });
    const filas = await consulta.orderBy('u.apellido', 'ASC').addOrderBy('u.nombre', 'ASC').getMany();
    const asignados = filas.length ? await this.asignados.createQueryBuilder('p').where('p.usuario_id IN (:...ids)', { ids: filas.map((u) => u.id) }).getMany() : [];
    return filas.map((u) => comoListado(u, asignados.filter((a) => a.usuarioId === u.id).map((a) => a.permisoCodigo)));
  }

  async obtener(id: string) {
    const usuario = await this.exigir(id);
    return comoListado(usuario, await this.permisos.asignadosA(id));
  }

  async crear(dto: UsuarioDto, adminId: string) {
    const datos = await this.validar(dto);
    const permisos = await this.permisosPara(dto, datos);
    const clave = claveTemporal();
    const id = await this.dataSource.transaction(async (tx) => {
      const usuario = await tx.save(tx.create(Usuario, { ...datos, claveHash: await cifrarClave(clave), debeCambiarClave: true, permisosIniciados: true, creadoUsuarioId: adminId }));
      await this.permisos.asignar(tx, usuario.id, permisos);
      return usuario.id;
    });
    return { usuario: await this.obtener(id), claveTemporal: clave };
  }

  async actualizar(id: string, dto: UsuarioDto, adminId: string) {
    const actual = await this.exigirEditable(id);
    const datos = await this.validar(dto, id);
    if (actual.id === adminId && actual.esAdministrador && !datos.esAdministrador) {
      throw new BadRequestException('No puede quitarse a sí mismo el rol de administrador.');
    }
    // Si cambió la oficina o el rol y no mandaron permisos, vuelve a la plantilla del rol nuevo.
    const cambioDePuesto = actual.oficina?.codigo !== datos.oficina?.codigo || actual.rol?.codigo !== datos.rol?.codigo;
    const permisos = dto.permisos || cambioDePuesto ? await this.permisosPara(dto, datos) : (await this.permisos.asignadosA(id)).filter((p) => permisoDeLaOficina(p, datos.oficina?.codigo));
    await this.dataSource.transaction(async (tx) => {
      await tx.save(Usuario, { id, ...datos, modificadoUsuarioId: adminId });
      await this.permisos.asignar(tx, id, permisos);
    });
    return this.obtener(id);
  }

  async baja(id: string, { motivo }: BajaUsuarioDto, adminId: string) {
    const usuario = await this.exigirEditable(id);
    if (usuario.id === adminId) throw new BadRequestException('No puede darse de baja a sí mismo.');
    if (!usuario.activo) throw new ConflictException('El usuario ya está dado de baja.');
    await this.usuarios.update(id, { activo: false, bajaMotivo: motivo, bajaEn: new Date(), bajaUsuarioId: adminId, modificadoUsuarioId: adminId });
    await this.auth.cerrarSesionesDe(id);
    return this.obtener(id);
  }

  async reactivar(id: string, adminId: string) {
    const usuario = await this.exigirEditable(id);
    if (usuario.activo) throw new ConflictException('El usuario ya está activo.');
    await this.usuarios.update(id, { activo: true, bajaMotivo: null, bajaEn: null, bajaUsuarioId: null, modificadoUsuarioId: adminId });
    return this.obtener(id);
  }

  /** Contraseña temporal nueva (se muestra una vez); desbloquea y cierra las sesiones abiertas. */
  async restablecerClave(id: string, adminId: string) {
    const usuario = await this.exigirEditable(id);
    if (!usuario.activo) throw new ConflictException('Reactive el usuario antes de restablecer la contraseña.');
    const clave = claveTemporal();
    await this.usuarios.update(id, { claveHash: await cifrarClave(clave), debeCambiarClave: true, intentosFallidos: 0, bloqueadoHasta: null, modificadoUsuarioId: adminId });
    await this.auth.cerrarSesionesDe(id);
    return { usuario: await this.obtener(id), claveTemporal: clave };
  }

  // --- Ayudas ---------------------------------------------------------------------

  /** Los permisos que mandó el administrador (validados para la oficina) o la plantilla del rol. */
  private async permisosPara(dto: UsuarioDto, datos: { oficina: { codigo: string } | null; rol: { codigo: string } | null; esAdministrador: boolean }) {
    const oficina = datos.oficina?.codigo ?? null;
    if (dto.permisos) {
      this.permisos.validarParaOficina(dto.permisos, oficina);
      return dto.permisos;
    }
    return oficina && datos.rol ? this.permisos.plantilla(oficina, datos.rol.codigo) : [];
  }

  private async exigir(id: string) {
    const usuario = /^\d+$/.test(id) ? await this.usuarios.findOneBy({ id }) : null;
    if (!usuario) throw new NotFoundException(`No existe el usuario ${id}.`);
    return usuario;
  }

  private async exigirEditable(id: string) {
    if (id === USUARIO_SISTEMA) throw new BadRequestException('El usuario Sistema no se puede modificar.');
    return this.exigir(id);
  }

  /** Legajo y email únicos; oficina y rol existentes (un administrador puede no tener oficina). */
  private async validar(dto: UsuarioDto, id?: string) {
    const otro = id ? { id: Not(id) } : {};
    if (await this.usuarios.exists({ where: [{ ...otro, legajo: dto.legajo.toUpperCase() }] })) throw new ConflictException(`Ya existe un usuario con el legajo ${dto.legajo}.`);
    if (await this.usuarios.exists({ where: [{ ...otro, email: dto.email.toLowerCase() }] })) throw new ConflictException(`Ya existe un usuario con el email ${dto.email}.`);

    const oficina = dto.oficina ? await this.oficinas.findOneBy({ codigo: dto.oficina, activa: true }) : null;
    if (dto.oficina && !oficina) throw new BadRequestException(`No existe la oficina ${dto.oficina}.`);
    const rol = dto.rol ? await this.roles.findOneBy({ codigo: dto.rol, activo: true }) : null;
    if (dto.rol && !rol) throw new BadRequestException(`No existe el rol ${dto.rol}.`);
    if (!dto.esAdministrador && (!oficina || !rol)) throw new BadRequestException('Elija la oficina y el rol del usuario.');

    return {
      legajo: dto.legajo.toUpperCase(),
      apellido: dto.apellido,
      nombre: dto.nombre,
      email: dto.email.toLowerCase(),
      esAdministrador: dto.esAdministrador ?? false,
      oficina,
      rol,
    };
  }
}
