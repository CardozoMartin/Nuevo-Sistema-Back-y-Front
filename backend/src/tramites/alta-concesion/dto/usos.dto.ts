// Paso 5 del alta: usos y magnitudes.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';
import { Caracter, CODIGOS_SERVICIO, RANGO_POSGAR } from '../../../concesiones/concesiones.constantes.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const miles = (n: number) => n.toLocaleString('es-AR');

/** Coordenada POSGAR 2007 faja 3 (EPSG:5345) en metros, dentro de Tucumán. */
export class CoordenadaDto {
  @Max(RANGO_POSGAR.x.max, { message: `La X POSGAR debe estar entre ${miles(RANGO_POSGAR.x.min)} y ${miles(RANGO_POSGAR.x.max)} (Tucumán, faja 3).` })
  @Min(RANGO_POSGAR.x.min, { message: `La X POSGAR debe estar entre ${miles(RANGO_POSGAR.x.min)} y ${miles(RANGO_POSGAR.x.max)} (Tucumán, faja 3).` })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingrese la X POSGAR en metros (hasta 2 decimales).' })
  x: number;

  @Max(RANGO_POSGAR.y.max, { message: `La Y POSGAR debe estar entre ${miles(RANGO_POSGAR.y.min)} y ${miles(RANGO_POSGAR.y.max)} (Tucumán, faja 3).` })
  @Min(RANGO_POSGAR.y.min, { message: `La Y POSGAR debe estar entre ${miles(RANGO_POSGAR.y.min)} y ${miles(RANGO_POSGAR.y.max)} (Tucumán, faja 3).` })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingrese la Y POSGAR en metros (hasta 2 decimales).' })
  y: number;
}

/** Punto de entrega del agua: coordenada + una referencia del lugar. */
export class PuntoEntregaDto extends CoordenadaDto {
  @IsOptional()
  @Texto()
  @IsString()
  @MaxLength(255)
  referencia?: string;
}

/** Un uso declarado: código del catálogo (GET /api/catalogos/tipos-uso) y magnitud. */
export class UsoItemDto {
  @Texto()
  @IsString()
  @IsNotEmpty({ message: 'Seleccione el uso.' })
  uso: string;

  /** En la unidad del uso (ha, cabezas…). Tiene que ser mayor a 0. */
  @Min(0.01, { message: 'Ingrese una magnitud mayor a 0.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingrese la magnitud (número, hasta 2 decimales).' })
  magnitud: number;
}

export class UsosDto {
  // --- Condiciones generales (opcionales, igual que en el formulario) ---

  @IsOptional()
  @IsEnum(Caracter, { message: 'El carácter debe ser PERMANENTE o EVENTUAL.' })
  caracter?: Caracter;

  @IsOptional()
  @IsIn(CODIGOS_SERVICIO, { message: `El código de servicio debe ser uno de: ${CODIGOS_SERVICIO.join(', ')}.` })
  @IsInt({ message: 'El código de servicio debe ser un número.' })
  codigoServicio?: number;

  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese el inicio del período (AAAA-MM-DD).' })
  periodoInicio?: string;

  /** No puede ser anterior al inicio (se controla en el service). */
  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese el fin del período (AAAA-MM-DD).' })
  periodoFin?: string;

  // --- Desagüe (obligatorio) ---

  @ValidateNested()
  @Type(() => CoordenadaDto)
  @IsNotEmpty({ message: 'Ingrese las coordenadas de desagüe.' })
  desague: CoordenadaDto;

  // --- Usos (al menos uno, sin repetir) ---

  @ValidateNested({ each: true })
  @Type(() => UsoItemDto)
  @ArrayMaxSize(20)
  @ArrayMinSize(1, { message: 'Seleccione al menos un uso.' })
  @IsArray()
  items: UsoItemDto[];

  // --- Punto de entrega (obligatorio solo si algún uso lo exige; lo controla el service) ---

  @IsOptional()
  @ValidateNested()
  @Type(() => PuntoEntregaDto)
  puntoEntrega?: PuntoEntregaDto;
}
