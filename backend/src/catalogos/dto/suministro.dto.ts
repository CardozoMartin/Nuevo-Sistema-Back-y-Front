// Datos que recibe el catálogo de suministro de riego (consulta y ABM).
// Los nombres se guardan en mayúsculas y sin espacios de más (lo hace el service).
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, MaxLength, ValidateIf } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { TipoOpcionSuministro } from '../entities/suministro-opcion.entity.js';

/** Vincular una zona del catálogo de suministro a una localidad (null la desvincula). */
export class VincularZonaDto {
  /** Id de la localidad (GET /api/catalogos/localidades?departamentoId=…), o null. */
  @ValidateIf((d: VincularZonaDto) => d.localidadId !== null)
  @IsPositive({ message: 'Seleccione la localidad (o null para desvincular).' })
  @IsInt({ message: 'Seleccione la localidad (o null para desvincular).' })
  localidadId: number | null;
}

/**
 * GET /api/catalogos/suministro/zonas: `sinVincular=true` para ver solo las que falta vincular;
 * `todas=true` incluye las dadas de baja.
 */
export class FiltroZonasDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sinVincular?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  todas?: boolean;
}

/**
 * Alta de una zona: departamento + distrito y, si corresponde, la localidad del catálogo de
 * ubicación. `localidadOrigen` es el nombre con que la DRH conoce la zona; si no viene, se usa
 * el de la localidad. Sin localidad, la zona es «(SIN LOCALIDAD)» o queda para vincular después.
 */
export class ZonaSuministroDto {
  @IsPositive({ message: 'Seleccione el departamento.' })
  @IsInt({ message: 'Seleccione el departamento.' })
  departamentoId: number;

  @IsPositive({ message: 'Seleccione el distrito.' })
  @IsInt({ message: 'Seleccione el distrito.' })
  distritoId: number;

  @IsOptional()
  @IsPositive({ message: 'La localidad tiene que ser un id.' })
  @IsInt({ message: 'La localidad tiene que ser un id.' })
  localidadId?: number;

  @IsOptional()
  @Texto()
  @MaxLength(100, { message: 'El nombre de la zona admite hasta 100 caracteres.' })
  localidadOrigen?: string;
}

/** Modificación de una zona: el nombre con que la conoce la DRH (la localidad se cambia con /localidad). */
export class EditarZonaSuministroDto {
  @Texto()
  @MaxLength(100, { message: 'El nombre de la zona admite hasta 100 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre de la zona.' })
  localidadOrigen: string;
}

/** Nombre de una fuente, sistema, desagüe o canal. */
export class NombreSuministroDto {
  @Texto()
  @MaxLength(120, { message: 'El nombre admite hasta 120 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre.' })
  nombre: string;
}

/** Alta de una opción de la zona: FUENTE, SISTEMA (de distribución) o DESAGUE. */
export class OpcionSuministroDto extends NombreSuministroDto {
  @IsEnum(TipoOpcionSuministro, { message: 'El tipo es FUENTE, SISTEMA o DESAGUE.' })
  tipo: TipoOpcionSuministro;
}

/** Alta de un canal: sin `padreId` es un canal principal; con él, una derivación de ese canal. */
export class CanalSuministroDto extends NombreSuministroDto {
  @IsOptional()
  @IsPositive({ message: 'El canal padre tiene que ser un id.' })
  @IsInt({ message: 'El canal padre tiene que ser un id.' })
  padreId?: number;
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
