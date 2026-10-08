import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Not, type EntityManager } from 'typeorm';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import { exigirActiva, exigirAdministradorDeCatalogo, exigirExistente } from '../abm/abm-comun.js';
import { leerSuministroInicial } from '../catalogos.seed.js';
import { Departamento } from '../entities/departamento.entity.js';
import { Distrito } from '../entities/distrito.entity.js';
import { Localidad } from '../entities/localidad.entity.js';
import { SuministroCanal } from '../entities/suministro-canal.entity.js';
import { SuministroOpcion, TipoOpcionSuministro } from '../entities/suministro-opcion.entity.js';
import { SuministroZona } from '../entities/suministro-zona.entity.js';
import {
  arbolDeCanales,
  claveLocalidad,
  datosDeArbol,
  exigirSuministroDelCatalogo,
  normalizarCatalogo,
  type CanalArbol,
  type CatalogoSuministro,
  type DatosSuministro,
  type SeleccionSuministro,
} from './arbol-suministro.js';

/** La ubicación de la concesión, ya guardada con los ids del catálogo (con_inmueble). */
export interface UbicacionSuministro {
  departamento: { nombre: string } | null;
  localidad: { id: number; nombre: string } | null;
  distrito: { id: number; codigo: string } | null;
}

/** Una zona en el listado para administrarlas. */
export interface ZonaListada {
  id: number;
  departamento: string;
  distrito: string;
  localidadOrigen: string;
  localidad: { id: number; nombre: string } | null;
  /** Fuentes y canales activos de la zona. */
  fuentes: number;
  canales: number;
  activo: boolean;
}

/**
 * Catálogo de suministro de riego: el árbol que entregó la DRH, guardado en la base.
 *
 *   cat_suministro_zona     departamento + localidad + distrito
 *   cat_suministro_opcion   fuentes, sistemas de distribución y desagües de cada zona
 *   cat_suministro_canal    el árbol de canales (principal → secundario → … → quinto)
 *
 * Sirve para dos cosas: ofrecer las opciones del formulario (GET /api/catalogos/suministro) y
 * validar que el suministro de una concesión sea un camino real del árbol (paso 6 del alta).
 */
