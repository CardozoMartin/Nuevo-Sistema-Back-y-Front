// Inicio del cambio de titularidad: la concesión elegida en la búsqueda + el expediente en papel.
import { Type } from 'class-transformer';
import { IsString, Matches, ValidateNested } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';
import { NumeroExpedienteDto } from '../../alta-concesion/dto/iniciar-alta.dto.js';

export class IniciarCambioDto {
  /** Id de la concesión vigente (sale de la búsqueda de concesiones). */
  @Texto()
  @IsString()
  @Matches(/^\d{1,18}$/, { message: 'Seleccione la concesión.' })
  concesionId: string;

  @ValidateNested()
  @Type(() => NumeroExpedienteDto)
  expediente: NumeroExpedienteDto;
}
