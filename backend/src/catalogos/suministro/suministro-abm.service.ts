import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, type EntityManager } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, normalizarNombre, quitarBaja } from '../abm/abm-comun.js';
import type { BajaCatalogoDto } from '../dto/abm-ubicaciones.dto.js';
import type { CanalSuministroDto, EditarZonaSuministroDto, NombreSuministroDto, OpcionSuministroDto, ZonaSuministroDto } from '../dto/suministro.dto.js';
import { Departamento } from '../entities/departamento.entity.js';
import { Distrito } from '../entities/distrito.entity.js';
import { Localidad } from '../entities/localidad.entity.js';
import { NIVELES_CANAL, SuministroCanal } from '../entities/suministro-canal.entity.js';
import { SuministroOpcion, TipoOpcionSuministro } from '../entities/suministro-opcion.entity.js';
import { SuministroZona } from '../entities/suministro-zona.entity.js';
import { esTextoAjeno } from './arbol-suministro.js';
import { SuministroCatalogoService } from './suministro-catalogo.service.js';

/** Cómo se nombra cada tipo de opción en los mensajes. */
const NOMBRE_OPCION: Record<TipoOpcionSuministro, string> = {
  [TipoOpcionSuministro.FUENTE]: 'la fuente de agua',
  [TipoOpcionSuministro.SISTEMA]: 'el sistema de distribución',
  [TipoOpcionSuministro.DESAGUE]: 'el desagüe',
};

/** Un canal del árbol en la ficha de la zona (con los dados de baja, marcados). */
export interface CanalFicha {
  id: number;
  nombre: string;
  nivel: number;
  activo: boolean;
  hijos: CanalFicha[];
}

/**
 * ABM del catálogo de suministro de riego: zonas, sus listas (fuentes, sistemas, desagües) y
 * su árbol de canales. Para agregar lo que falte o corregir lo que vino mal del archivo de la DRH.
 *
 * Reglas comunes (las mismas del catálogo de ubicación, 6.2):
 *   - Solo Catastro o un administrador. Nada se borra: la baja es lógica y con motivo.
 *   - Lo dado de baja deja de ofrecerse en el formulario y deja de aceptarse en el paso 6 del alta.
 *     Las concesiones ya cargadas conservan lo que tienen (el suministro se guarda con los nombres).
 *   - Lo dado de baja no se edita ni se vuelve a crear con el mismo nombre: se reactiva.
 *   - Para tocar las listas o los canales de una zona, la zona tiene que estar activa.
 */
