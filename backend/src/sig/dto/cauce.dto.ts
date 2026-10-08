// Datos que recibe el ABM de ríos y canales (sig.cauce). La validación de la línea (coordenadas,
// sistema, que caiga en Tucumán) la hace CaucesService con PostGIS.
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { FiltroCatalogoDto } from '../../catalogos/dto/abm-ubicaciones.dto.js';

export const TIPOS_CAUCE = ['RIO', 'CANAL'] as const;
export type TipoCauce = (typeof TIPOS_CAUCE)[number];

/** Sistema de las coordenadas de la línea: latitud/longitud o POSGAR 2007 faja 3 (los de la oficina). */
export const SISTEMAS_LINEA = ['WGS84', 'POSGAR'] as const;
export type SistemaLinea = (typeof SISTEMAS_LINEA)[number];

/** Máximo de vértices de una línea (un río largo de OSM tiene unos pocos miles). */
const MAX_VERTICES = 50_000;

/** Alta de un río o canal. */
export class CauceDto {
  @Texto()
  @MaxLength(120, { message: 'El nombre admite hasta 120 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre del río o canal.' })
  nombre: string;

  @IsIn(TIPOS_CAUCE, { message: 'El tipo es RIO o CANAL.' })
  tipo: TipoCauce;

  /** De dónde sale el trazado. Si no viene, «DRH». */
  @IsOptional()
  @Texto()
  @MaxLength(60)
  fuente?: string;

  /**
   * El trazado: lista de vértices [x, y]. En WGS84 es [longitud, latitud] (como GeoJSON);
   * en POSGAR, [X, Y] de faja 3 (X empieza con 3, Y con 7).
   */
  @IsArray({ message: 'La línea es una lista de vértices [x, y].' })
  @ArrayMinSize(2, { message: 'La línea necesita al menos dos vértices.' })
  @ArrayMaxSize(MAX_VERTICES, { message: `La línea admite hasta ${MAX_VERTICES} vértices.` })
  linea: [number, number][];

  /** Sistema de la línea. Por defecto WGS84. */
  @IsOptional()
  @IsIn(SISTEMAS_LINEA, { message: 'El sistema es WGS84 o POSGAR.' })
  sistema?: SistemaLinea;
}

/** Modificación: solo lo que cambia. Sin `linea`, el trazado queda como estaba. */
export class EditarCauceDto {
  @IsOptional()
  @Texto()
  @MaxLength(120, { message: 'El nombre admite hasta 120 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre del río o canal.' })
  nombre?: string;

  @IsOptional()
  @IsIn(TIPOS_CAUCE, { message: 'El tipo es RIO o CANAL.' })
  tipo?: TipoCauce;

  @IsOptional()
  @Texto()
  @MaxLength(60)
  fuente?: string;

  @IsOptional()
  @IsArray({ message: 'La línea es una lista de vértices [x, y].' })
  @ArrayMinSize(2, { message: 'La línea necesita al menos dos vértices.' })
  @ArrayMaxSize(MAX_VERTICES, { message: `La línea admite hasta ${MAX_VERTICES} vértices.` })
  linea?: [number, number][];

  @IsOptional()
  @IsIn(SISTEMAS_LINEA, { message: 'El sistema es WGS84 o POSGAR.' })
  sistema?: SistemaLinea;
}

/** GET /api/catalogos/cauces: además de ?todas y ?q, por tipo y por fuente. */
export class FiltroCaucesDto extends FiltroCatalogoDto {
  @IsOptional()
  @IsIn(TIPOS_CAUCE, { message: 'El tipo es RIO o CANAL.' })
  tipo?: TipoCauce;

  @IsOptional()
  @Texto()
  @MaxLength(60)
  fuente?: string;
}