@Injectable()
export class SuministroCatalogoService {
  private readonly logger = new Logger(SuministroCatalogoService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  // ---------------------------------------------------------------------------
  // Carga inicial
  // ---------------------------------------------------------------------------

  /** Carga el árbol si la tabla está vacía. Va después del catálogo de ubicación (lo usa). */
  async cargarSiFalta(): Promise<void> {
    if (await this.dataSource.manager.count(SuministroZona)) return;
    const descartados: string[] = [];
    const catalogo = normalizarCatalogo(leerSuministroInicial(), descartados);
    const resumen = await this.dataSource.transaction((tx) => this.cargar(tx, catalogo));
    this.logger.log(
      `Catálogo de suministro cargado: ${resumen.zonas} zonas (${resumen.vinculadas} vinculadas a una localidad, ` +
        `${resumen.sinLocalidad} «sin localidad», ${resumen.paraVincular} para vincular).`,
    );
    const distintos = [...new Set(descartados)];
    if (distintos.length) {
      this.logger.warn(`Se descartaron ${distintos.length} textos que no son canales ni fuentes (vienen de la página web de la DRH): ${distintos.map((t) => `«${t.slice(0, 60)}»`).join(', ')}.`);
    }
  }

  private async cargar(tx: EntityManager, catalogo: CatalogoSuministro) {
    //1.- El catálogo de ubicación, para vincular cada zona.
    const departamentos = new Map((await tx.find(Departamento)).map((d) => [d.nombre, d]));
    const distritos = new Map((await tx.find(Distrito)).map((d) => [d.codigo, d]));
    const localidades = await tx.find(Localidad, { relations: { departamento: true, distrito: true } });
    const localidadDe = new Map(localidades.map((l) => [`${l.departamento.id}|${claveLocalidad(l.nombre)}`, l]));
    const resumen = { zonas: 0, vinculadas: 0, sinLocalidad: 0, paraVincular: 0 };
    const yaVinculadas = new Set<string>();

    for (const [nombreDepartamento, porLocalidad] of Object.entries(catalogo)) {
      const departamento = departamentos.get(nombreDepartamento);
      if (!departamento) throw new Error(`Catálogo de suministro: el departamento ${nombreDepartamento} no existe en cat_departamento.`);

      for (const [localidadOrigen, porDistrito] of Object.entries(porLocalidad)) {
        for (const [codigo, datos] of Object.entries(porDistrito)) {
          const distrito = distritos.get(codigo);
          if (!distrito) throw new Error(`Catálogo de suministro: el distrito ${codigo} no existe en cat_distrito.`);

          //2.- La localidad del catálogo con el mismo nombre (sin mirar tildes) y el mismo distrito.
          const candidata = localidadDe.get(`${departamento.id}|${claveLocalidad(localidadOrigen)}`);
          const localidad = candidata?.distrito.id === distrito.id && !yaVinculadas.has(`${candidata.id}|${distrito.id}`) ? candidata : null;
          if (localidad) yaVinculadas.add(`${localidad.id}|${distrito.id}`);
          resumen.zonas++;
          if (localidad) resumen.vinculadas++;
          else if (localidadOrigen === '(SIN LOCALIDAD)') resumen.sinLocalidad++;
          else resumen.paraVincular++;

          //3.- La zona, sus listas y su árbol de canales.
          const zona = await tx.save(tx.create(SuministroZona, { departamento, distrito, localidad, localidadOrigen }));
          const opciones = [
            ...datos.fuentesAgua.map((nombre) => ({ tipo: TipoOpcionSuministro.FUENTE, nombre })),
            ...datos.sistemasDistribucion.map((nombre) => ({ tipo: TipoOpcionSuministro.SISTEMA, nombre })),
            ...datos.desagues.map((nombre) => ({ tipo: TipoOpcionSuministro.DESAGUE, nombre })),
          ];
          await tx.save(opciones.map((o) => tx.create(SuministroOpcion, { ...o, zona })), { chunk: 200 });
          await this.guardarCanales(tx, zona, arbolDeCanales(datos), null, 1);
        }
      }
    }
    return resumen;
  }

  /** Guarda un nivel del árbol y, después, los hijos de cada canal (necesitan el id del padre). */
  private async guardarCanales(tx: EntityManager, zona: SuministroZona, canales: CanalArbol[], padre: SuministroCanal | null, nivel: number): Promise<void> {
    if (!canales.length) return;
    const guardados = await tx.save(canales.map((c) => tx.create(SuministroCanal, { zona, padre, nivel, nombre: c.nombre })), { chunk: 200 });
    for (const [i, canal] of canales.entries()) await this.guardarCanales(tx, zona, canal.hijos, guardados[i], nivel + 1);
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /**
   * Catálogo completo en el formato del frontend (departamento → localidad → distrito → datos),
   * con los nombres del catálogo de ubicación. Solo las zonas activas y vinculadas: son las
   * únicas que el formulario puede encontrar con la localidad elegida.
   */
  async obtenerCatalogo(): Promise<CatalogoSuministro> {
    const zonas = await this.dataSource.manager.find(SuministroZona, {
      where: { activo: true, localidad: { id: Not(IsNull()) } },
      relations: { departamento: true, distrito: true, localidad: true },
    });
    const datos = await this.datosDeZonas(this.dataSource.manager, zonas.map((z) => z.id));
    const catalogo: CatalogoSuministro = {};
    for (const zona of zonas) ((catalogo[zona.departamento.nombre] ??= {})[zona.localidad!.nombre] ??= {})[zona.distrito.codigo] = datos.get(zona.id)!;
    return catalogo;
  }

  /** Lo que ofrece el formulario para una ubicación. null si no hay catálogo para ella. */
  async datosPara(localidadId: number, distritoId: number, tx: EntityManager = this.dataSource.manager): Promise<DatosSuministro | null> {
    const zona = await tx.findOneBy(SuministroZona, { localidad: { id: localidadId }, distrito: { id: distritoId }, activo: true });
    return zona ? (await this.datosDeZonas(tx, [zona.id])).get(zona.id)! : null;
  }

  /** Arma las listas y la cascada de varias zonas con dos consultas (no una por zona). Solo lo activo. */
  private async datosDeZonas(tx: EntityManager, zonaIds: number[]): Promise<Map<number, DatosSuministro>> {
    //1.- Las listas simples y los canales activos de todas las zonas.
    const opciones: { zona_id: number; tipo: TipoOpcionSuministro; nombre: string }[] = await tx.query(
      `SELECT zona_id, tipo, nombre FROM cat_suministro_opcion WHERE zona_id = ANY($1) AND activo`,
      [zonaIds],
    );
    const canales: { id: number; zona_id: number; padre_id: number | null; nombre: string }[] = await tx.query(
      `SELECT id, zona_id, padre_id, nombre FROM cat_suministro_canal WHERE zona_id = ANY($1) AND activo ORDER BY nivel`,
      [zonaIds],
    );

    //2.- El árbol de canales de cada zona, armado en memoria (los padres vienen antes que los hijos).
    //    Un canal cuyo padre está de baja no se ofrece (la baja va en cascada, pero por las dudas).
    const alfabetico = new Intl.Collator('es').compare;
    const nodos = new Map<number, CanalArbol>();
    const raices = new Map<number, CanalArbol[]>(zonaIds.map((id) => [id, []]));
    for (const c of canales) {
      const destino = c.padre_id ? nodos.get(c.padre_id)?.hijos : raices.get(c.zona_id);
      if (!destino) continue;
      const nodo = { nombre: c.nombre, hijos: [] };
      nodos.set(c.id, nodo);
      destino.push(nodo);
    }
    const ordenar = (lista: CanalArbol[]) => lista.sort((a, b) => alfabetico(a.nombre, b.nombre)).forEach((c) => ordenar(c.hijos));

    //3.- Cada zona con sus listas ordenadas como las muestra el formulario.
    const deTipo = (zonaId: number, tipo: TipoOpcionSuministro) =>
      opciones
        .filter((o) => o.zona_id === zonaId && o.tipo === tipo)
        .map((o) => o.nombre)
        .sort(alfabetico);
    return new Map(
      zonaIds.map((id) => {
        const raiz = raices.get(id)!;
        ordenar(raiz);
        return [
          id,
          {
            fuentesAgua: deTipo(id, TipoOpcionSuministro.FUENTE),
            sistemasDistribucion: deTipo(id, TipoOpcionSuministro.SISTEMA),
            desagues: deTipo(id, TipoOpcionSuministro.DESAGUE),
            ...datosDeArbol(raiz),
          },
        ];
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Validación del suministro de una concesión
  // ---------------------------------------------------------------------------

  /**
   * El suministro tiene que salir del catálogo de la ubicación de la concesión (paso 3).
   * 400 si la ubicación todavía no se cargó o si algún valor no está en el árbol.
   */
  async exigirValido(tx: EntityManager, ubicacion: UbicacionSuministro | null, seleccion: SeleccionSuministro): Promise<void> {
    //1.- Sin ubicación no se sabe qué catálogo corresponde.
    if (!ubicacion?.localidad || !ubicacion.distrito) {
      throw new BadRequestException('Cargue primero la ubicación de la concesión (paso 3): las fuentes y los canales dependen de ella.');
    }

    //2.- El catálogo de esa ubicación (o ninguno) y la selección contra el árbol.
    const datos = await this.datosPara(ubicacion.localidad.id, ubicacion.distrito.id, tx);
    const lugar = `${ubicacion.localidad.nombre} (${ubicacion.departamento?.nombre ?? '?'}), distrito ${ubicacion.distrito.codigo}`;
    exigirSuministroDelCatalogo(datos, seleccion, lugar);
  }

  // ---------------------------------------------------------------------------
  // Administración: vincular zonas a localidades
  // ---------------------------------------------------------------------------

  /**
   * Zonas del catálogo; `sinVincular` = las que todavía no tienen localidad (para revisarlas);
   * `todas` = también las dadas de baja.
   */
  async listarZonas(filtro: { sinVincular?: boolean; todas?: boolean; id?: number } = {}): Promise<ZonaListada[]> {
    const filas: (Omit<ZonaListada, 'localidad'> & { localidad_id: number | null; localidad: string | null })[] = await this.dataSource.query(
      `SELECT z.id, d.nombre AS departamento, di.codigo AS distrito, z.localidad_origen AS "localidadOrigen",
              z.localidad_id, l.nombre AS localidad, z.activo,
              (SELECT count(*) FROM cat_suministro_opcion o WHERE o.zona_id = z.id AND o.tipo = 'FUENTE' AND o.activo)::int AS fuentes,
              (SELECT count(*) FROM cat_suministro_canal c WHERE c.zona_id = z.id AND c.activo)::int AS canales
         FROM cat_suministro_zona z
         JOIN cat_departamento d ON d.id = z.departamento_id
         JOIN cat_distrito di ON di.id = z.distrito_id
         LEFT JOIN cat_localidad l ON l.id = z.localidad_id
        WHERE ($3::boolean IS TRUE OR $2::int IS NOT NULL OR z.activo)
          AND ($1::boolean IS NOT TRUE OR z.localidad_id IS NULL) AND ($2::int IS NULL OR z.id = $2)`,
      [filtro.sinVincular ?? null, filtro.id ?? null, filtro.todas ?? null],
    );
    const alfabetico = new Intl.Collator('es').compare;
    return filas
      .map(({ localidad_id, localidad, ...z }) => ({ ...z, localidad: localidad_id ? { id: localidad_id, nombre: localidad! } : null }))
      .sort((a, b) => alfabetico(a.departamento, b.departamento) || alfabetico(a.localidadOrigen, b.localidadOrigen) || alfabetico(a.distrito, b.distrito));
  }

  /**
   * Vincula una zona del catálogo de suministro a una localidad del catálogo de ubicación
   * (ej: «TRANCAS» de la DRH → «VILLA DE TRANCAS»). `localidadId` null la desvincula.
   *   1. Solo Catastro o un administrador.
   *   2. La localidad tiene que ser del mismo departamento y del mismo distrito que la zona.
   *   3. Una localidad tiene una sola zona por distrito.
   */
  async vincular(zonaId: number, localidadId: number | null, usuarioId: string): Promise<ZonaListada> {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    await this.dataSource.transaction(async (tx) => {
      //1.- La zona.
      const zona = exigirExistente(await tx.findOne(SuministroZona, { where: { id: zonaId }, relations: { departamento: true, distrito: true } }), 'la zona de suministro');
      exigirActiva(zona, `La zona de suministro «${zona.localidadOrigen}»`);

      //2.- La localidad, del mismo departamento y distrito.
      let localidad: Localidad | null = null;
      if (localidadId !== null) {
        localidad = exigirExistente(await tx.findOne(Localidad, { where: { id: localidadId, activo: true }, relations: { departamento: true, distrito: true } }), 'la localidad');
        if (localidad.departamento.id !== zona.departamento.id) throw new BadRequestException(`La localidad ${localidad.nombre} no es del departamento ${zona.departamento.nombre}.`);
        if (localidad.distrito.id !== zona.distrito.id) {
          throw new BadRequestException(`La localidad ${localidad.nombre} es del distrito ${localidad.distrito.codigo} y la zona del distrito ${zona.distrito.codigo}.`);
        }

        //3.- Que no tenga ya otra zona.
        const otra = await tx.findOneBy(SuministroZona, { localidad: { id: localidad.id }, distrito: { id: zona.distrito.id }, id: Not(zona.id) });
        if (otra) throw new ConflictException(`La localidad ${localidad.nombre} ya tiene su zona de suministro (id ${otra.id}, «${otra.localidadOrigen}»).`);
      }

      await tx.update(SuministroZona, zona.id, { localidad, modificadoUsuarioId: usuario.id });
    });
    return (await this.listarZonas({ id: zonaId }))[0];
  }
}
