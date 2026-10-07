import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

export class CrearMaquinaDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, { message: 'El código solo admite letras, números y guiones (3 a 30).' })
  codigo: string;

  @IsOptional() @IsString() @MaxLength(120)
  modelo?: string;

  @IsOptional() @IsString() @MaxLength(30)
  capacidadDiametro?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  capacidadProfundidad?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  alturaTorre?: number;

  @IsOptional() @IsString() @MaxLength(20)
  vehiculoPatente?: string;

  @IsOptional() @IsString() @MaxLength(120)
  vehiculoModelo?: string;

  @IsOptional() @IsString()
  observaciones?: string;
}

/** Alta de empresa (RF05-RF09): la empresa con al menos una máquina. */
export class CrearEmpresaDto {
  @IsBoolean()
  personaJuridica: boolean;

  /** CUIT (jurídica) o CUIL (física): 11 dígitos, con o sin guiones. */
  @IsString()
  @Matches(/^\d{2}-?\d{8}-?\d$/, { message: 'El CUIT debe tener 11 dígitos.' })
  cuit: string;

  @ValidateIf((o: CrearEmpresaDto) => o.personaJuridica)
  @IsString() @Length(2, 200)
  razonSocial?: string;

  @ValidateIf((o: CrearEmpresaDto) => !o.personaJuridica)
  @IsString() @Length(2, 100)
  nombre?: string;

  @ValidateIf((o: CrearEmpresaDto) => !o.personaJuridica)
  @IsString() @Length(2, 100)
  apellido?: string;

  @IsOptional() @IsString() @MaxLength(30)
  ingresosBrutos?: string;

  @IsOptional() @IsBoolean()
  convenioMultilateral?: boolean;

  @IsOptional() @IsString() @MaxLength(30)
  registroComercio?: string;

  @IsOptional() @IsString() @MaxLength(255)
  domicilioFiscal?: string;

  @IsOptional() @IsString() @MaxLength(80)
  provincia?: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefono?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La empresa debe tener al menos una máquina.' })
  @ValidateNested({ each: true })
  @Type(() => CrearMaquinaDto)
  maquinas: CrearMaquinaDto[];
}
