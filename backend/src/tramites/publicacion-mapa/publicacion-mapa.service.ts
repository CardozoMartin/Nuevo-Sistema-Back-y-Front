import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { PublicacionMapa } from '../../concesiones/concesiones.constantes.js';
import { poligonoDuplicado } from '../../concesiones/duplicados.js';
import { PoligonosService } from '../../concesiones/poligonos.service.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { EstadoExpediente, Oficina, ResultadoActuacion, TipoActuacion } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { ArchivosService } from '../../sig/archivos.service.js';
import { avisoLejosDelCauce, GeometriaService } from '../../sig/geometria.service.js';
import { exigirKml, extensionDe, leerArchivoGeografico, type ArchivoSubido } from '../../sig/kml/archivo-kml.js';

/** Con estos estados el expediente no llega al mapa público (no se otorgó). */
const SIN_OTORGAR = [EstadoExpediente.RECHAZADO, EstadoExpediente.ANULADO, EstadoExpediente.ARCHIVADO];

export interface PoligonoParaPublicar {
  poligonoId: string;
  concesionId: string;
  numero: string | null;
  expedienteId: string | null;
  expediente: string | null;
  expedienteEstado: string | null;
  titular: string | null;
  departamento: string | null;
  distrito: string | null;
  superficieHa: number;
  publicacion: PublicacionMapa;
  nota: string | null;
  usuario: string | null;
  fecha: Date | null;
  /** «12/2026» si Secretaría General ya cargó la resolución. */
  resolucion: string | null;
  resolucionFecha: string | null;
  /** Se puede publicar: tiene resolución, no está publicado y el trámite no terminó sin otorgarse. */
  listoParaPublicar: boolean;
}

/**
 * Publicación de los polígonos en el mapa público (Argenmap, vía GeoServer → sig.v_concesiones).
 *
 * Va por fuera del circuito de oficinas: una concesión se puede publicar recién cuando pasó por
 * Recaudación, Distrito, Jurídico y Secretaría General y tiene número de resolución. Entonces
 * alguien con el permiso «Publicar en el mapa» verifica el polígono y:
 *   publicar  → se ve en Argenmap.
 *   observar  → no se ve (o deja de verse), con nota obligatoria; Catastro reemplaza el KML
 *               (permiso «Cargar o reemplazar el KML») y vuelve a quedar pendiente.
 * Mientras tanto los usuarios internos lo ven igual en el visor del sistema.
 * Cada acción queda en el historial del expediente (actuación PUBLICACION_MAPA).
 */
