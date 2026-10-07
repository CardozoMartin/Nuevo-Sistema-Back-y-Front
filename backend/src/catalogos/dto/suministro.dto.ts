// Datos que recibe el catálogo de suministro de riego.
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, MaxLength, ValidateIf } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';

/** Vincular una zona del catálogo de suministro a una localidad (null la desvincula). */
export class VincularZonaDto {
  /** Id de la localidad (GET /api/catalogos/localidades?departamentoId=…), o null. */
  @ValidateIf((d: VincularZonaDto) => d.localidadId !== null)
  @IsPositive({ message: 'Seleccione la localidad (o null para desvincular).' })
  @IsInt({ message: 'Seleccione la localidad (o null para desvincular).' })
  localidadId: number | null;
}

/** GET /api/catalogos/suministro/zonas: `sinVincular=true` para ver solo las que falta vincular. */
export class FiltroZonasDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sinVincular?: boolean;
}

/** GET /api/catalogos/suministro: con los tres nombres devuelve solo lo de esa ubicación. */
export class UbicacionSuministroDto {
  @IsOptional() @Texto() @MaxLength(80) @IsNotEmpty()
  departamento?: string;

  @IsOptional() @Texto() @MaxLength(100) @IsNotEmpty()
  localidad?: string;

  @IsOptional() @Texto() @MaxLength(100) @IsNotEmpty()
  distrito?: string;
}
