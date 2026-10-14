// Lo que manda cada oficina al actuar sobre un expediente. Los comparten todos los trámites
// (alta de concesión, baja de pozo, y los que vengan).
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Para las acciones que solo llevan un comentario (envío, reenvío, verificación final). */
export class ObservacionesDto {
  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Lo que Recaudación verificó de una concesión otorgada de los titulares: si tiene deuda o no. */
export class DeudaConcesionDto {
  @Matches(/^\d+$/, { message: 'Indique la concesión (id de con_concesion, ver GET …/recaudacion).' })
  concesionId: string;

  @IsBoolean({ message: 'Indique si la concesión tiene deuda (true o false).' })
  tieneDeuda: boolean;
}

/**
 * Recaudación: por cada concesión otorgada de los titulares (GET …/recaudacion), si tiene deuda
 * o no. Vacío si los titulares no tienen otras concesiones. El resultado sale de las respuestas.
 */
export class VerificacionDeudaDto {
  @ValidateNested({ each: true })
  @Type(() => DeudaConcesionDto)
  @ArrayMaxSize(500)
  @IsArray({ message: 'Indique, por cada concesión de los titulares, si tiene deuda: { concesiones: [{ concesionId, tieneDeuda }] }.' })
  concesiones: DeudaConcesionDto[];

  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Distrito y Jurídico: apto, no apto u observado (con observado y no apto, el motivo es obligatorio). */
export class DictamenDto {
  @IsIn(['APTO', 'NO_APTO', 'OBSERVADO'], { message: 'El resultado debe ser APTO, NO_APTO u OBSERVADO.' })
  resultado: 'APTO' | 'NO_APTO' | 'OBSERVADO';

  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observaciones?: string;
}

/** Secretaría General: la resolución que otorga la concesión. */
export class ResolucionDto {
  @Texto()
  @Matches(/^\d{1,6}$/, { message: 'Ingrese el número de resolución (hasta 6 dígitos).' })
  numero: string;

  @Max(2100)
  @Min(1990, { message: 'Ingrese el año de la resolución.' })
  @IsInt({ message: 'Ingrese el año de la resolución.' })
  anio: number;

  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de la resolución (AAAA-MM-DD).' })
  fecha: string;

  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Catastro: el número de padrón que asigna Rentas (cierra el trámite). */
export class PadronDto {
  @Texto()
  @Matches(/^[\dA-Za-z.\-/]{1,30}$/, { message: 'Ingrese el número de padrón de Rentas.' })
  padron: string;

  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Recaudación: aviso por correo a los titulares con deuda. */
export class NotificarDeudaDto {
  /** Se agrega al texto del correo (ej: dónde y cómo pagar). */
  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Catastro: los números de concesión del libro, en el orden del pedido (uno, salvo una subdivisión). */
export class AsignarNumerosDto {
  @Matches(/^\d{1,10}$/, { each: true, message: 'El número de concesión es solo números (hasta 10 dígitos).' })
  @IsString({ each: true, message: 'Ingrese el número de concesión.' })
  @ArrayMaxSize(20)
  @ArrayMinSize(1, { message: 'Ingrese el número de concesión.' })
  @IsArray({ message: 'Mande los números como lista: { "numeros": ["1234"] }.' })
  numeros: string[];
}

/** Filtros de la lista de pedidos de número (bandeja de Catastro). */
export class FiltroSolicitudesDto {
  @IsOptional()
  @IsIn(['PENDIENTE', 'ASIGNADA'], { message: 'El estado debe ser PENDIENTE o ASIGNADA.' })
  estado?: 'PENDIENTE' | 'ASIGNADA';

  @IsOptional()
  @Matches(/^\d+$/, { message: 'El expediente tiene que ser un id.' })
  expedienteId?: string;
}
