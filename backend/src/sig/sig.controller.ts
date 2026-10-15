import { Controller, Get, Param, ParseIntPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ArchivosService } from './archivos.service.js';
import { CapasService } from './capas.service.js';
import { CaucesService } from './cauces.service.js';
import { avisoLejosDelCauce, GeometriaService } from './geometria.service.js';
import { exigirKml, leerArchivoGeografico, RecibirKml, type ArchivoSubido } from './kml/archivo-kml.js';
import { ConDatosSensibles } from '../seguridad/auth.decorators.js';

@Controller('sig')
export class SigController {
  constructor(
    private readonly capas: CapasService,
    private readonly geometria: GeometriaService,
    private readonly cauces: CaucesService,
    private readonly archivos: ArchivosService,
  ) {}

  /**
   * GET /api/sig/concesiones?bbox=oeste,sur,este,norte
   * Concesiones con polígono vigente, en GeoJSON WGS84. Sin bbox devuelve todas.
   */
  @Get('concesiones')
  concesiones(@Query('bbox') bbox?: string) {
    return this.capas.concesiones(CapasService.leerRecuadro(bbox));
  }

  /** GET /api/sig/concesiones/:id: una concesión como Feature GeoJSON. */
  @Get('concesiones/:id')
  @ConDatosSensibles()
  concesion(@Param('id', ParseIntPipe) id: number) {
    return this.capas.concesion(String(id));
  }

  /**
   * GET /api/sig/concesiones/:id/kml: el polígono vigente como KML, para abrirlo en Google
   * Earth o cargarlo en un GPS (Distrito, inspecciones).
   */
  @Get('concesiones/:id/kml')
  async kmlConcesion(@Param('id', ParseIntPipe) id: number) {
    const { nombre, kml } = await this.capas.kmlConcesion(String(id));
    return new StreamableFile(Buffer.from(kml, 'utf8'), { type: 'application/vnd.google-earth.kml+xml', disposition: `attachment; filename="${nombre}"` });
  }

  /**
   * GET /api/sig/poligonos/:id/archivo: el archivo ORIGINAL que se presentó (KML o GeoJSON),
   * tal cual se subió. Se comprueba con el hash que no haya sido modificado en el disco.
   * El id del polígono viene en la respuesta del alta (ubicacion.poligono.id).
   */
  @Get('poligonos/:id/archivo')
  async archivoPoligono(@Param('id', ParseIntPipe) id: number) {
    const archivo = await this.capas.archivoPoligono(String(id));
    const contenido = await this.archivos.leer(archivo.ruta, archivo.sha256);
    const tipo = archivo.ruta.endsWith('.geojson') ? 'application/geo+json' : 'application/vnd.google-earth.kml+xml';
    return new StreamableFile(contenido, { type: tipo, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}` });
  }

  /**
   * GET /api/sig/pozos?bbox=oeste,sur,este,norte
   * Pozos no anulados, como puntos GeoJSON WGS84. Sin bbox devuelve todos.
   */
  @Get('pozos')
  @ConDatosSensibles()
  pozos(@Query('bbox') bbox?: string) {
    return this.capas.pozos(CapasService.leerRecuadro(bbox));
  }

  /**
   * GET /api/sig/puntos?bbox=oeste,sur,este,norte
   * Desagües y puntos de entrega vigentes, como puntos GeoJSON WGS84. Sin bbox devuelve todos.
   */
  @Get('puntos')
  @ConDatosSensibles()
  puntos(@Query('bbox') bbox?: string) {
    return this.capas.puntos(CapasService.leerRecuadro(bbox));
  }

  /**
   * GET /api/sig/cauces?bbox=oeste,sur,este,norte
   * Ríos y canales (líneas simplificadas, WGS84). Sin bbox devuelve todos.
   */
  @Get('cauces')
  capaCauces(@Query('bbox') bbox?: string) {
    return this.cauces.capa(CapasService.leerRecuadro(bbox));
  }

  /**
   * POST /api/sig/kml/analizar (multipart, campo «archivo»).
   * Vista previa: lee el KML y lo valida con PostGIS SIN guardar nada. Acepta coordenadas
   * POSGAR 2007 faja 3 (las de la oficina) o latitud/longitud; un GeoJSON que declara su sistema
   * («crs», ej: Campo Inchauspe) se transforma desde ese sistema. Devuelve el polígono en GeoJSON
   * WGS84, el sistema en que vino, superficie, perímetro y superposiciones con otras concesiones.
   * El formulario lo usa para mostrar el mapa antes de confirmar.
   */
  @Post('kml/analizar')
  @UseInterceptors(RecibirKml())
  async analizarKml(@UploadedFile() archivo?: ArchivoSubido) {
    const kml = exigirKml(archivo);
    const leido = leerArchivoGeografico(kml);
    const normalizada = await this.geometria.normalizar(leido.geometria, undefined, leido.sridDeclarado);
    const analisis = await this.geometria.analizar(normalizada.geometria);
    return {
      archivo: { nombre: kml.originalname, bytes: kml.size },
      nombres: leido.nombres,
      numerosConcesion: leido.numerosConcesion ?? [],
      avisos: [...normalizada.avisos, ...leido.avisos, avisoLejosDelCauce(analisis)].filter((a): a is string => !!a),
      sistemaOrigen: normalizada.sistemaOrigen,
      sistemaOrigenNombre: normalizada.sistemaOrigenNombre,
      ...analisis,
    };
  }
}
