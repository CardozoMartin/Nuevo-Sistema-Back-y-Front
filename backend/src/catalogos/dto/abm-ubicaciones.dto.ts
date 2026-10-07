// Datos que recibe el ABM del catálogo de ubicación (departamentos, localidades, distritos, cuencas).
// Los nombres se guardan en mayúsculas y sin espacios de más (lo hace el service).
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, Matches, MaxLength, MinLength } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';

/** Departamento o cuenca: solo el nombre. */
export class NombreCatalogoDto {
  @Texto()
  @MaxLength(120, { message: 'El nombre admite hasta 120 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre.' })
  nombre: string;
}

export class LocalidadDto {
  /** Id del departamento (GET /api/catalogos/departamentos). */
  @IsPositive({ message: 'Seleccione el departamento.' })
  @IsInt({ message: 'Seleccione el departamento.' })
  departamentoId: number;

  @Texto()
  @MaxLength(100, { message: 'El nombre de la localidad admite hasta 100 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre de la localidad.' })
  nombre: string;

  /** Id del distrito de riego (GET /api/catalogos/distritos). */
  @IsPositive({ message: 'Seleccione el distrito.' })
  @IsInt({ message: 'Seleccione el distrito.' })
  distritoId: number;
}

export class DistritoDto {
  /** Número romano: I, II, III… */
  @Texto()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @Matches(/^[IVX]{1,6}$/, { message: 'El código del distrito es un número romano (I, II, III…).' })
  codigo: string;

  /** Para mostrar. Si no viene, «Distrito <código>». */
  @IsOptional()
  @Texto()
  @MaxLength(60)
  nombre?: string;
}

/** Baja lógica: el motivo es obligatorio (RN-A04). */
export class BajaCatalogoDto {
  @Texto()
  @MinLength(10, { message: 'Indique el motivo de la baja (al menos 10 caracteres).' })
  @MaxLength(1000)
  @IsNotEmpty({ message: 'Indique el motivo de la baja.' })
  motivo: string;
}

/** Filtros de los listados del ABM. */
export class FiltroCatalogoDto {
  /** true = también los dados de baja (para administrarlos). Por defecto solo los activos. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  todas?: boolean;

  /** Texto a buscar en el nombre. */
  @IsOptional()
  @Texto()
  @MaxLength(100)
  q?: string;
}

export class FiltroLocalidadesDto extends FiltroCatalogoDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsPositive()
  @IsInt({ message: 'El departamento tiene que ser un id.' })
  departamentoId?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsPositive()
  @IsInt({ message: 'El distrito tiene que ser un id.' })
  distritoId?: number;
}
