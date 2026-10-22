import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { PublicacionMapa } from '../../concesiones/concesiones.constantes.js';
import { RequierePermiso } from '../../seguridad/auth.decorators.js';
import { Permiso } from '../../seguridad/permisos.constantes.js';
import { UsuarioActual } from '../../seguridad/usuario-actual.decorator.js';
import { RecibirKml, type ArchivoSubido } from '../../sig/kml/archivo-kml.js';
import { PublicacionMapaService } from './publicacion-mapa.service.js';

export class FiltroPublicacionDto {
  @IsOptional() @IsIn(Object.values(PublicacionMapa), { message: 'estado: PENDIENTE, OBSERVADO o PUBLICADO.' })
  estado?: PublicacionMapa;
}

export class NotaPublicacionDto {
  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

export class ObservarPublicacionDto {
  @Texto() @IsString() @MinLength(5, { message: 'Indique qué hay que corregir en el polígono.' }) @MaxLength(2000)
  observaciones: string;
}

/**
 * Publicación de los polígonos en el mapa público (Argenmap). `:id` es el id del polígono
 * (poligono_id en las capas). Consultar la lista es para cualquier usuario interno.
 */
@Controller('mapa/publicacion')
export class PublicacionMapaController {
  constructor(private readonly publicacion: PublicacionMapaService) {}

  /** GET /api/mapa/publicacion?estado=: pendientes y observados (por defecto), o los de un estado. */
  @Get()
  listar(@Query() filtro: FiltroPublicacionDto) {
    return this.publicacion.listar(filtro.estado);
  }

  /** POST /api/mapa/publicacion/:id/publicar { observaciones? }: verificado, se ve en Argenmap. */
  @Post(':id/publicar')
  @RequierePermiso(Permiso.MAPA_PUBLICAR)
  publicar(@Param('id', ParseIntPipe) id: number, @Body() dto: NotaPublicacionDto, @UsuarioActual() usuarioId: string) {
    return this.publicacion.publicar(String(id), dto.observaciones, usuarioId);
  }

  /** POST /api/mapa/publicacion/:id/observar { observaciones }: no se publica (o se retira) hasta que Catastro lo corrija. */
  @Post(':id/observar')
  @RequierePermiso(Permiso.MAPA_PUBLICAR)
  observar(@Param('id', ParseIntPipe) id: number, @Body() dto: ObservarPublicacionDto, @UsuarioActual() usuarioId: string) {
    return this.publicacion.observar(String(id), dto.observaciones, usuarioId);
  }

  /** POST /api/mapa/publicacion/:id/reemplazar (multipart, campo «archivo»): Catastro sube el KML corregido. */
  @Post(':id/reemplazar')
  @UseInterceptors(RecibirKml())
  @RequierePermiso(Permiso.KML_CARGAR)
  reemplazar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuarioId: string, @UploadedFile() archivo?: ArchivoSubido) {
    return this.publicacion.reemplazar(String(id), archivo, usuarioId);
  }
}
