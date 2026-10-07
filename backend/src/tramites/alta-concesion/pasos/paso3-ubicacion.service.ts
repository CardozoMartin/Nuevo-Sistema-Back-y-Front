import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { UbicacionesService } from '../../../catalogos/ubicaciones.service.js';
import { OrigenPoligono } from '../../../concesiones/concesiones.constantes.js';
import { poligonoDuplicado } from '../../../concesiones/duplicados.js';
import { PoligonosService } from '../../../concesiones/poligonos.service.js';
import { Inmueble } from '../../../concesiones/entities/inmueble.entity.js';
import { ArchivosService } from '../../../sig/archivos.service.js';
import { avisoLejosDelCauce, GeometriaService } from '../../../sig/geometria.service.js';
import { exigirKml, extensionDe, leerArchivoGeografico, type ArchivoSubido } from '../../../sig/kml/archivo-kml.js';
import type { KmlLeido } from '../../../sig/kml/leer-kml.js';
import { AltaConcesionService, type AltaEditable } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { UbicacionDto } from '../dto/ubicacion.dto.js';

/**
 * Paso 3 del alta: ubicación de la concesión.
 *
 * - Departamento, localidad y distrito: obligatorios, del catálogo.
 * - El archivo con la concesión dibujada (KML o GeoJSON, en POSGAR 2007 faja 3 o en
 *   latitud/longitud) es OPTATIVO (decisión D6). Si viene, PostGIS lo valida, lo mide y
 *   controla que no sea una concesión duplicada.
 *
 * Llega como multipart/form-data: «archivo» + los campos de texto.
 */
@Injectable()
export class UbicacionAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly ubicaciones: UbicacionesService,
    private readonly geometria: GeometriaService,
    private readonly poligonos: PoligonosService,
    private readonly archivos: ArchivosService,
  ) {}

  /** Devuelve el alta y los avisos de la lectura del archivo (elementos ignorados, varias partes…). */
  async guardar(expedienteId: string, datos: UbicacionDto, usuarioId: string, archivo?: ArchivoSubido): Promise<RespuestaAlta & { avisos: string[] }> {
    //1.- Si viene archivo, se valida que sea KML/GeoJSON y se lee (antes de abrir la
    //    transacción: es trabajo de CPU que no necesita la base).
    const subido = archivo ? exigirKml(archivo) : undefined;
    const leido = subido ? leerArchivoGeografico(subido) : undefined;

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Se valida la ubicación contra el catálogo (departamento → localidad → distrito).
      const ubicacion = await this.ubicaciones.exigirUbicacion(datos, tx);

      //4.- Si vino el polígono, se valida, se guarda y se controla que no esté duplicado.
      if (subido && leido) await this.guardarPoligono(tx, editable, subido, leido);

      //5.- Se guarda la ubicación en el inmueble vigente (se crea si todavía no existe).
      await this.alta.guardarEnVigente(tx, Inmueble, editable, ubicacion);
      await this.alta.marcarModificado(tx, editable);
    });

    //6.- Se devuelve el alta actualizada con los avisos del archivo.
    return { ...(await this.alta.obtener(expedienteId)), avisos: leido?.avisos ?? [] };
  }

  /** Polígono: coordenadas → PostGIS (validar y medir) → archivo original → con_poligono → duplicados. */
  private async guardarPoligono(tx: EntityManager, { expediente, concesion, usuario }: AltaEditable, archivo: ArchivoSubido, leido: KmlLeido): Promise<void> {
    //1.- Coordenadas: POSGAR 2007 faja 3 (las de la oficina) o lat/long → WGS84.
    //    PostGIS valida el polígono (400 si es inválido o cae fuera de Tucumán).
    const normalizada = await this.geometria.normalizar(leido.geometria, tx);
    leido.geometria = normalizada.geometria;
    leido.avisos.unshift(`Coordenadas en ${normalizada.sistemaOrigenNombre}.`, ...normalizada.avisos);

    //2.- Se mide y se avisa si queda lejos de los ríos y canales.
    const analisis = await this.geometria.analizar(leido.geometria, concesion.id, tx);
    const lejos = avisoLejosDelCauce(analisis);
    if (lejos) leido.avisos.push(lejos);

    //3.- Se guarda el archivo original (respaldo de lo que presentó el titular).
    const guardado = await this.archivos.guardar('kml', archivo.buffer, extensionDe(archivo));

    //4.- Mientras no está otorgada, el polígono es un borrador: reemplaza al anterior.
    await this.poligonos.borrarBorrador(tx, concesion.id);
    await this.poligonos.insertar(tx, {
      concesionId: concesion.id,
      expedienteId: expediente.id,
      origen: OrigenPoligono.ALTA,
      geometria: leido.geometria,
      archivo: { nombre: archivo.originalname, ...guardado },
      sistemaOrigen: normalizada.sistemaOrigen,
      usuarioId: usuario.id,
    });

    //5.- Concesión duplicada: si el polígono coincide casi entero con otra concesión activa,
    //    se rechaza (se deshace todo). Las superposiciones parciales solo se informan.
    const duplicado = await poligonoDuplicado(tx, concesion.id);
    if (duplicado) throw new ConflictException(duplicado);
  }
}
