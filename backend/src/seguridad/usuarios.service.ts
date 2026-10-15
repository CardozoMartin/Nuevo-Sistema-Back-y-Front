import { ForbiddenException, Injectable, Logger, UnauthorizedException, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OficinaDrh } from './entities/oficina.entity.js';
import { Usuario } from './entities/usuario.entity.js';

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
  { legajo: 'SISTEMA', apellido: 'Sistema', nombre: 'DRH', email: 'sistema@drh.local', oficina: null, esAdministrador: true },
  { legajo: 'DEMO-CAT', apellido: 'Prueba', nombre: 'Catastro', email: 'catastro@drh.local', oficina: 'catastro', esAdministrador: false },
  { legajo: 'DEMO-REC', apellido: 'Prueba', nombre: 'Recaudación', email: 'recaudacion@drh.local', oficina: 'recaudacion', esAdministrador: false },
  { legajo: 'DEMO-DIS', apellido: 'Prueba', nombre: 'Distrito', email: 'distrito@drh.local', oficina: 'distrito', esAdministrador: false },
  { legajo: 'DEMO-JUR', apellido: 'Prueba', nombre: 'Jurídico', email: 'juridico@drh.local', oficina: 'juridico', esAdministrador: false },
  { legajo: 'DEMO-SEC', apellido: 'Prueba', nombre: 'Secretaría', email: 'secretaria@drh.local', oficina: 'secretaria_general', esAdministrador: false },
  { legajo: 'DEMO-POZ', apellido: 'Prueba', nombre: 'Pozos', email: 'pozos@drh.local', oficina: 'pozos', esAdministrador: false },
];

@Injectable()
export class UsuariosService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(OficinaDrh) private readonly oficinas: Repository<OficinaDrh>,
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
    // Se insertan en orden para que «Sistema» quede con id 1 (lo usa USUARIO_SISTEMA).
    const legajos = new Set((await this.usuarios.find()).map((u) => u.legajo));
    const usuariosNuevos = USUARIOS.filter((u) => !legajos.has(u.legajo));
    for (const u of usuariosNuevos) {
      await this.usuarios.save(this.usuarios.create({ ...u, oficina: u.oficina ? { codigo: u.oficina } : null }));
    }
    if (usuariosNuevos.length) this.logger.log(`Usuarios de prueba cargados: ${usuariosNuevos.map((u) => u.legajo).join(', ')}.`);
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
