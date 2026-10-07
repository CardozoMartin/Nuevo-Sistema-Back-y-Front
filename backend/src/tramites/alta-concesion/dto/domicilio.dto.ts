// Domicilio legal declarado en el expediente.
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';

export class DomicilioDto {
  @Texto()
  @MaxLength(150)
  @IsNotEmpty({ message: 'Ingrese la calle o ruta.' })
  calle: string;

  @IsOptional()
  @Texto()
  @IsString()
  @MaxLength(20)
  numero?: string;

  // TODO(catalogos): validar contra cat_departamento / cat_localidad / cat_distrito.
  @Texto()
  @MaxLength(80)
  @IsNotEmpty({ message: 'Seleccione un departamento.' })
  departamento: string;

  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Seleccione una localidad.' })
  localidad: string;

  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Seleccione un distrito.' })
  distrito: string;
}
