// Paso 2 del alta: la sección "Titular" completa (titulares + domicilios).
// Se manda siempre la lista entera: reemplaza lo que estaba cargado.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { DomicilioDto } from './domicilio.dto.js';
import { TitularDto } from './titular.dto.js';

export class GuardarTitularesDto {
  /** El primero es el titular principal (el que se muestra en bandejas y listados). */
  @IsArray()
  @ArrayMinSize(1, { message: 'Cargue al menos un titular.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TitularDto)
  titulares: TitularDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Cargue al menos un domicilio.' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DomicilioDto)
  domicilios: DomicilioDto[];
}
