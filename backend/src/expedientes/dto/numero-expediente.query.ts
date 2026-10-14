// Número de expediente en la query string: GET /api/expedientes/disponibilidad?numero=123&reparticion=332&anio=2026
import { Type } from 'class-transformer';
import { IsInt, Matches } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';

export class NumeroExpedienteQuery {
  @Texto()
  @Matches(/^\d{1,6}$/, { message: 'Ingrese el número de expediente (hasta 6 dígitos).' })
  numero: string;

  @Texto()
  @Matches(/^\d{1,4}$/, { message: 'Ingrese la repartición (hasta 4 dígitos).' })
  reparticion: string;

  @Type(() => Number)
  @IsInt({ message: 'Ingrese el año del expediente.' })
  anio: number;
}
