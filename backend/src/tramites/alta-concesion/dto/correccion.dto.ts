// Corrección de errores materiales de un alta: los mismos datos que la carga de cada sección,
// más el motivo (obligatorio: queda en el historial junto con el antes y el después).
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Texto } from '../../../comun/validadores/texto.js';
import { DatosInmuebleDto } from './datos-inmueble.dto.js';
import { GuardarTitularesDto } from './guardar-titulares.dto.js';
import { SuministroDto } from './suministro.dto.js';
import { UbicacionDto } from './ubicacion.dto.js';

// Mismas reglas en las cuatro secciones (las clases no pueden heredar de dos DTOs a la vez).
const Motivo = (): PropertyDecorator => (destino, propiedad) => {
  Texto()(destino, propiedad);
  IsString({ message: 'Indique el motivo de la corrección.' })(destino, propiedad);
  MinLength(10, { message: 'Explique el motivo de la corrección (al menos 10 caracteres).' })(destino, propiedad);
  MaxLength(2000)(destino, propiedad);
};

export class CorregirTitularesDto extends GuardarTitularesDto {
  @Motivo()
  motivo: string;
}

/** multipart/form-data: «archivo» (KML/GeoJSON corregido, optativo) + los campos de texto. */
export class CorregirUbicacionDto extends UbicacionDto {
  @Motivo()
  motivo: string;
}

export class CorregirInmuebleDto extends DatosInmuebleDto {
  @Motivo()
  motivo: string;
}

export class CorregirSuministroDto extends SuministroDto {
  @Motivo()
  motivo: string;
}
