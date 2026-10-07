// Paso 4 del alta: la parcela (datos catastrales + registro de dominio).
// (El paso 3, ubicación con polígono, se hace aparte con PostGIS.)
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';
import { CIRCUNSCRIPCIONES, SECCIONES_CATASTRALES } from '../../../concesiones/concesiones.constantes.js';

/** Datos catastrales. Matrícula y parcela obligatorias; el padrón no se carga en el alta. */
export class DatosCatastralesDto {
  /** El formulario lo manda (deshabilitado y vacío). Se acepta pero se ignora: lo carga Catastro en el cierre. */
  @IsOptional() @Texto() @IsString()
  padron?: string;

  @Texto()
  @MaxLength(30)
  @IsNotEmpty({ message: 'Ingrese la matrícula catastral.' })
  matricula: string;

  @IsOptional()
  @Texto()
  @IsIn(CIRCUNSCRIPCIONES, { message: `La circunscripción debe ser una de: ${CIRCUNSCRIPCIONES.join(', ')}.` })
  circunscripcion?: string;

  @IsOptional()
  @Texto()
  @IsIn(SECCIONES_CATASTRALES, { message: `La sección debe ser una de: ${SECCIONES_CATASTRALES.join(', ')}.` })
  seccion?: string;

  @Texto()
  @MaxLength(20)
  @IsNotEmpty({ message: 'Ingrese la parcela.' })
  parcela: string;

  @IsOptional() @Texto() @IsString() @MaxLength(20)
  lamina?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(20)
  orden?: string;
}

/** Registro de dominio (Registro Inmobiliario). Todos opcionales. */
export class RegistroDominioDto {
  @IsOptional() @Texto() @IsString() @MaxLength(20)
  libro?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(20)
  folio?: string;

  /** Desde 1900. Que no sea futuro se controla en el service (el año actual cambia con la API andando). */
  @IsOptional()
  @IsInt({ message: 'El año de dominio debe ser un número.' })
  @Min(1900, { message: 'El año de dominio no puede ser anterior a 1900.' })
  anio?: number;

  @IsOptional() @Texto() @IsString() @MaxLength(30)
  matricula?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(20)
  serie?: string;
}

export class DatosInmuebleDto {
  @ValidateNested()
  @Type(() => DatosCatastralesDto)
  catastral: DatosCatastralesDto;

  @ValidateNested()
  @Type(() => RegistroDominioDto)
  registral: RegistroDominioDto;
}
