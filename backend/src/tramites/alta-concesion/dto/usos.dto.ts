// Paso 5 del alta: usos y magnitudes.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmpty, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { EjePosgarFaja3 } from '../../../comun/validadores/posgar.js';
import { Texto } from '../../../comun/validadores/texto.js';
import { Caracter, CODIGOS_SERVICIO } from '../../../concesiones/concesiones.constantes.js';
import { LIMITES_TUCUMAN } from '../../../sig/sig.constantes.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const grados = (n: number) => n.toLocaleString('es-AR');

/** ¿Vino la coordenada en latitud/longitud? (si no, va en X/Y POSGAR). */
const enGrados = (c: CoordenadaDto) => c.latitud != null || c.longitud != null;

/**
 * Coordenada de un punto, dentro de Tucumán, en UNO de los dos sistemas:
 *   - X/Y POSGAR 2007 faja 3 (EPSG:5345), en metros: { x: 3577293.45, y: 7035340.12 }
 *   - latitud/longitud en grados decimales (WGS84 / POSGAR 07 geográficas, que difieren
 *     menos de 1 m): { latitud: -27.0536, longitud: -65.2312 }
 * El backend calcula la otra forma con PostGIS y guarda las dos.
 */
export class CoordenadaDto {
  // X/Y: la regla compartida con el frontend (comun/validadores/posgar-faja3.ts).
  @ValidateIf((c: CoordenadaDto) => !enGrados(c))
  @EjePosgarFaja3('x')
  @IsNumber({}, { message: 'Ingrese la X POSGAR en metros (ej: 3577293.45), o la latitud y longitud.' })
  x?: number;

  @ValidateIf((c: CoordenadaDto) => !enGrados(c))
  @EjePosgarFaja3('y')
  @IsNumber({}, { message: 'Ingrese la Y POSGAR en metros (ej: 7035340.12), o la latitud y longitud.' })
  y?: number;

  @ValidateIf(enGrados)
  @Max(LIMITES_TUCUMAN.norte, { message: `La latitud debe estar entre ${grados(LIMITES_TUCUMAN.sur)} y ${grados(LIMITES_TUCUMAN.norte)} (Tucumán).` })
  @Min(LIMITES_TUCUMAN.sur, { message: `La latitud debe estar entre ${grados(LIMITES_TUCUMAN.sur)} y ${grados(LIMITES_TUCUMAN.norte)} (Tucumán).` })
  @IsNumber({ maxDecimalPlaces: 8 }, { message: 'Ingrese la latitud en grados decimales (hasta 8 decimales).' })
  latitud?: number;

  @ValidateIf(enGrados)
  @Max(LIMITES_TUCUMAN.este, { message: `La longitud debe estar entre ${grados(LIMITES_TUCUMAN.oeste)} y ${grados(LIMITES_TUCUMAN.este)} (Tucumán).` })
  @Min(LIMITES_TUCUMAN.oeste, { message: `La longitud debe estar entre ${grados(LIMITES_TUCUMAN.oeste)} y ${grados(LIMITES_TUCUMAN.este)} (Tucumán).` })
  @IsNumber({ maxDecimalPlaces: 8 }, { message: 'Ingrese la longitud en grados decimales (hasta 8 decimales).' })
  longitud?: number;
}

/**
 * Desagüe: SOLO en X/Y POSGAR 2007 faja 3 (EPSG:5345), con la regla compartida con el frontend
 * (7 cifras enteras, hasta 2 decimales, dentro de Tucumán). El backend calcula la latitud/longitud.
 */
export class DesagueDto {
  @EjePosgarFaja3('x', 'del desagüe')
  @IsNumber({}, { message: 'Ingrese la X POSGAR del desagüe en metros (ej: 3577293.45).' })
  x: number;

  @EjePosgarFaja3('y', 'del desagüe')
  @IsNumber({}, { message: 'Ingrese la Y POSGAR del desagüe en metros (ej: 7035340.12).' })
  y: number;

  @IsEmpty({ message: 'El desagüe se carga en X/Y POSGAR 2007 faja 3, no en latitud/longitud.' })
  latitud?: unknown;

  @IsEmpty({ message: 'El desagüe se carga en X/Y POSGAR 2007 faja 3, no en latitud/longitud.' })
  longitud?: unknown;
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
  @Type(() => DesagueDto)
  @IsNotEmpty({ message: 'Ingrese las coordenadas de desagüe.' })
  desague: DesagueDto;

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
