import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { leerArbolSuministroInicial } from '../catalogos.seed.js';
import { Distrito } from '../entities/distrito.entity.js';
import { NivelSuministro, SuministroNodo } from '../entities/suministro-nodo.entity.js';
import { arbolDesdeRamas, exigirSuministroDelArbol, ordenarArbol, type CatalogoSuministro, type NodoArbol, type SeleccionSuministro } from './arbol-suministro.js';

/** La ubicación de la concesión, ya guardada con los ids del catálogo (con_inmueble): importa el distrito. */
export interface UbicacionSuministro {
  distrito: { id: number; codigo: string } | null;
}

/**
 * Catálogo de suministro de riego: un árbol por distrito (cat_suministro_nodo), el que cargaron
 * los jefes de Distrito: fuente → sistema → canal principal → … → quinto → desagüe.
 *
 * Sirve para dos cosas: ofrecer las opciones del formulario (GET /api/catalogos/suministro) y
 * validar que el suministro de una concesión sea un camino real del árbol (paso 6 del alta).
 * El ABM está en SuministroAbmService.
 */
@Injectable()
export class SuministroCatalogoService {
  private readonly logger = new Logger(SuministroCatalogoService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ---------------------------------------------------------------------------
  // Carga inicial
  // ---------------------------------------------------------------------------

  /** Carga el árbol de los jefes si la tabla está vacía. Va después del catálogo de ubicación (usa los distritos). */
  async cargarSiFalta(): Promise<void> {
    if (await this.dataSource.manager.count(SuministroNodo)) return;
    const descartadas: string[] = [];
    const tramos = await this.dataSource.transaction(async (tx) => {
      const distritos = new Map((await tx.find(Distrito)).map((d) => [d.codigo, d]));
      let total = 0;
      for (const [codigo, ramas] of Object.entries(leerArbolSuministroInicial())) {
        const distrito = distritos.get(codigo);
        if (!distrito) throw new Error(`Árbol de suministro: el distrito ${codigo} no existe en cat_distrito.`);
        total += await this.guardar(tx, distrito, arbolDesdeRamas(ramas, descartadas), null);
      }
      return total;
    });
    this.logger.log(`Árbol de suministro cargado: ${tramos} tramos.`);
    if (descartadas.length) this.logger.warn(`Ramas sin fuente, no se cargaron: ${descartadas.map((r) => `«${r}»`).join(', ')}.`);
  }

  /** Guarda un nivel del árbol y, después, lo que cuelga de cada tramo (necesita el id del padre). */
  private async guardar(tx: EntityManager, distrito: Distrito, nodos: NodoArbol[], padre: SuministroNodo | null): Promise<number> {
    if (!nodos.length) return 0;
    const guardados = await tx.save(nodos.map((n) => tx.create(SuministroNodo, { distrito, padre, nivel: n.nivel, nombre: n.nombre })), { chunk: 200 });
    let total = guardados.length;
    for (const [i, nodo] of nodos.entries()) total += await this.guardar(tx, distrito, nodo.hijos, guardados[i]);
    return total;
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Todos los distritos con su árbol (solo lo activo), por código: { "I": [fuentes…], … }. */
  async obtenerCatalogo(): Promise<CatalogoSuministro> {
    const arboles = await this.arboles(this.dataSource.manager);
    const distritos = await this.dataSource.manager.find(Distrito, { where: { activo: true } });
    return Object.fromEntries(distritos.filter((d) => arboles.has(d.id)).map((d) => [d.codigo, arboles.get(d.id)!]));
  }

  /** El árbol activo de un distrito; null si no tiene ninguno cargado. */
  async arbolDe(distritoId: number, tx: EntityManager = this.dataSource.manager): Promise<NodoArbol[] | null> {
    return (await this.arboles(tx, distritoId)).get(distritoId) ?? null;
  }

  /**
   * Arma los árboles con una consulta. Solo lo activo: un tramo cuyo padre está de baja no se
   * ofrece (la baja va en cascada, pero por las dudas). Los padres vienen antes que los hijos
   * porque el nivel de un hijo siempre es posterior (el enum ordena por declaración).
   */
  private async arboles(tx: EntityManager, distritoId?: number): Promise<Map<number, NodoArbol[]>> {
    const filas: { id: number; padre_id: number | null; distrito_id: number; nivel: NivelSuministro; nombre: string }[] = await tx.query(
      `SELECT id, padre_id, distrito_id, nivel, nombre FROM cat_suministro_nodo
        WHERE activo AND ($1::int IS NULL OR distrito_id = $1) ORDER BY nivel`,
      [distritoId ?? null],
    );
    const nodos = new Map<number, NodoArbol>();
    const raices = new Map<number, NodoArbol[]>();
    for (const f of filas) {
      if (!f.padre_id && !raices.has(f.distrito_id)) raices.set(f.distrito_id, []);
      const destino = f.padre_id ? nodos.get(f.padre_id)?.hijos : raices.get(f.distrito_id);
      if (!destino) continue;
      const nodo: NodoArbol = { nombre: f.nombre, nivel: f.nivel, hijos: [] };
      nodos.set(f.id, nodo);
      destino.push(nodo);
    }
    for (const arbol of raices.values()) ordenarArbol(arbol);
    return raices;
  }

  // ---------------------------------------------------------------------------
  // Validación del suministro de una concesión
  // ---------------------------------------------------------------------------

  /**
   * El suministro tiene que ser un camino del árbol del distrito de la concesión (paso 3).
   * 400 si la ubicación todavía no se cargó o si algún valor no sale de donde dice.
   */
  async exigirValido(tx: EntityManager, ubicacion: UbicacionSuministro | null, seleccion: SeleccionSuministro): Promise<void> {
    if (!ubicacion?.distrito) {
      throw new BadRequestException('Cargue primero la ubicación de la concesión (paso 3): las fuentes y los canales dependen del distrito.');
    }
    exigirSuministroDelArbol(await this.arbolDe(ubicacion.distrito.id, tx), seleccion, `el distrito ${ubicacion.distrito.codigo}`);
  }
}
