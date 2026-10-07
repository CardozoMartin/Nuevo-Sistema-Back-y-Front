import { Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CapasService } from './capas.service.js';
import { CaucesService } from './cauces.service.js';
import { avisoLejosDelCauce, GeometriaService } from './geometria.service.js';
import { exigirKml, leerArchivoGeografico, RecibirKml, type ArchivoSubido } from './kml/archivo-kml.js';

@Controller('sig')
export class SigController {
  constructor(
    private readonly capas: CapasService,
    private readonly geometria: GeometriaService,
    private readonly cauces: CaucesService,
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
  concesion(@Param('id', ParseIntPipe) id: number) {
    return this.capas.concesion(String(id));
  }

  /**
   * GET /api/sig/pozos?bbox=oeste,sur,este,norte
   * Pozos no anulados, como puntos GeoJSON WGS84. Sin bbox devuelve todos.
   */
  @Get('pozos')
  pozos(@Query('bbox') bbox?: string) {
    return this.capas.pozos(CapasService.leerRecuadro(bbox));
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
   * POSGAR 2007 faja 3 (las de la oficina) o latitud/longitud. Devuelve el polígono en GeoJSON
   * WGS84, el sistema en que vino, superficie, perímetro y superposiciones con otras concesiones.
   * El formulario lo usa para mostrar el mapa antes de confirmar.
   */
  @Post('kml/analizar')
  @UseInterceptors(RecibirKml())
  async analizarKml(@UploadedFile() archivo?: ArchivoSubido) {
    const kml = exigirKml(archivo);
    const leido = leerArchivoGeografico(kml);
    const normalizada = await this.geometria.normalizar(leido.geometria);
    const analisis = await this.geometria.analizar(normalizada.geometria);
    return {
      archivo: { nombre: kml.originalname, bytes: kml.size },
      nombres: leido.nombres,
      avisos: [...normalizada.avisos, ...leido.avisos, avisoLejosDelCauce(analisis)].filter((a): a is string => !!a),
      sistemaOrigen: normalizada.sistemaOrigen,
      sistemaOrigenNombre: normalizada.sistemaOrigenNombre,
      ...analisis,
    };
  }
}
