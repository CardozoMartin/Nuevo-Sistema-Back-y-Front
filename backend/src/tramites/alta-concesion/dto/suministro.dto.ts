// Paso 6 del alta: suministro de agua (un camino del árbol: fuente → sistema → canales → desagüe).
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Texto, TextoLista } from '../../../comun/validadores/texto.js';

/**
 * Los valores salen del árbol de suministro del distrito de la concesión (paso 3) y el service
 * valida que sean un camino de ese árbol (GET /api/catalogos/suministro?distrito=). Un nivel
 * puede quedar vacío si la rama no lo tiene (ej: terciario sin secundario).
 */
export class SuministroDto {
  /**
   * La primera es la fuente principal (de ella sale el camino); el resto, adicionales. Sin
   * repetir. Obligatoria si el distrito tiene árbol; vacía si no lo tiene (se controla en el service).
   */
  @ArrayUnique({ message: 'Hay fuentes repetidas.' })
  @MaxLength(120, { each: true })
  @IsNotEmpty({ each: true, message: 'Seleccione la fuente de agua.' })
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsArray()
  @TextoLista()
  fuentes: string[];

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  sistemaDistribucion?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalPrincipal?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalSecundario?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalTerciario?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalCuarto?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(120)
  canalQuinto?: string;

  /** Dónde desagua: el último nivel del árbol, cuelga del último tramo elegido. */
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
