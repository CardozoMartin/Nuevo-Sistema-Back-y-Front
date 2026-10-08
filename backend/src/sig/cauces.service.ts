import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { aplicarBaja, estadoDeFila, exigirActiva, exigirAdministradorDeCatalogo, exigirExistente, normalizarNombre, quitarBaja } from '../catalogos/abm/abm-comun.js';
import type { BajaCatalogoDto } from '../catalogos/dto/abm-ubicaciones.dto.js';
import { USUARIO_SISTEMA } from '../comun/usuario-sistema.js';
import { UsuariosService } from '../seguridad/usuarios.service.js';
import type { Recuadro } from './capas.service.js';
import type { CauceDto, EditarCauceDto, FiltroCaucesDto, SistemaLinea } from './dto/cauce.dto.js';
import { Cauce } from './entities/cauce.entity.js';
import { LIMITES_TUCUMAN, SRID_POSGAR, SRID_WGS84 } from './sig.constantes.js';

/** Un cauce como viene en el archivo de carga (recursos/sig/cauces-osm.json). Línea en WGS84 ([lon, lat]). */
export interface CauceArchivo {
  nombre: string | null;
  tipo: 'RIO' | 'CANAL';
  linea: [number, number][];
}

/** Fuente de los cauces que se cargan a mano por la API, si no se indica otra. */
const FUENTE_POR_DEFECTO = 'DRH';

/** La línea validada, lista para guardar: GeoJSON y el SRID en que vienen sus coordenadas. */
interface LineaValida {
  geojson: string;
  srid: number;
}

/**
 * Capa de ríos y canales (sig.cauce): la carga desde un archivo, la publica para el visor y la
 * administra por la API (ABM con baja lógica, sin pantalla por ahora).
 * Para el visor se simplifica la línea (10 m de tolerancia): a la escala del mapa no se nota y
 * pesa mucho menos. Solo se publican y se usan para los avisos los cauces activos.
 */