@Injectable()
export class PublicacionMapaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly poligonos: PoligonosService,
    private readonly geometria: GeometriaService,
    private readonly archivos: ArchivosService,
  ) {}

  /**
   * Los polígonos vigentes en un estado de publicación. Por defecto los pendientes y observados
   * de los trámites (los listos para publicar primero); los publicados, los últimos 300.
   */
  async listar(estado?: PublicacionMapa): Promise<PoligonoParaPublicar[]> {
    const estados = estado ? [estado] : [PublicacionMapa.PENDIENTE, PublicacionMapa.OBSERVADO];
    const filas: Record<string, any>[] = await this.dataSource.query(
      `SELECT v.poligono_id, v.concesion_id, v.numero, v.expediente, v.titular, v.departamento, v.distrito,
              v.superficie_ha, p.publicacion, p.publicacion_nota, p.publicacion_en,
              u.apellido || ', ' || u.nombre AS usuario,
              e.id AS expediente_id, e.estado AS expediente_estado,
              r.numero || '/' || r.anio AS resolucion, to_char(r.fecha, 'YYYY-MM-DD') AS resolucion_fecha
         FROM con_v_mapa_concesion v
         JOIN con_poligono p ON p.id = v.poligono_id
         JOIN con_concesion c ON c.id = v.concesion_id
         LEFT JOIN exp_expediente e ON e.id = c.expediente_id
         LEFT JOIN seg_usuario u ON u.id = p.publicacion_usuario_id
         LEFT JOIN LATERAL (SELECT numero, anio, fecha FROM exp_resolucion r
                             WHERE r.expediente_id = c.expediente_id ORDER BY r.fecha DESC, r.id DESC LIMIT 1) r ON true
        WHERE p.publicacion::text = ANY($1)
          -- Los migrados ya entraron publicados: en «publicados» se muestran solo si se observan después.
          AND ($2::boolean OR p.expediente_id IS NOT NULL)
        ORDER BY (r.numero IS NOT NULL AND p.publicacion = 'PENDIENTE') DESC, p.publicacion_en DESC NULLS LAST, v.poligono_id DESC
        LIMIT 300`,
      [estados, estado !== PublicacionMapa.PUBLICADO],
    );
    return filas.map((f) => ({
      poligonoId: String(f.poligono_id),
      concesionId: String(f.concesion_id),
      numero: f.numero,
      expedienteId: f.expediente_id ? String(f.expediente_id) : null,
      expediente: f.expediente,
      expedienteEstado: f.expediente_estado,
      titular: f.titular,
      departamento: f.departamento,
      distrito: f.distrito,
      superficieHa: Number(f.superficie_ha),
      publicacion: f.publicacion,
      nota: f.publicacion_nota,
      usuario: f.usuario,
      fecha: f.publicacion_en,
      resolucion: f.resolucion,
      resolucionFecha: f.resolucion_fecha,
      listoParaPublicar: f.publicacion !== PublicacionMapa.PUBLICADO && !!f.resolucion && !SIN_OTORGAR.includes(f.expediente_estado),
    }));
  }

  async publicar(poligonoId: string, nota: string | undefined, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- El polígono vigente, bloqueado hasta el fin de la transacción.
      const p = await this.bloquear(tx, poligonoId);
      if (p.publicacion === PublicacionMapa.PUBLICADO) throw new ConflictException('El polígono ya está publicado en el mapa.');

      //2.- Se valida que el trámite haya pasado por todas las oficinas y tenga resolución.
      const expediente = await this.exigirConResolucion(tx, p.expediente_id);

      //3.- Se publica: desde ahora sale en sig.v_concesiones (GeoServer → Argenmap).
      const usuario = await tx.findOneByOrFail(Usuario, { id: usuarioId });
      await this.cambiar(tx, poligonoId, PublicacionMapa.PUBLICADO, nota ?? null, usuario.id);

      //4.- Queda en el historial del expediente.
      if (expediente) {
        await this.expedientes.actuar(tx, expediente, {
          oficina: Oficina.CATASTRO,
          tipo: TipoActuacion.PUBLICACION_MAPA,
          resultado: ResultadoActuacion.APTO,
          usuario,
          observaciones: nota ? `Publicado en el mapa. ${nota}` : 'Publicado en el mapa.',
          datos: { poligonoId },
        });
      }
    });
  }

  /** Observa el polígono (nota obligatoria). Si ya estaba publicado, deja de verse en el mapa público. */
  async observar(poligonoId: string, nota: string, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- El polígono vigente, bloqueado.
      const p = await this.bloquear(tx, poligonoId);

      //2.- Se marca observado (sale del mapa público si estaba).
      const usuario = await tx.findOneByOrFail(Usuario, { id: usuarioId });
      await this.cambiar(tx, poligonoId, PublicacionMapa.OBSERVADO, nota, usuario.id);

      //3.- Queda en el historial del expediente, para que Catastro vea qué corregir.
      const expediente = p.expediente_id ? await tx.findOneByOrFail(Expediente, { id: p.expediente_id }) : null;
      if (expediente) {
        const texto = p.publicacion === PublicacionMapa.PUBLICADO ? 'Se retiró del mapa público' : 'Polígono observado para el mapa';
        await this.expedientes.actuar(tx, expediente, {
          oficina: Oficina.CATASTRO,
          tipo: TipoActuacion.PUBLICACION_MAPA,
          resultado: ResultadoActuacion.OBSERVADO,
          usuario,
          observaciones: `${texto}: ${nota}`,
          datos: { poligonoId },
        });
      }
    });
  }

  /**
   * Catastro reemplaza un polígono OBSERVADO por el KML corregido. El anterior queda en el
   * histórico (no se borra: ya tenía resolución); el nuevo rige desde la misma fecha y vuelve a
   * quedar pendiente de publicar. Devuelve los avisos de la lectura del archivo.
   */
  async reemplazar(poligonoId: string, archivo: ArchivoSubido | undefined, usuarioId: string): Promise<{ poligonoId: string; avisos: string[] }> {
    //1.- El archivo: KML / GeoJSON (se lee antes de abrir la transacción).
    const subido = exigirKml(archivo);
    const leido = leerArchivoGeografico(subido);

    return this.dataSource.transaction(async (tx) => {
      //2.- Solo se reemplaza un polígono observado.
      const p = await this.bloquear(tx, poligonoId);
      if (p.publicacion !== PublicacionMapa.OBSERVADO) {
        throw new ConflictException('Solo se puede reemplazar un polígono observado por quien publica en el mapa.');
      }

      //3.- Coordenadas → WGS84 validadas por PostGIS, con los avisos de siempre.
      const normalizada = await this.geometria.normalizar(leido.geometria, tx, leido.sridDeclarado);
      const analisis = await this.geometria.analizar(normalizada.geometria, p.concesion_id, tx);
      const avisos = [`Coordenadas en ${normalizada.sistemaOrigenNombre}.`, ...normalizada.avisos, ...leido.avisos, avisoLejosDelCauce(analisis)].filter((a): a is string => !!a);

      //4.- Archivo original + polígono nuevo (el anterior pasa al histórico).
      const guardado = await this.archivos.guardar('kml', subido.buffer, extensionDe(subido));
      await this.poligonos.cerrarVigente(tx, p.concesion_id);
      const nuevoId = await this.poligonos.insertar(tx, {
        concesionId: p.concesion_id,
        expedienteId: p.expediente_id,
        origen: p.origen,
        geometria: normalizada.geometria,
        archivo: { nombre: subido.originalname, ...guardado },
        sistemaOrigen: normalizada.sistemaOrigen,
        desde: p.desde,
        usuarioId,
      });

      //5.- Concesión duplicada: se rechaza como en la carga.
      const duplicado = await poligonoDuplicado(tx, p.concesion_id);
      if (duplicado) throw new ConflictException(duplicado);

      //6.- Queda en el historial del expediente.
      if (p.expediente_id) {
        const expediente = await tx.findOneByOrFail(Expediente, { id: p.expediente_id });
        const usuario = await tx.findOneByOrFail(Usuario, { id: usuarioId });
        await this.expedientes.actuar(tx, expediente, {
          oficina: Oficina.CATASTRO,
          tipo: TipoActuacion.PUBLICACION_MAPA,
          resultado: ResultadoActuacion.REGISTRADO,
          usuario,
          observaciones: `Catastro reemplazó el polígono observado (${subido.originalname}, ${analisis.superficieHa.toLocaleString('es-AR')} ha). Queda pendiente de publicar.`,
          datos: { poligonoAnterior: poligonoId, poligono: nuevoId },
        });
      }
      return { poligonoId: nuevoId, avisos };
    });
  }

  private async bloquear(tx: EntityManager, poligonoId: string) {
    const [p] = await tx.query(
      `SELECT id, concesion_id::text, expediente_id::text, origen, publicacion, to_char(desde, 'YYYY-MM-DD') AS desde
         FROM con_poligono WHERE id = $1 AND vigente FOR UPDATE`,
      [poligonoId],
    );
    if (!p) throw new NotFoundException('El polígono no existe o ya no es el vigente de la concesión.');
    return p as { id: string; concesion_id: string; expediente_id: string | null; origen: any; publicacion: PublicacionMapa; desde: string | null };
  }

  /** Se publica recién con resolución y si el trámite no terminó sin otorgarse. Los migrados (sin expediente) no tienen esta condición. */
  private async exigirConResolucion(tx: EntityManager, expedienteId: string | null): Promise<Expediente | null> {
    if (!expedienteId) return null;
    const expediente = await tx.findOneByOrFail(Expediente, { id: expedienteId });
    if (SIN_OTORGAR.includes(expediente.estado)) {
      throw new ConflictException(`El expediente está ${expediente.estado.toLowerCase()}: la concesión no se otorgó y no va al mapa público.`);
    }
    const resolucion = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.RESOLUCION], ResultadoActuacion.REGISTRADO);
    if (!resolucion) {
      throw new ConflictException('Todavía no se puede publicar: el expediente tiene que pasar por Recaudación, Distrito, Jurídico y Secretaría General, y tener el número de resolución.');
    }
    return expediente;
  }

  private async cambiar(tx: EntityManager, poligonoId: string, estado: PublicacionMapa, nota: string | null, usuarioId: string): Promise<void> {
    if (estado === PublicacionMapa.OBSERVADO && !nota?.trim()) throw new BadRequestException('Indique qué hay que corregir en el polígono.');
    await tx.query(
      `UPDATE con_poligono SET publicacion = $2, publicacion_nota = $3, publicacion_usuario_id = $4, publicacion_en = now() WHERE id = $1`,
      [poligonoId, estado, nota, usuarioId],
    );
  }
}
