// Lo que manda cada oficina en la baja de un pozo.
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';
import { DOCUMENTOS_BAJA } from '../../../pozos/pozos.constantes.js';
import { NumeroExpedienteDto } from '../../alta-concesion/dto/iniciar-alta.dto.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CODIGOS_DOCUMENTO = DOCUMENTOS_BAJA.map((d) => d.codigo);

/** Datos de la solicitud que Pozos carga y puede corregir (mesa de entrada). */
export class DatosBajaDto {
  @Texto()
  @MaxLength(4000)
  @MinLength(10, { message: 'Explique el motivo de la baja (al menos 10 caracteres).' })
  @IsString({ message: 'Indique el motivo de la baja.' })
  motivo: string;

  @Texto()
  @MaxLength(200)
  @IsString({ message: 'Ingrese el nombre del solicitante.' })
  solicitanteNombre: string;

  @IsOptional()
  @Texto()
  @Matches(/^\d{7,11}$/, { message: 'El documento del solicitante tiene que tener entre 7 y 11 dígitos, sin puntos ni guiones.' })
  solicitanteDocumento?: string;

  /** Códigos de la documentación que trae el expediente (GET /api/tramites/baja-pozo/documentos). */
  @IsArray()
  @ArrayUnique({ message: 'Hay documentos repetidos.' })
  @IsIn(CODIGOS_DOCUMENTO, { each: true, message: 'Documento desconocido.' })
  documentacionPresentada: string[];
}

/** Inicio de la baja a solicitud del titular: qué pozo y el expediente en papel. */
export class IniciarBajaPozoDto extends DatosBajaDto {
  @Matches(/^\d+$/, { message: 'Seleccione el pozo a dar de baja.' })
  pozoId: string;

  @ValidateNested()
  @Type(() => NumeroExpedienteDto)
  @IsNotEmpty({ message: 'Ingrese el número de expediente.' })
  expediente: NumeroExpedienteDto;
}

/** Mesa de entrada: ¿está toda la documentación? Si falta, el expediente queda en espera. */
export class DocumentacionDto {
  @IsIn(['COMPLETA', 'PENDIENTE'], { message: 'Indique si la documentación está completa o pendiente.' })
  resultado: 'COMPLETA' | 'PENDIENTE';

  @IsOptional() @Texto() @IsString() @MaxLength(2000)
  observaciones?: string;
}

/** Evaluación técnica de la perforación (Pozos). */
export class EvaluacionTecnicaDto {
  @IsIn(['FAVORABLE', 'REQUIERE_SUBSANACION'], { message: 'El resultado debe ser FAVORABLE o REQUIERE_SUBSANACION.' })
  resultado: 'FAVORABLE' | 'REQUIERE_SUBSANACION';

  @IsBoolean({ message: 'Indique si se hizo inspección de campo.' })
  inspeccionRealizada: boolean;

  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de inspección (AAAA-MM-DD).' })
  fechaInspeccion?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observacionesInspeccion?: string;

  @Texto()
  @MaxLength(8000)
  @IsString({ message: 'Cargue el informe técnico.' })
  informeTecnico: string;

  /** Si la perforación tiene que clausurarse físicamente (obligatorio si es favorable). */
  @IsOptional()
  @IsBoolean({ message: 'Indique si corresponde la clausura física.' })
  requiereClausura?: boolean;
}

/** Jurídico: dictamen y, si el pozo tiene concesión, si se anula también. */
export class DictamenJuridicoDto {
  @IsIn(['APTO', 'NO_APTO', 'OBSERVADO'], { message: 'El resultado debe ser APTO, NO_APTO u OBSERVADO.' })
  resultado: 'APTO' | 'NO_APTO' | 'OBSERVADO';

  /** Obligatorio con APTO si el pozo abastece una concesión. */
  @IsOptional()
  @IsBoolean({ message: 'Indique si se anula también la concesión.' })
  anularConcesion?: boolean;

  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observaciones?: string;
}

/** Secretaría General: la resolución que aprueba o rechaza la baja. */
export class ResolucionBajaDto {
  @IsIn(['APROBAR', 'RECHAZAR'], { message: 'Indique si la resolución aprueba o rechaza la baja.' })
  decision: 'APROBAR' | 'RECHAZAR';

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

  /** Obligatorio al rechazar (el motivo queda registrado). */
  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observaciones?: string;
}

/** Clausura física de la perforación (Pozos). */
export class ClausuraDto {
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de la clausura (AAAA-MM-DD).' })
  fecha: string;

  @Texto()
  @MaxLength(50)
  @IsString({ message: 'Ingrese el número de acta de clausura.' })
  acta: string;

  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observaciones?: string;
}

/** Baja de oficio: el motivo y, si la hubo, la inspección. Sin expediente ni solicitante. */
export class BajaDeOficioDto {
  @Texto()
  @MaxLength(4000)
  @MinLength(10, { message: 'Explique el motivo de la baja (al menos 10 caracteres).' })
  @IsString({ message: 'Indique el motivo de la baja.' })
  motivo: string;

  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de inspección (AAAA-MM-DD).' })
  fechaInspeccion?: string;

  @IsOptional() @Texto() @IsString() @MaxLength(4000)
  observacionesInspeccion?: string;
}
