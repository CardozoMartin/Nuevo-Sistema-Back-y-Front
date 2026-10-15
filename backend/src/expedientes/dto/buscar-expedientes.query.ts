// Búsqueda general de expedientes: GET /api/expedientes/buscar?texto=&tipoTramite=&estado=&oficina=&desde=&hasta=&pagina=
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Matches, Max, MaxLength, Min } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { EstadoExpediente, Oficina, TipoTramite } from '../expedientes.constantes.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Además de cada estado: PENDIENTES = los que siguen circulando (no están en un estado final). */
export const ESTADOS_BUSQUEDA = [...Object.values(EstadoExpediente), 'PENDIENTES'] as const;

export class BuscarExpedientesQuery {
  /** N° de expediente (123, 123/332-2026), nombre o documento del titular. */
  @IsOptional()
  @Texto()
  @MaxLength(100, { message: 'La búsqueda admite hasta 100 caracteres.' })
  texto?: string;

  @IsOptional()
  @Texto()
  @IsEnum(TipoTramite, { message: 'Tipo de trámite desconocido.' })
  tipoTramite?: TipoTramite;

  @IsOptional()
  @Texto()
  @IsIn(ESTADOS_BUSQUEDA, { message: 'Estado desconocido.' })
  estado?: (typeof ESTADOS_BUSQUEDA)[number];

  /** Oficina donde está hoy. */
  @IsOptional()
  @Texto()
  @IsEnum(Oficina, { message: 'Oficina desconocida.' })
  oficina?: Oficina;

  /** Fecha de ingreso del expediente, desde / hasta (AAAA-MM-DD). */
  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha desde como AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha hasta como AAAA-MM-DD.' })
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Se pueden pedir hasta 100 expedientes por página.' })
  porPagina: number = 25;
}
