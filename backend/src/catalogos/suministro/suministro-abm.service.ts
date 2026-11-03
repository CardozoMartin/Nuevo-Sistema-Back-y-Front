import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, type EntityManager } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import { estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirClaveLibre, exigirExistente, normalizarNombre } from '../abm/abm-comun.js';
import type { BajaCatalogoDto } from '../dto/abm-ubicaciones.dto.js';
import type { NombreSuministroDto, NodoSuministroDto } from '../dto/suministro.dto.js';
import { Distrito } from '../entities/distrito.entity.js';
import { NivelSuministro, nombreDeNivel, ordenDeNivel, SuministroNodo } from '../entities/suministro-nodo.entity.js';
import { esTextoAjeno, ordenarArbol } from './arbol-suministro.js';

/** Un tramo del árbol en la ficha del distrito (con los dados de baja, marcados). */
export interface NodoFicha {
  id: number;
  nombre: string;
  nivel: NivelSuministro;
  activo: boolean;
  baja: { motivo: string | null; fecha: Date } | null;
  hijos: NodoFicha[];
}

/**
 * ABM del árbol de suministro de cada distrito: para agregar lo que falte (una fuente nueva, un
 * canal que no estaba) o corregir lo que se cargó mal. Desde que se agrega, el alta lo ofrece.
 *
 * Reglas (las mismas del resto de los catálogos):
 *   - Solo Catastro o un administrador, con el permiso «Administrar catálogos». Nada se borra:
 *     la baja es lógica, con motivo, y se lleva todo lo que cuelga del tramo.
 *   - Lo dado de baja deja de ofrecerse en el formulario y deja de aceptarse en el paso 6 del alta.
 *     Las concesiones ya cargadas conservan lo que tienen (el suministro se guarda con los nombres).
 *   - Lo dado de baja no se edita ni se vuelve a crear con el mismo nombre: se reactiva.
 */
@Injectable()
export class SuministroAbmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  private get manager(): EntityManager {
    return this.dataSource.manager;
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Los distritos con cuántas fuentes y tramos activos tiene cargados cada uno. */
  async listarDistritos() {
    const filas: { id: number; codigo: string; nombre: string; fuentes: number; tramos: number }[] = await this.manager.query(
      `SELECT d.id, d.codigo, d.nombre,
              count(n.id) FILTER (WHERE n.activo AND n.nivel = 'FUENTE')::int AS fuentes,
              count(n.id) FILTER (WHERE n.activo)::int AS tramos
         FROM cat_distrito d LEFT JOIN cat_suministro_nodo n ON n.distrito_id = d.id
        WHERE d.activo
        GROUP BY d.id ORDER BY d.id`,
    );
    return filas;
  }

  /** El árbol completo del distrito, con ids y lo dado de baja. */
  async obtenerArbol(distritoId: number) {
    const distrito = exigirExistente(await this.manager.findOneBy(Distrito, { id: distritoId }), `el distrito ${distritoId}`);
    const filas = await this.manager.find(SuministroNodo, { where: { distrito: { id: distritoId } }, relations: { padre: true }, order: { nivel: 'ASC' } });
    const nodos = new Map<number, NodoFicha>();
    const raiz: NodoFicha[] = [];
    for (const f of filas) {
      const nodo: NodoFicha = { id: f.id, nombre: f.nombre, nivel: f.nivel, activo: f.activo, baja: f.activo || !f.bajaEn ? null : { motivo: f.bajaMotivo, fecha: f.bajaEn }, hijos: [] };
      nodos.set(f.id, nodo);
      (f.padre ? nodos.get(f.padre.id)!.hijos : raiz).push(nodo);
    }
    return { distrito: { id: distrito.id, codigo: distrito.codigo, nombre: distrito.nombre }, nodos: ordenarArbol(raiz) };
  }

  // ---------------------------------------------------------------------------
  // Alta, corrección, baja y reactivación
  // ---------------------------------------------------------------------------