@Injectable()
export class SuministroAbmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
    private readonly catalogo: SuministroCatalogoService,
  ) {}

  private get manager(): EntityManager {
    return this.dataSource.manager;
  }

  // ---------------------------------------------------------------------------
  // Zonas
  // ---------------------------------------------------------------------------

  /** Ficha de la zona: sus datos, sus listas y su árbol de canales, con ids y lo dado de baja. */
  async obtenerZona(id: number) {
    //1.- La zona, como en el listado.
    const zona = exigirExistente((await this.catalogo.listarZonas({ id }))[0] ?? null, `la zona de suministro ${id}`);
    const fila = (await this.manager.findOneBy(SuministroZona, { id }))!;

    //2.- Sus listas, separadas por tipo.
    const opciones = await this.manager.find(SuministroOpcion, { where: { zona: { id } }, order: { nombre: 'ASC' } });
    const lista = (tipo: TipoOpcionSuministro) => opciones.filter((o) => o.tipo === tipo).map((o) => ({ id: o.id, nombre: o.nombre, activo: o.activo }));

    //3.- Su árbol de canales completo (los padres vienen antes que los hijos).
    const canales: { id: number; padre_id: number | null; nombre: string; nivel: number; activo: boolean }[] = await this.manager.query(
      `SELECT id, padre_id, nombre, nivel, activo FROM cat_suministro_canal WHERE zona_id = $1 ORDER BY nivel, nombre`,
      [id],
    );
    const nodos = new Map<number, CanalFicha>();
    const raiz: CanalFicha[] = [];
    for (const c of canales) {
      const nodo = { id: c.id, nombre: c.nombre, nivel: c.nivel, activo: c.activo, hijos: [] };
      nodos.set(c.id, nodo);
      (c.padre_id ? nodos.get(c.padre_id)!.hijos : raiz).push(nodo);
    }

    return {
      ...zona,
      ...estadoDeFila(fila),
      fuentesAgua: lista(TipoOpcionSuministro.FUENTE),
      sistemasDistribucion: lista(TipoOpcionSuministro.SISTEMA),
      desagues: lista(TipoOpcionSuministro.DESAGUE),
      canales: raiz,
    };
  }

  /**
   * Alta de una zona (ej: una localidad nueva que empieza a regar).
   *   1. Departamento y distrito activos.
   *   2. Si viene la localidad: activa, del mismo departamento y distrito, y sin otra zona.
   *   3. El nombre de origen no se repite en el departamento y distrito.
   */
  async crearZona(datos: ZonaSuministroDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Departamento y distrito, activos.
    const departamento = exigirExistente(await this.manager.findOneBy(Departamento, { id: datos.departamentoId }), `el departamento ${datos.departamentoId}`);
    exigirActiva(departamento, `El departamento ${departamento.nombre}`);
    const distrito = exigirExistente(await this.manager.findOneBy(Distrito, { id: datos.distritoId }), `el distrito ${datos.distritoId}`);
    exigirActiva(distrito, `El distrito ${distrito.codigo}`);

    //3.- La localidad (optativa), del mismo departamento y distrito, y que no tenga ya su zona.
    let localidad: Localidad | null = null;
    if (datos.localidadId) {
      localidad = exigirExistente(
        await this.manager.findOne(Localidad, { where: { id: datos.localidadId }, relations: { departamento: true, distrito: true } }),
        `la localidad ${datos.localidadId}`,
      );
      exigirActiva(localidad, `La localidad ${localidad.nombre}`);
      if (localidad.departamento.id !== departamento.id) throw new BadRequestException(`La localidad ${localidad.nombre} no es del departamento ${departamento.nombre}.`);
      if (localidad.distrito.id !== distrito.id) throw new BadRequestException(`La localidad ${localidad.nombre} es del distrito ${localidad.distrito.codigo}, no del ${distrito.codigo}.`);
      exigirClaveLibre(await this.manager.findOneBy(SuministroZona, { localidad: { id: localidad.id }, distrito: { id: distrito.id } }), `una zona de suministro para ${localidad.nombre}`);
    }

    //4.- El nombre de origen (si no viene, el de la localidad), libre en el departamento y distrito.
    if (!datos.localidadOrigen && !localidad) throw new BadRequestException('Indique la localidad o el nombre de la zona (ej: «(SIN LOCALIDAD)»).');
    const localidadOrigen = normalizarNombre(datos.localidadOrigen ?? localidad!.nombre);
    exigirClaveLibre(
      await this.manager.findOneBy(SuministroZona, { departamento: { id: departamento.id }, distrito: { id: distrito.id }, localidadOrigen }),
      `la zona «${localidadOrigen}» en ${departamento.nombre}, distrito ${distrito.codigo}`,
    );

    //5.- Se crea vacía: después se le cargan las fuentes, los sistemas, los desagües y los canales.
    const zona = await this.guardar(this.manager.create(SuministroZona, { departamento, distrito, localidad, localidadOrigen, creadoUsuarioId: usuario.id }), `la zona «${localidadOrigen}»`);
    return this.obtenerZona(zona.id);
  }

  /** Corrige el nombre con que la DRH conoce la zona. La localidad se cambia con PUT …/localidad. */
  async editarZona(id: number, datos: EditarZonaSuministroDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Activa, y el nombre nuevo libre en el departamento y distrito.
    const zona = await this.exigirZona(id);
    exigirActiva(zona, `La zona de suministro «${zona.localidadOrigen}»`);
    const localidadOrigen = normalizarNombre(datos.localidadOrigen);
    exigirClaveLibre(
      await this.manager.findOneBy(SuministroZona, { departamento: { id: zona.departamento.id }, distrito: { id: zona.distrito.id }, localidadOrigen }),
      `la zona «${localidadOrigen}» en ${zona.departamento.nombre}, distrito ${zona.distrito.codigo}`,
      id,
    );

    //3.- Se guarda.
    Object.assign(zona, { localidadOrigen, modificadoUsuarioId: usuario.id });
    await this.guardar(zona, `la zona «${localidadOrigen}»`);
    return this.obtenerZona(id);
  }

  /** Baja lógica de la zona: su localidad se queda sin opciones de suministro en el formulario. */
  async darDeBajaZona(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const zona = await this.exigirZona(id);
    exigirActiva(zona, `La zona de suministro «${zona.localidadOrigen}»`);
    aplicarBaja(zona, datos.motivo, usuario);
    await this.manager.save(zona);
    return this.obtenerZona(id);
  }

  /** Reactivar la zona: su departamento, su distrito y su localidad (si tiene) tienen que estar activos. */
  async reactivarZona(id: number, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const zona = await this.exigirZona(id);
    if (zona.activo) throw new ConflictException(`La zona de suministro «${zona.localidadOrigen}» ya está activa.`);
    exigirActiva(zona.departamento, `El departamento ${zona.departamento.nombre}`);
    exigirActiva(zona.distrito, `El distrito ${zona.distrito.codigo}`);
    if (zona.localidad) exigirActiva(zona.localidad, `La localidad ${zona.localidad.nombre}`);
    quitarBaja(zona, usuario);
    await this.manager.save(zona);
    return this.obtenerZona(id);
  }

  // ---------------------------------------------------------------------------
  // Fuentes, sistemas de distribución y desagües
  // ---------------------------------------------------------------------------

  /** Agrega una fuente, un sistema o un desagüe a la zona. El nombre no se repite en su lista. */
  async crearOpcion(zonaId: number, datos: OpcionSuministroDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador; la zona, activa.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const zona = await this.exigirZonaActiva(zonaId);

    //2.- El nombre, válido y libre en esa lista de la zona.
    const nombre = this.exigirNombre(datos.nombre);
    const que = `${NOMBRE_OPCION[datos.tipo]} ${nombre} en la zona «${zona.localidadOrigen}»`;
    exigirClaveLibre(await this.manager.findOneBy(SuministroOpcion, { zona: { id: zona.id }, tipo: datos.tipo, nombre }), que);

    //3.- Se crea.
    const opcion = await this.guardar(this.manager.create(SuministroOpcion, { zona, tipo: datos.tipo, nombre, creadoUsuarioId: usuario.id }), que);
    return this.respuestaOpcion(opcion, zona);
  }

  /**
   * Corrige el nombre de una opción. Las concesiones ya cargadas guardan el nombre anterior (el
   * suministro se guarda con texto): las que estén en trámite tienen que volver a elegirla.
   */
  async editarOpcion(id: number, datos: NombreSuministroDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const opcion = await this.exigirOpcion(id);
    exigirActiva(opcion, `${this.mayuscula(NOMBRE_OPCION[opcion.tipo])} ${opcion.nombre}`);
    await this.exigirZonaActiva(opcion.zona.id);

    const nombre = this.exigirNombre(datos.nombre);
    const que = `${NOMBRE_OPCION[opcion.tipo]} ${nombre} en la zona «${opcion.zona.localidadOrigen}»`;
    exigirClaveLibre(await this.manager.findOneBy(SuministroOpcion, { zona: { id: opcion.zona.id }, tipo: opcion.tipo, nombre }), que, id);

    Object.assign(opcion, { nombre, modificadoUsuarioId: usuario.id });
    return this.respuestaOpcion(await this.guardar(opcion, que), opcion.zona);
  }

  async darDeBajaOpcion(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const opcion = await this.exigirOpcion(id);
    exigirActiva(opcion, `${this.mayuscula(NOMBRE_OPCION[opcion.tipo])} ${opcion.nombre}`);
    aplicarBaja(opcion, datos.motivo, usuario);
    return this.respuestaOpcion(await this.manager.save(opcion), opcion.zona);
  }

  async reactivarOpcion(id: number, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const opcion = await this.exigirOpcion(id);
    if (opcion.activo) throw new ConflictException(`${this.mayuscula(NOMBRE_OPCION[opcion.tipo])} ${opcion.nombre} ya está activo.`);
    await this.exigirZonaActiva(opcion.zona.id);
    quitarBaja(opcion, usuario);
    return this.respuestaOpcion(await this.manager.save(opcion), opcion.zona);
  }

  // ---------------------------------------------------------------------------
  // Canales (el árbol)
  // ---------------------------------------------------------------------------

  /**
   * Agrega un canal al árbol de la zona.
   *   1. Sin padre: canal principal (nivel 1).
   *   2. Con padre: deriva de ese canal (de la misma zona y activo); como mucho canal quinto (nivel 5).
   *   3. El nombre no se repite entre los hermanos (sí puede repetirse en otra rama: «PROPIO»).
   */
  async crearCanal(zonaId: number, datos: CanalSuministroDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador; la zona, activa.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const zona = await this.exigirZonaActiva(zonaId);

    //2.- El canal padre, si viene: de la zona, activo y con lugar para un nivel más.
    let padre: SuministroCanal | null = null;
    if (datos.padreId) {
      padre = await this.exigirCanal(datos.padreId);
      if (padre.zona.id !== zona.id) throw new BadRequestException(`El canal ${padre.nombre} es de otra zona de suministro.`);
      exigirActiva(padre, `El ${NIVELES_CANAL[padre.nivel - 1]} ${padre.nombre}`);
      if (padre.nivel >= NIVELES_CANAL.length) throw new BadRequestException(`${padre.nombre} es un canal quinto: no admite derivaciones (el formulario llega hasta el quinto).`);
    }
    const nivel = padre ? padre.nivel + 1 : 1;

    //3.- El nombre, válido y libre entre sus hermanos.
    const nombre = this.exigirNombre(datos.nombre);
    const que = this.describirCanal(nombre, nivel, padre, zona);
    exigirClaveLibre(await this.hermanoConNombre(zona.id, padre?.id ?? null, nombre), que);

    //4.- Se crea.
    const canal = await this.guardar(this.manager.create(SuministroCanal, { zona, padre, nivel, nombre, creadoUsuarioId: usuario.id }), que);
    return this.respuestaCanal(canal.id);
  }

  /** Corrige el nombre de un canal (como con las opciones, las concesiones ya cargadas guardan el anterior). */
  async editarCanal(id: number, datos: NombreSuministroDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const canal = await this.exigirCanal(id);
    exigirActiva(canal, `El ${NIVELES_CANAL[canal.nivel - 1]} ${canal.nombre}`);
    await this.exigirZonaActiva(canal.zona.id);

    const nombre = this.exigirNombre(datos.nombre);
    const que = this.describirCanal(nombre, canal.nivel, canal.padre, canal.zona);
    exigirClaveLibre(await this.hermanoConNombre(canal.zona.id, canal.padre?.id ?? null, nombre), que, id);

    Object.assign(canal, { nombre, modificadoUsuarioId: usuario.id });
    await this.guardar(canal, que);
    return this.respuestaCanal(id);
  }

  /**
   * Baja lógica de un canal y de TODO lo que deriva de él (un secundario sin su principal no
   * es un camino válido). Todos quedan con el mismo motivo y la misma fecha: así la reactivación
   * sabe cuáles volver a activar.
   */
  async darDeBajaCanal(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    await this.dataSource.transaction(async (tx) => {
      //1.- El canal, activo.
      const canal = await this.exigirCanal(id, tx);
      exigirActiva(canal, `El ${NIVELES_CANAL[canal.nivel - 1]} ${canal.nombre}`);

      //2.- El canal y sus derivaciones activas, con la misma baja.
      const ids = [id, ...(await this.derivacionesActivas(tx, id))];
      const ahora = new Date();
      await tx.update(SuministroCanal, { id: In(ids) }, { activo: false, bajaMotivo: datos.motivo, bajaEn: ahora, bajaUsuarioId: usuario.id, modificadoUsuarioId: usuario.id });
    });
    return this.respuestaCanal(id);
  }

  /**
   * Reactiva un canal (su padre tiene que estar activo) y las derivaciones que se dieron de
   * baja JUNTO con él. Las que tenían una baja propia anterior siguen de baja.
   */
  async reactivarCanal(id: number, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    await this.dataSource.transaction(async (tx) => {
      //1.- El canal, dado de baja, con su padre y su zona activos.
      const canal = await this.exigirCanal(id, tx);
      if (canal.activo) throw new ConflictException(`El ${NIVELES_CANAL[canal.nivel - 1]} ${canal.nombre} ya está activo.`);
      if (canal.padre) exigirActiva(canal.padre, `El ${NIVELES_CANAL[canal.padre.nivel - 1]} ${canal.padre.nombre} (del que deriva)`);
      await this.exigirZonaActiva(canal.zona.id, tx);

      //2.- Él y las derivaciones de la misma baja.
      const mismaBaja: { id: number }[] = await tx.query(
        `WITH RECURSIVE rama AS (
           SELECT id FROM cat_suministro_canal WHERE padre_id = $1
           UNION ALL
           SELECT c.id FROM cat_suministro_canal c JOIN rama r ON c.padre_id = r.id
         )
         SELECT c.id FROM cat_suministro_canal c JOIN rama r ON r.id = c.id WHERE NOT c.activo AND c.baja_en = $2`,
        [id, canal.bajaEn],
      );
      await tx.update(SuministroCanal, { id: In([id, ...mismaBaja.map((c) => c.id)]) }, { activo: true, modificadoUsuarioId: usuario.id });
    });
    return this.respuestaCanal(id);
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private async exigirZona(id: number, tx: EntityManager = this.manager): Promise<SuministroZona> {
    return exigirExistente(
      await tx.findOne(SuministroZona, { where: { id }, relations: { departamento: true, distrito: true, localidad: true } }),
      `la zona de suministro ${id}`,
    );
  }

  private async exigirZonaActiva(id: number, tx: EntityManager = this.manager): Promise<SuministroZona> {
    const zona = await this.exigirZona(id, tx);
    exigirActiva(zona, `La zona de suministro «${zona.localidadOrigen}»`);
    return zona;
  }

  private async exigirOpcion(id: number): Promise<SuministroOpcion> {
    return exigirExistente(await this.manager.findOne(SuministroOpcion, { where: { id }, relations: { zona: true } }), `la opción de suministro ${id}`);
  }

  private async exigirCanal(id: number, tx: EntityManager = this.manager): Promise<SuministroCanal> {
    return exigirExistente(await tx.findOne(SuministroCanal, { where: { id }, relations: { zona: true, padre: true } }), `el canal ${id}`);
  }

  /** El canal con ese nombre entre los hijos del padre (o entre los principales de la zona). */
  private hermanoConNombre(zonaId: number, padreId: number | null, nombre: string) {
    return this.manager.findOneBy(SuministroCanal, padreId ? { padre: { id: padreId }, nombre } : { zona: { id: zonaId }, padre: IsNull(), nombre });
  }

  /** Ids de todo lo que deriva de un canal y está activo (hijos, nietos…). */
  private async derivacionesActivas(tx: EntityManager, id: number): Promise<number[]> {
    const filas: { id: number }[] = await tx.query(
      `WITH RECURSIVE rama AS (
         SELECT id, activo FROM cat_suministro_canal WHERE padre_id = $1
         UNION ALL
         SELECT c.id, c.activo FROM cat_suministro_canal c JOIN rama r ON c.padre_id = r.id
       )
       SELECT id FROM rama WHERE activo`,
      [id],
    );
    return filas.map((f) => f.id);
  }

  /** Nombre normalizado; se rechazan los textos que no son un nombre (los del archivo de la DRH). */
  private exigirNombre(texto: string): string {
    const nombre = normalizarNombre(texto);
    if (esTextoAjeno(nombre)) throw new BadRequestException(`«${nombre}» no parece un nombre de fuente o canal (no puede empezar con «1. », ni llevar «@» o «$»).`);
    return nombre;
  }

  private describirCanal(nombre: string, nivel: number, padre: SuministroCanal | null, zona: SuministroZona): string {
    return `el ${NIVELES_CANAL[nivel - 1]} ${nombre}${padre ? ` que deriva de ${padre.nombre}` : ''} en la zona «${zona.localidadOrigen}»`;
  }

  private mayuscula(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  private respuestaOpcion(o: SuministroOpcion, zona: SuministroZona) {
    return { id: o.id, zonaId: zona.id, tipo: o.tipo, nombre: o.nombre, ...estadoDeFila(o) };
  }

  /** El canal con su nivel, el camino desde el principal y cuántas derivaciones activas tiene. */
  private async respuestaCanal(id: number) {
    const canal = await this.exigirCanal(id);
    const [{ camino, derivaciones }]: { camino: string[]; derivaciones: number }[] = await this.manager.query(
      `WITH RECURSIVE arriba AS (
         SELECT id, padre_id, nombre, nivel FROM cat_suministro_canal WHERE id = $1
         UNION ALL
         SELECT c.id, c.padre_id, c.nombre, c.nivel FROM cat_suministro_canal c JOIN arriba a ON c.id = a.padre_id
       )
       SELECT (SELECT array_agg(nombre ORDER BY nivel) FROM arriba) AS camino,
              (SELECT count(*) FROM cat_suministro_canal WHERE padre_id = $1 AND activo)::int AS derivaciones`,
      [id],
    );
    return {
      id: canal.id,
      zonaId: canal.zona.id,
      nivel: canal.nivel,
      nivelNombre: NIVELES_CANAL[canal.nivel - 1],
      nombre: canal.nombre,
      padre: canal.padre ? { id: canal.padre.id, nombre: canal.padre.nombre } : null,
      camino,
      derivaciones,
      ...estadoDeFila(canal),
    };
  }

  /** Guarda y traduce la violación de un índice único (dos cargas simultáneas) a un 409. */
  private async guardar<T extends SuministroZona | SuministroOpcion | SuministroCanal>(fila: T, que: string): Promise<T> {
    try {
      return await this.manager.save(fila);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw new ConflictException(`Ya existe ${que}.`);
      throw error;
    }
  }
}
