// Paso 1 del alta: datos de la carátula del expediente en papel.
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';

/** Número de expediente en sus tres partes, como figura en la carátula: 123 / 332 - 2026. */
export class NumeroExpedienteDto {
  @Texto()
  @Matches(/^\d{1,6}$/, { message: 'Ingrese el número de expediente (hasta 6 dígitos).' })
  numero: string;

  @Texto()
  @Matches(/^\d{1,4}$/, { message: 'Ingrese la repartición (hasta 4 dígitos).' })
  reparticion: string;

  /** Tiene que ser el año en curso (se controla en el service). */
  @IsInt({ message: 'Ingrese el año del expediente.' })
  anio: number;
}

export class IniciarAltaDto {
  @ValidateNested()
  @Type(() => NumeroExpedienteDto)
  expediente: NumeroExpedienteDto;

  /** Código de la situación legal: TITULAR, POSEEDOR o TENEDOR (GET /api/catalogos/situaciones-legales). */
  @Texto()
  @IsString()
  @IsNotEmpty({ message: 'Seleccione la situación legal del solicitante.' })
  situacionLegal: string;

  /** Ids de los papeles del checklist que trae el expediente. Puede ir vacío. */
  @IsArray()
  @ArrayUnique({ message: 'Hay documentos repetidos en el checklist.' })
  @IsInt({ each: true })
  documentacionPresentada: number[];
}
