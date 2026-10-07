// Un titular de la concesión. Las reglas cambian según sea persona física o jurídica.
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { DocumentoValido } from '../../../comun/validadores/documento.js';
import { NoEsFechaFutura } from '../../../comun/validadores/fechas.js';
import { Texto } from '../../../comun/validadores/texto.js';
import { TipoDocumento, TipoPersona } from '../../../concesiones/concesiones.constantes.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFisica = (t: TitularDto) => t.tipoPersona === TipoPersona.FISICA;
const esJuridica = (t: TitularDto) => t.tipoPersona === TipoPersona.JURIDICA;

export class TitularDto {
  @IsEnum(TipoPersona, { message: 'El tipo de persona debe ser FISICA o JURIDICA.' })
  tipoPersona: TipoPersona;

  @IsEnum(TipoDocumento, { message: 'El tipo de documento debe ser DNI, CUIL o CUIT.' })
  tipoDocumento: TipoDocumento;

  /** Solo dígitos. DNI 7-8; CUIL/CUIT 11 con dígito verificador. Persona jurídica: siempre CUIT. */
  @Texto()
  @DocumentoValido()
  documento: string;

  // --- Persona física: apellido, nombre y fecha de nacimiento obligatorios ---

  @ValidateIf(esFisica)
  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese el apellido.' })
  apellido?: string;

  @ValidateIf(esFisica)
  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese el nombre.' })
  nombre?: string;

  @ValidateIf(esFisica)
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de nacimiento (AAAA-MM-DD).' })
  @NoEsFechaFutura()
  fechaNacimiento?: string;

  // --- Persona jurídica: razón social y fecha de constitución obligatorias ---

  @ValidateIf(esJuridica)
  @Texto()
  @MaxLength(200)
  @IsNotEmpty({ message: 'Ingrese la razón social.' })
  razonSocial?: string;

  @ValidateIf(esJuridica)
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha de constitución (AAAA-MM-DD).' })
  @NoEsFechaFutura()
  fechaConstitucion?: string;

  // --- Contacto (opcional) ---

  @IsOptional()
  @Texto()
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido.' })
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Texto()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