@Injectable()
export class CaucesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
  ) {}

  /**
   * Reemplaza los cauces de una fuente por los del archivo, en una transacción. Las líneas
   * entran en WGS84 y se guardan en POSGAR 07 (EPSG:5345). Devuelve cuántos se cargaron.
   * Los anteriores de esa fuente no se borran: quedan dados de baja (nada se borra, RN-A04).
   */
  async cargar(cauces: CauceArchivo[], fuente: string): Promise<number> {
    if (!Array.isArray(cauces) || !cauces.length) throw new BadRequestException('El archivo no tiene cauces.');
    return this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sig.cauce SET activo = false, baja_motivo = $2, baja_en = now(), baja_usuario_id = $3, modificado_usuario_id = $3, modificado_en = now()
          WHERE fuente = $1 AND activo`,
        [fuente, `Reemplazado por una nueva carga de la fuente ${fuente}.`, USUARIO_SISTEMA],
      );
      let cargados = 0;
      for (const c of cauces) {
        if (!Array.isArray(c.linea) || c.linea.length < 2) continue;
        await tx.query(
          `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84}), ${SRID_POSGAR}) AS geom)
           INSERT INTO sig.cauce (nombre, tipo, fuente, geom, largo_km)
           SELECT $2, $3, $4, geom, round((ST_Length(geom) / 1000)::numeric, 2) FROM g`,
          [JSON.stringify({ type: 'LineString', coordinates: c.linea }), c.nombre ?? null, c.tipo === 'CANAL' ? 'CANAL' : 'RIO', fuente],
        );
        cargados++;
      }
      return cargados;
    });
  }

  /** Cauces activos dentro del recuadro (o todos), como FeatureCollection de líneas en WGS84. */
  async capa(recuadro?: Recuadro): Promise<unknown> {
    const [fila] = await this.dataSource.query(
      `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(json_build_object(
                    'type', 'Feature',
                    'id', c.id,
                    'geometry', ST_AsGeoJSON(ST_Transform(ST_Simplify(c.geom, 10), ${SRID_WGS84}), 6)::json,
                    'properties', json_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'fuente', c.fuente, 'largo_km', c.largo_km::float8)
                  ) ORDER BY c.tipo, c.nombre), '[]'::json)
              ) AS capa
         FROM sig.cauce c
        WHERE c.activo
          AND ($1::float8 IS NULL
               OR c.geom && ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, ${SRID_WGS84}), ${SRID_POSGAR}))`,
      recuadro ?? [null, null, null, null],
    );
    return fila.capa;
  }

  // ---------------------------------------------------------------------------
  // ABM (GET/POST/PUT/DELETE /api/catalogos/cauces)
  // ---------------------------------------------------------------------------

  /** Listado sin el trazado (para administrar). Por defecto solo los activos. */
  async listar(filtro: FiltroCaucesDto) {
    const cauces = await this.dataSource.manager
      .createQueryBuilder(Cauce, 'c')
      .where(filtro.todas ? '1 = 1' : 'c.activo')
      .andWhere(filtro.q ? 'c.nombre ILIKE :q' : '1 = 1', { q: `%${normalizarNombre(filtro.q ?? '')}%` })
      .andWhere(filtro.tipo ? 'c.tipo = :tipo' : '1 = 1', { tipo: filtro.tipo })
      .andWhere(filtro.fuente ? 'c.fuente = :fuente' : '1 = 1', { fuente: filtro.fuente })
      .orderBy('c.tipo')
      .addOrderBy('c.nombre')
      .getMany();
    return cauces.map((c) => this.respuesta(c));
  }

  /** Un cauce con su trazado completo (sin simplificar) en WGS84. */
  async obtener(id: number) {
    const cauce = exigirExistente(await this.dataSource.manager.findOneBy(Cauce, { id }), `el cauce ${id}`);
    const [{ linea }] = await this.dataSource.query(`SELECT ST_AsGeoJSON(ST_Transform(geom, ${SRID_WGS84}), 6)::json AS linea FROM sig.cauce WHERE id = $1`, [id]);
    return { ...this.respuesta(cauce), linea };
  }

  /**
   * Alta de un río o canal (ej: un canal de riego que no está en OpenStreetMap).
   *   1. Solo Catastro o un administrador.
   *   2. La línea: vértices numéricos, en el sistema indicado, válida y dentro de Tucumán.
   *   3. Se guarda en POSGAR 07 con su largo calculado por PostGIS.
   */
  async crear(datos: CauceDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- La línea, validada con PostGIS.
    const linea = await this.exigirLinea(this.dataSource.manager, datos.linea, datos.sistema);

    //3.- Se guarda, a nombre de quien la carga.
    const [{ id }] = await this.dataSource.query(
      `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), $2::int), ${SRID_POSGAR}) AS geom)
       INSERT INTO sig.cauce (nombre, tipo, fuente, geom, largo_km, creado_usuario_id)
       SELECT $3, $4, $5, geom, round((ST_Length(geom) / 1000)::numeric, 2), $6 FROM g
       RETURNING id`,
      [linea.geojson, linea.srid, normalizarNombre(datos.nombre), datos.tipo, datos.fuente ?? FUENTE_POR_DEFECTO, usuario.id],
    );
    return this.obtener(id);
  }

  /** Modificación: nombre, tipo, fuente y/o trazado (con el trazado se recalcula el largo). */
  async editar(id: number, datos: EditarCauceDto, usuarioId: string) {
    //1.- Solo Catastro o un administrador.
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);

    //2.- Tiene que existir y estar activo.
    const cauce = exigirExistente(await this.dataSource.manager.findOneBy(Cauce, { id }), `el cauce ${id}`);
    exigirActiva(cauce, `El cauce ${cauce.nombre ?? id}`);
    if (datos.sistema && !datos.linea) throw new BadRequestException('El sistema se indica junto con la línea.');

    await this.dataSource.transaction(async (tx) => {
      //3.- Los datos.
      await tx.update(Cauce, id, {
        ...(datos.nombre !== undefined && { nombre: normalizarNombre(datos.nombre) }),
        ...(datos.tipo && { tipo: datos.tipo }),
        ...(datos.fuente && { fuente: datos.fuente }),
        modificadoUsuarioId: usuario.id,
      });

      //4.- El trazado nuevo, si viene: validado y con el largo recalculado.
      if (datos.linea) {
        const linea = await this.exigirLinea(tx, datos.linea, datos.sistema);
        await tx.query(
          `WITH g AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), $2::int), ${SRID_POSGAR}) AS geom)
           UPDATE sig.cauce SET geom = g.geom, largo_km = round((ST_Length(g.geom) / 1000)::numeric, 2) FROM g WHERE id = $3`,
          [linea.geojson, linea.srid, id],
        );
      }
    });
    return this.obtener(id);
  }

  /** Baja lógica: deja de verse en el visor y de usarse para el aviso del cauce más cercano. */
  async darDeBaja(id: number, datos: BajaCatalogoDto, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const cauce = exigirExistente(await this.dataSource.manager.findOneBy(Cauce, { id }), `el cauce ${id}`);
    exigirActiva(cauce, `El cauce ${cauce.nombre ?? id}`);
    aplicarBaja(cauce, datos.motivo, usuario);
    await this.dataSource.manager.save(cauce);
    return this.obtener(id);
  }

  async reactivar(id: number, usuarioId: string) {
    const usuario = await exigirAdministradorDeCatalogo(this.usuarios, usuarioId);
    const cauce = exigirExistente(await this.dataSource.manager.findOneBy(Cauce, { id }), `el cauce ${id}`);
    if (cauce.activo) throw new ConflictException(`El cauce ${cauce.nombre ?? id} ya está activo.`);
    quitarBaja(cauce, usuario);
    await this.dataSource.manager.save(cauce);
    return this.obtener(id);
  }

  // ---------------------------------------------------------------------------

  /**
   * La línea tiene que ser utilizable:
   *   1. Cada vértice, dos números.
   *   2. Coordenadas del sistema indicado (lat/long en grados; POSGAR en metros, X con 7 cifras).
   *   3. Línea válida, con largo, y dentro de Tucumán (con el margen de LIMITES_TUCUMAN).
   */
  private async exigirLinea(tx: EntityManager, vertices: unknown[], sistema: SistemaLinea = 'WGS84'): Promise<LineaValida> {
    //1.- Cada vértice, [x, y] numéricos.
    const malo = vertices.findIndex((v) => !Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && Number.isFinite(n)));
    if (malo >= 0) throw new BadRequestException(`El vértice ${malo + 1} de la línea no es un par de números [x, y].`);
    const puntos = vertices as [number, number][];

    //2.- Que los números sean del sistema indicado.
    const enGrados = puntos.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);
    if (sistema === 'WGS84' && !enGrados) {
      throw new BadRequestException('Las coordenadas no son latitud/longitud. Si son POSGAR 2007 faja 3, indique «sistema»: «POSGAR».');
    }
    if (sistema === 'POSGAR' && enGrados) {
      throw new BadRequestException('Las coordenadas parecen latitud/longitud, no POSGAR. Indique «sistema»: «WGS84» (o no lo indique).');
    }

    //3.- PostGIS: válida, con largo y dentro de Tucumán.
    const geojson = JSON.stringify({ type: 'LineString', coordinates: puntos });
    const srid = sistema === 'POSGAR' ? SRID_POSGAR : SRID_WGS84;
    const { oeste, sur, este, norte } = LIMITES_TUCUMAN;
    const [r] = await tx.query(
      `WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), $2::int) AS geom)
       SELECT ST_IsValid(geom) AS valida,
              ST_Length(ST_Transform(geom, ${SRID_POSGAR})) AS largo_m,
              ST_Within(ST_Transform(geom, ${SRID_WGS84}), ST_MakeEnvelope($3, $4, $5, $6, ${SRID_WGS84})) AS en_tucuman
         FROM g`,
      [geojson, srid, oeste, sur, este, norte],
    );
    if (!r.valida || !(Number(r.largo_m) > 0)) throw new BadRequestException('La línea no es válida (vértices repetidos o sin largo).');
    if (!r.en_tucuman) {
      throw new BadRequestException(
        sistema === 'WGS84'
          ? 'La línea cae fuera de Tucumán. Revise que los vértices sean [longitud, latitud] (no al revés).'
          : 'La línea cae fuera de Tucumán. Revise que los vértices sean [X, Y] de POSGAR 2007 faja 3.',
      );
    }
    return { geojson, srid };
  }

  private respuesta(c: Cauce) {
    return { id: c.id, nombre: c.nombre, tipo: c.tipo, fuente: c.fuente, largoKm: Number(c.largoKm), ...estadoDeFila(c) };
  }
}