  /**
   * Agrega un tramo al árbol del distrito.
   *   1. Una fuente no tiene padre; lo demás cuelga de un tramo del mismo distrito, activo y de
   *      un nivel ANTERIOR (no hace falta que sea el inmediato: la rama puede no tener algún nivel).
   *   2. El nombre no se repite entre los tramos del mismo nivel que cuelgan del mismo padre
   *      (sí puede repetirse en otra rama: «PROPIO»).
   */
  async crear(datos: NodoSuministroDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador; el distrito, activo.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const distrito = exigirExistente(await this.manager.findOneBy(Distrito, { id: datos.distritoId }), 'el distrito');
    exigirActiva(distrito, `El distrito ${distrito.codigo}`);

    //2.- De dónde viene.
    let padre: SuministroNodo | null = null;
    if (datos.nivel === NivelSuministro.FUENTE) {
      if (datos.padreId) throw new BadRequestException('Una fuente de agua no viene de otro tramo: es el comienzo de la rama.');
    } else {
      if (!datos.padreId) throw new BadRequestException(`Indique de dónde viene el ${nombreDeNivel(datos.nivel)}.`);
      padre = await this.exigirNodo(datos.padreId);
      if (padre.distrito.id !== distrito.id) throw new BadRequestException(`${padre.nombre} es de otro distrito.`);
      exigirActiva(padre, `${this.mayuscula(nombreDeNivel(padre.nivel))} ${padre.nombre}`);
      if (ordenDeNivel(padre.nivel) >= ordenDeNivel(datos.nivel)) {
        throw new BadRequestException(`Un ${nombreDeNivel(datos.nivel)} no puede venir de un ${nombreDeNivel(padre.nivel)}: tiene que colgar de un nivel anterior.`);
      }
    }

    //3.- El nombre, válido y libre entre sus hermanos.
    const nombre = this.exigirNombre(datos.nombre);
    const que = this.describir(nombre, datos.nivel, padre, distrito);
    exigirClaveLibre(await this.hermanoConNombre(distrito.id, padre?.id ?? null, datos.nivel, nombre), que);

    //4.- Se crea.
    const nodo = await this.guardar(this.manager.create(SuministroNodo, { distrito, padre, nivel: datos.nivel, nombre, creadoUsuarioId: usuario.id }), que);
    return this.respuesta(nodo.id);
  }

  /**
   * Corrige el nombre de un tramo. Las concesiones ya cargadas guardan el nombre anterior (el
   * suministro se guarda con texto): las que estén en trámite tienen que volver a elegirlo.
   */
  async editar(id: number, datos: NombreSuministroDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const nodo = await this.exigirNodo(id);
    exigirActiva(nodo, `${this.mayuscula(nombreDeNivel(nodo.nivel))} ${nodo.nombre}`);

    const nombre = this.exigirNombre(datos.nombre);
    const que = this.describir(nombre, nodo.nivel, nodo.padre, nodo.distrito);
    exigirClaveLibre(await this.hermanoConNombre(nodo.distrito.id, nodo.padre?.id ?? null, nodo.nivel, nombre), que, id);

    Object.assign(nodo, { nombre, modificadoUsuarioId: usuario.id });
    await this.guardar(nodo, que);
    return this.respuesta(id);
  }

