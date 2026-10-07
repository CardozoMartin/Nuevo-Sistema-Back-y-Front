// Paso 6 del alta: suministro de agua (la cascada fuente → sistema → canales).
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Texto, TextoLista } from '../../../comun/validadores/texto.js';
import { MAX_CANALES_ADICIONALES } from '../../../concesiones/concesiones.constantes.js';

/**
 * Los valores salen del catálogo de suministro según la ubicación del inmueble.
 * TODO(catalogos): validarlos contra ese catálogo cuando esté el paso de ubicación.
 * Por ahora se valida la estructura de la cascada (ver el service).
 */
export class SuministroDto {
  /** La primera es la fuente principal; el resto, adicionales. Sin repetir. */
  @ArrayUnique({ message: 'Hay fuentes repetidas.' })
  @MaxLength(120, { each: true })
  @IsNotEmpty({ each: true, message: 'Seleccione la fuente de agua.' })
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @ArrayMinSize(1, { message: 'Seleccione al menos una fuente de agua.' })
  @IsArray()
  @TextoLista()
  fuentes: string[];

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  sistemaDistribucion?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalPrincipal?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalSecundario?: string;

  /** Terciario, cuarto y quinto, en ese orden. */
  @MaxLength(120, { each: true })
  @IsNotEmpty({ each: true, message: 'Seleccione el canal o quítelo de la lista.' })
  @IsString({ each: true })
  @ArrayMaxSize(MAX_CANALES_ADICIONALES, { message: `Se pueden cargar hasta ${MAX_CANALES_ADICIONALES} canales después del secundario.` })
  @IsArray()
  @IsOptional()
  @TextoLista()
  canalesAdicionales?: string[];

  /** Dónde desagua (ej: "MISMA PROPIEDAD"). */
  @IsOptional() @Texto() @IsString() @MaxLength(120)
  desague?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(1000, { message: 'La observación admite hasta 1000 caracteres.' })
  observacion?: string;

  /**
   * Caudal asignado (l/s). Si no viene, se toma la suma de los caudales de los usos
   * (lo mismo que precarga el formulario).
   */
  @IsOptional()
  @Min(0, { message: 'El caudal no puede ser negativo.' })
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Ingrese un caudal válido (hasta 3 decimales).' })
  caudalAsignado?: number;
}
