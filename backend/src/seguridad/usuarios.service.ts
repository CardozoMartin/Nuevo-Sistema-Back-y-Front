import { ForbiddenException, Injectable, Logger, UnauthorizedException, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { cifrarClave } from './claves.js';
import { OficinaDrh } from './entities/oficina.entity.js';
import { PermisoDrh, RolPermiso, UsuarioPermiso } from './entities/permiso.entity.js';
import { RolDrh } from './entities/rol.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { MATRIZ_INICIAL, PERMISOS_INICIALES, Rol, ROLES_INICIALES } from './permisos.constantes.js';

/** Oficinas del circuito (mismos códigos que el enum Oficina de expedientes y que el frontend). */
const OFICINAS = [
  {
    codigo: 'catastro',
    nombre: 'Catastro',
    orden: 1,
    descripcion: 'Inicio de trámites, carga de datos y cierre de expedientes.',
    descripcionBandeja: 'Expedientes que volvieron a Catastro para el cierre del trámite.',
  },
  {
    codigo: 'recaudacion',
    nombre: 'Recaudación',
    orden: 2,
    descripcion: 'Verificación de deuda y pagos del expediente.',
    descripcionBandeja: 'Expedientes pendientes de verificación de deuda y pagos.',
  },
  {
    codigo: 'distrito',
    nombre: 'Distrito',
    orden: 3,
    descripcion: 'Inspección y dictamen técnico.',
    descripcionBandeja: 'Expedientes pendientes de inspección y dictamen técnico del distrito.',
  },
  {
    codigo: 'juridico',
    nombre: 'Jurídico',
    orden: 4,
    descripcion: 'Dictamen jurídico del expediente.',
    descripcionBandeja: 'Expedientes pendientes de dictamen jurídico.',
  },
  {
    codigo: 'secretaria_general',
    nombre: 'Secretaría General',
    orden: 5,
    descripcion: 'Resolución y firma.',
    descripcionBandeja: 'Expedientes pendientes de resolución.',
  },
  {
    codigo: 'pozos',
    nombre: 'Pozos',
    orden: 6,
    descripcion: 'Registro, baja y control de las perforaciones de agua subterránea.',
    descripcionBandeja: 'Trámites de pozos pendientes en la oficina.',
  },
];

/**
 * Usuarios iniciales. El 1 es «Sistema» (procesos automáticos e importaciones). Los demás son
 * usuarios de PRUEBA, uno por oficina, para probar el circuito hasta que exista el login.
 */
const USUARIOS = [
  { legajo: 'SISTEMA', apellido: 'Sistema', nombre: 'DRH', email: 'sistema@drh.local', oficina: null, rol: null, esAdministrador: true },
  { legajo: 'DEMO-CAT', apellido: 'Prueba', nombre: 'Catastro', email: 'catastro@drh.local', oficina: 'catastro', rol: Rol.JEFE, esAdministrador: false },
  { legajo: 'DEMO-REC', apellido: 'Prueba', nombre: 'Recaudación', email: 'recaudacion@drh.local', oficina: 'recaudacion', rol: Rol.JEFE, esAdministrador: false },
  { legajo: 'DEMO-DIS', apellido: 'Prueba', nombre: 'Distrito', email: 'distrito@drh.local', oficina: 'distrito', rol: Rol.JEFE, esAdministrador: false },
  { legajo: 'DEMO-JUR', apellido: 'Prueba', nombre: 'Jurídico', email: 'juridico@drh.local', oficina: 'juridico', rol: Rol.JEFE, esAdministrador: false },
  { legajo: 'DEMO-SEC', apellido: 'Prueba', nombre: 'Secretaría', email: 'secretaria@drh.local', oficina: 'secretaria_general', rol: Rol.JEFE, esAdministrador: false },
  { legajo: 'DEMO-POZ', apellido: 'Prueba', nombre: 'Pozos', email: 'pozos@drh.local', oficina: 'pozos', rol: Rol.JEFE, esAdministrador: false },
];

/** Administrador inicial: se crea si se define ADMIN_CLAVE_INICIAL en el .env (entra y la cambia). */
const ADMIN = { legajo: 'ADMIN', apellido: 'Administrador', nombre: 'DRH', email: 'admin@drh.local', esAdministrador: true };

@Injectable()
export class UsuariosService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(OficinaDrh) private readonly oficinas: Repository<OficinaDrh>,
    @InjectRepository(RolDrh) private readonly roles: Repository<RolDrh>,
    @InjectRepository(PermisoDrh) private readonly permisos: Repository<PermisoDrh>,
    @InjectRepository(RolPermiso) private readonly matriz: Repository<RolPermiso>,
    @InjectRepository(UsuarioPermiso) private readonly usuarioPermisos: Repository<UsuarioPermiso>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Al arrancar: carga las oficinas y los usuarios iniciales que falten. Así una oficina
   * nueva (ej: Pozos) aparece también en una base que ya tenía las demás.
   */
  onApplicationBootstrap(): Promise<void> {
    return this.cargaInicial();
  }

  private carga?: Promise<void>;

  /**
   * La carga inicial se hace una sola vez; otros módulos la esperan antes de sembrar tablas que
   * apuntan a seg_oficina o seg_usuario (ej: cat_etapa), sin importar qué módulo arranca primero.
   */
  cargaInicial(): Promise<void> {
    return (this.carga ??= this.cargarOficinasYUsuarios());
  }

  private async cargarOficinasYUsuarios() {
    const oficinas = new Map((await this.oficinas.find()).map((o) => [o.codigo, o]));
    const oficinasNuevas = OFICINAS.filter((o) => !oficinas.has(o.codigo));
    if (oficinasNuevas.length) {
      await this.oficinas.save(oficinasNuevas);
      this.logger.log(`Oficinas cargadas: ${oficinasNuevas.map((o) => o.nombre).join(', ')}.`);
    }
    // Bases creadas antes de que existieran las descripciones: se completan sin pisar lo editado.
    for (const o of OFICINAS) {
      const actual = oficinas.get(o.codigo);
      if (actual && actual.descripcion === null) await this.oficinas.update(o.codigo, { descripcion: o.descripcion, descripcionBandeja: o.descripcionBandeja });
    }
    await this.cargarRolesYPermisos();

    // Se insertan en orden para que «Sistema» quede con id 1 (lo usa USUARIO_SISTEMA).
    const existentes = await this.usuarios.find();
    const legajos = new Set(existentes.map((u) => u.legajo));
    const usuariosNuevos = USUARIOS.filter((u) => !legajos.has(u.legajo));
    for (const u of usuariosNuevos) {
      await this.usuarios.save(this.usuarios.create({ ...u, oficina: u.oficina ? { codigo: u.oficina } : null, rol: u.rol ? { codigo: u.rol } : null }));
    }
    if (usuariosNuevos.length) this.logger.log(`Usuarios de prueba cargados: ${usuariosNuevos.map((u) => u.legajo).join(', ')}.`);
    // Bases anteriores al login: los usuarios de prueba toman su rol.
    for (const u of USUARIOS) {
      const actual = existentes.find((e) => e.legajo === u.legajo);
      if (actual && !actual.rol && u.rol) await this.usuarios.update(actual.id, { rol: { codigo: u.rol } });
    }
    await this.cargarClavesIniciales();
    await this.iniciarPermisosDeUsuarios();
  }

  /** Roles, permisos y la matriz inicial (esta solo si está vacía: después la edita el administrador). */
  private async cargarRolesYPermisos() {
    const roles = new Set((await this.roles.find()).map((r) => r.codigo));
    const codigosRol = Object.keys(ROLES_INICIALES);
    const rolesNuevos = Object.entries(ROLES_INICIALES).filter(([codigo]) => !roles.has(codigo));
    if (rolesNuevos.length) await this.roles.save(rolesNuevos.map(([codigo, r]) => ({ codigo, ...r, orden: codigosRol.indexOf(codigo) })));

    // Permisos: los define el código (nombre, descripción, oficina, grupo y orden); se agregan los
    // nuevos y se actualizan los existentes.
    const existentes = new Set((await this.permisos.find()).map((p) => p.codigo));
    const codigosPermiso = Object.keys(PERMISOS_INICIALES);
    const nuevos: string[] = [];
    for (const [codigo, p] of Object.entries(PERMISOS_INICIALES)) {
      await this.permisos.save({ codigo, nombre: p.nombre, descripcion: p.descripcion, grupo: p.grupo, orden: codigosPermiso.indexOf(codigo), oficina: p.oficina ? { codigo: p.oficina } : null });
      if (!existentes.has(codigo)) nuevos.push(codigo);
    }
    if (nuevos.length) this.logger.log(`Permisos cargados: ${nuevos.join(', ')}.`);

    // Plantillas por rol: completas si la tabla está vacía; si no, solo las filas de los permisos nuevos.
    const plantillaVacia = !(await this.matriz.count());
    const filas = MATRIZ_INICIAL.filter((m) => plantillaVacia || nuevos.includes(m.permiso));
    if (filas.length) {
      await this.matriz.save(filas.map((m) => ({ oficinaCodigo: m.oficina, rolCodigo: m.rol, permisoCodigo: m.permiso })));
      this.logger.log(`Plantillas por rol: ${filas.length} permisos agregados.`);
    }
  }

  /**
   * Usuarios que todavía no tienen permisos propios (los anteriores a los permisos por usuario):
   * se les copia una sola vez la plantilla de su rol en su oficina. Después los edita Informática.
   */
  private async iniciarPermisosDeUsuarios() {
    const pendientes = await this.usuarios.findBy({ permisosIniciados: false });
    for (const u of pendientes) {
      if (!u.esAdministrador && u.oficina && u.rol) {
        const plantilla = await this.matriz.findBy({ oficinaCodigo: u.oficina.codigo, rolCodigo: u.rol.codigo });
        if (plantilla.length) await this.usuarioPermisos.save(plantilla.map((p) => ({ usuarioId: u.id, permisoCodigo: p.permisoCodigo })));
      }
      await this.usuarios.update(u.id, { permisosIniciados: true });
    }
    if (pendientes.length) this.logger.log(`Permisos iniciales (plantilla de su rol) para: ${pendientes.map((u) => u.legajo).join(', ')}.`);
  }

  /**
   * Contraseñas iniciales, solo si se configuran en el .env (nunca en el código):
   *   ADMIN_CLAVE_INICIAL   crea el usuario ADMIN (administrador); la cambia al entrar.
   *   CLAVE_USUARIOS_PRUEBA solo desarrollo: contraseña de los usuarios de prueba (DEMO-*) que no tienen.
   */
  private async cargarClavesIniciales() {
    const claveAdmin = this.config.get<string>('ADMIN_CLAVE_INICIAL');
    if (claveAdmin && !(await this.usuarios.existsBy({ legajo: ADMIN.legajo }))) {
      await this.usuarios.save(this.usuarios.create({ ...ADMIN, claveHash: await cifrarClave(claveAdmin), debeCambiarClave: true }));
      this.logger.log(`Usuario administrador creado: ${ADMIN.legajo} (cambia la contraseña al entrar).`);
    }

    const clavePrueba = this.config.get<string>('CLAVE_USUARIOS_PRUEBA');
    if (!clavePrueba || this.config.get<string>('NODE_ENV') === 'production') return;
    const sinClave = await this.usuarios.find({ select: { id: true, legajo: true, claveHash: true }, where: { legajo: Like('DEMO-%'), claveHash: IsNull() } });
    for (const u of sinClave) await this.usuarios.update(u.id, { claveHash: await cifrarClave(clavePrueba), debeCambiarClave: false });
    if (sinClave.length) this.logger.warn(`Usuarios de prueba con la contraseña de CLAVE_USUARIOS_PRUEBA: ${sinClave.map((u) => u.legajo).join(', ')}.`);
  }

  listar(): Promise<Usuario[]> {
    return this.usuarios.find({ where: { activo: true }, order: { id: 'ASC' } });
  }

  async obtener(id: string): Promise<Usuario> {
    const usuario = /^\d+$/.test(id) ? await this.usuarios.findOneBy({ id, activo: true }) : null;
    if (!usuario) throw new UnauthorizedException(`El usuario ${id} no existe o está inactivo.`);
    return usuario;
  }

  /**
   * Exige que el usuario pueda actuar en la oficina indicada: tiene que trabajar ahí
   * (o ser administrador). Devuelve el usuario para dejarlo registrado.
   */
  async exigirDeOficina(id: string, oficina: string): Promise<Usuario> {
    const usuario = await this.obtener(id);
    if (!usuario.esAdministrador && usuario.oficina?.codigo !== oficina) {
      const nombre = OFICINAS.find((o) => o.codigo === oficina)?.nombre ?? oficina;
      throw new ForbiddenException(`El expediente está en ${nombre}: solo puede actuar un usuario de esa oficina.`);
    }
    return usuario;
  }
}