  /**
   * Baja lógica de un tramo y de TODO lo que cuelga de él (un canal sin el sistema del que sale
   * no es un camino válido). Todos quedan con el mismo motivo y la misma fecha: así la
   * reactivación sabe cuáles volver a activar.
   */
  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    await this.dataSource.transaction(async (tx) => {
      //1.- El tramo, activo.
      const nodo = await this.exigirNodo(id, tx);
      exigirActiva(nodo, `${this.mayuscula(nombreDeNivel(nodo.nivel))} ${nodo.nombre}`);

      //2.- Él y lo que cuelga de él (activo), con la misma baja.
      const ids = [id, ...(await this.rama(tx, id, 'activo'))];
      await tx.update(SuministroNodo, { id: In(ids) }, { activo: false, bajaMotivo: datos.motivo, bajaEn: new Date(), bajaUsuarioId: usuario.id, modificadoUsuarioId: usuario.id });
    });
    return this.respuesta(id);
  }

  /**
   * Reactiva un tramo (su padre tiene que estar activo) y lo que se dio de baja JUNTO con él.
   * Lo que tenía una baja propia anterior sigue de baja.
   */
  async reactivar(id: number, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    await this.dataSource.transaction(async (tx) => {
      //1.- El tramo, dado de baja, con su padre y su distrito activos.
      const nodo = await this.exigirNodo(id, tx);
      if (nodo.activo) throw new ConflictException(`${this.mayuscula(nombreDeNivel(nodo.nivel))} ${nodo.nombre} ya está activo.`);
      if (nodo.padre) exigirActiva(nodo.padre, `${this.mayuscula(nombreDeNivel(nodo.padre.nivel))} ${nodo.padre.nombre} (del que viene)`);
      exigirActiva(nodo.distrito, `El distrito ${nodo.distrito.codigo}`);

      //2.- Él y lo que cuelga de él con la misma baja.
      const ids = [id, ...(await this.rama(tx, id, 'misma baja', nodo.bajaEn))];
      await tx.update(SuministroNodo, { id: In(ids) }, { activo: true, modificadoUsuarioId: usuario.id });
    });
    return this.respuesta(id);
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private async exigirNodo(id: number, tx: EntityManager = this.manager): Promise<SuministroNodo> {
    return exigirExistente(await tx.findOne(SuministroNodo, { where: { id }, relations: { distrito: true, padre: true } }), `el tramo de suministro ${id}`);
  }

  /** El tramo con ese nombre y nivel que cuelga del mismo padre (o la fuente con ese nombre en el distrito). */
  private hermanoConNombre(distritoId: number, padreId: number | null, nivel: NivelSuministro, nombre: string) {
    return this.manager.findOneBy(SuministroNodo, padreId ? { padre: { id: padreId }, nivel, nombre } : { distrito: { id: distritoId }, padre: IsNull(), nombre });
  }

  /** Ids de lo que cuelga de un tramo (hijos, nietos…): lo activo, o lo dado de baja en la misma fecha. */
  private async rama(tx: EntityManager, id: number, cuales: 'activo' | 'misma baja', bajaEn?: Date | null): Promise<number[]> {
    const filas: { id: number }[] = await tx.query(
      `WITH RECURSIVE rama AS (
         SELECT id FROM cat_suministro_nodo WHERE padre_id = $1
         UNION ALL
         SELECT n.id FROM cat_suministro_nodo n JOIN rama r ON n.padre_id = r.id
       )
       SELECT n.id FROM cat_suministro_nodo n JOIN rama r ON r.id = n.id
        WHERE CASE WHEN $2 THEN n.activo ELSE NOT n.activo AND n.baja_en = $3 END`,
      [id, cuales === 'activo', bajaEn ?? null],
    );
    return filas.map((f) => f.id);
  }

  /** Nombre normalizado; se rechazan los textos que no son un nombre. */
  private exigirNombre(texto: string): string {
    const nombre = normalizarNombre(texto);
    if (esTextoAjeno(nombre)) throw new BadRequestException(`«${nombre}» no parece un nombre de fuente o canal (no puede empezar con «1. », ni llevar «@» o «$»).`);
    return nombre;
  }

  private describir(nombre: string, nivel: NivelSuministro, padre: SuministroNodo | null, distrito: Distrito): string {
    return `${nivel === NivelSuministro.FUENTE ? 'la' : 'el'} ${nombreDeNivel(nivel)} ${nombre}${padre ? ` que viene de ${padre.nombre}` : ''} en el distrito ${distrito.codigo}`;
  }

  private mayuscula(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  private async guardar(nodo: SuministroNodo, que: string): Promise<SuministroNodo> {
    try {
      return await this.manager.save(nodo);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw new ConflictException(`Ya existe ${que}.`);
      throw error;
    }
  }

  /** El tramo con su nivel, el camino desde la fuente y cuántos tramos activos cuelgan de él. */
  private async respuesta(id: number) {
    const nodo = await this.exigirNodo(id);
    const [{ camino, derivaciones }]: { camino: string[]; derivaciones: number }[] = await this.manager.query(
      `WITH RECURSIVE arriba AS (
         SELECT id, padre_id, nombre, nivel FROM cat_suministro_nodo WHERE id = $1
         UNION ALL
         SELECT n.id, n.padre_id, n.nombre, n.nivel FROM cat_suministro_nodo n JOIN arriba a ON n.id = a.padre_id
       )
       SELECT (SELECT array_agg(nombre ORDER BY nivel) FROM arriba) AS camino,
              (SELECT count(*) FROM cat_suministro_nodo WHERE padre_id = $1 AND activo)::int AS derivaciones`,
      [id],
    );
    return {
      id: nodo.id,
      distritoId: nodo.distrito.id,
      nivel: nodo.nivel,
      nivelNombre: nombreDeNivel(nodo.nivel),
      nombre: nodo.nombre,
      padre: nodo.padre ? { id: nodo.padre.id, nombre: nodo.padre.nombre } : null,
      camino,
      derivaciones,
      ...estadoDeFila(nodo),
    };
  }
}
