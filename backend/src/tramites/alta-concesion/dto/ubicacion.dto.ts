// Paso 3 del alta: ubicación del inmueble. Llega como multipart/form-data:
//   - archivo: el KML con la concesión dibujada (obligatorio la primera vez)
//   - departamento, localidad, distrito: campos de texto
import { IsNotEmpty, MaxLength } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';

export class UbicacionDto {
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
