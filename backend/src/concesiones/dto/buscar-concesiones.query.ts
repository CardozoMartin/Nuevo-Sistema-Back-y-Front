// Consulta de concesiones de Catastro: GET /api/concesiones/buscar?texto=&titular=&padron=&distrito=&localidad=…
// Todos los filtros son optativos y se combinan (Y). Las opciones de cada lista salen de GET /api/concesiones/filtros.
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, Matches, Max, MaxLength, Min } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { Caracter, CODIGOS_SERVICIO, EstadoConcesion } from '../concesiones.constantes.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SI_NO = ['SI', 'NO'] as const;
export const ORDENES_CONCESIONES = ['NUMERO', 'RECIENTES', 'TITULAR'] as const;

/** Texto libre de hasta 100 caracteres. */
function TextoBuscado() {
  return (objetivo: object, campo: string) => {
    IsOptional()(objetivo, campo);
    Texto()(objetivo, campo);
    MaxLength(100, { message: 'La búsqueda admite hasta 100 caracteres.' })(objetivo, campo);
  };
}

/** Id de un catálogo (departamento, localidad, distrito, cuenca). */
function IdCatalogo(nombre: string) {
  return (objetivo: object, campo: string) => {
    IsOptional()(objetivo, campo);
    Type(() => Number)(objetivo, campo);
    IsInt({ message: `${nombre} desconocido.` })(objetivo, campo);
  };
}

export class BuscarConcesionesQuery {
  // --- Búsqueda general ---

  /** N° de concesión, de expediente, padrón, matrícula, nombre o documento del titular. */
  @TextoBuscado()
  texto?: string;

  // --- Concesión y expediente ---

  @TextoBuscado()
  numeroConcesion?: string;

  /** Rango del N° de concesión (como número). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ingrese el N° de concesión desde (un número).' })
  @Min(0)
  numeroDesde?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ingrese el N° de concesión hasta (un número).' })
  @Min(0)
  numeroHasta?: number;

  /** N° de expediente: 123 o 123/332-2026. */
  @TextoBuscado()
  expediente?: string;

  @IsOptional()
  @Texto()
  @IsEnum(EstadoConcesion, { message: 'Estado de concesión desconocido.' })
  estado?: EstadoConcesion;

  @TextoBuscado()
  situacionLegal?: string;

  /** N° de resolución de otorgamiento. */
  @TextoBuscado()
  resolucion?: string;

  /** Fecha de otorgamiento, desde / hasta (AAAA-MM-DD). */
  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha desde como AAAA-MM-DD.' })
  otorgadaDesde?: string;

  @IsOptional()
  @Texto()
  @Matches(FECHA, { message: 'Ingrese la fecha hasta como AAAA-MM-DD.' })
  otorgadaHasta?: string;

  // --- Titular ---

  /** Apellido, nombre, razón social o denominación de cualquiera de los titulares. */
  @TextoBuscado()
  titular?: string;

  /** DNI, CUIL o CUIT de cualquiera de los titulares (con o sin guiones). */
  @TextoBuscado()
  documento?: string;

  // --- Ubicación de la concesión (ids del catálogo) ---

  @IdCatalogo('Departamento')
  departamento?: number;

  @IdCatalogo('Localidad')
  localidad?: number;

  @IdCatalogo('Distrito')
  distrito?: number;

  @IdCatalogo('Cuenca')
  cuenca?: number;

  // --- Inmueble ---

  @TextoBuscado()
  padron?: string;

  @TextoBuscado()
  matricula?: string;

  @TextoBuscado()
  circunscripcion?: string;

  @TextoBuscado()
  seccion?: string;

  @TextoBuscado()
  parcela?: string;

  /** Matrícula del registro de dominio. */
  @TextoBuscado()
  matriculaDominio?: string;

  // --- Usos y caudal ---

  /** Código del tipo de uso (la concesión lo tiene entre sus usos). */
  @TextoBuscado()
  tipoUso?: string;

  @IsOptional()
  @Texto()
  @IsEnum(Caracter, { message: 'El carácter debe ser PERMANENTE o EVENTUAL.' })
  caracter?: Caracter;

  @IsOptional()
  @Type(() => Number)
  @IsIn(CODIGOS_SERVICIO, { message: 'Código de servicio desconocido.' })
  codigoServicio?: number;

  /** Caudal asignado (l/s), desde / hasta. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Ingrese el caudal mínimo en l/s.' })
  @Min(0)
  caudalDesde?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Ingrese el caudal máximo en l/s.' })
  @Min(0)
  caudalHasta?: number;

  // --- Suministro ---

  @TextoBuscado()
  fuente?: string;

  @TextoBuscado()
  sistemaDistribucion?: string;

  /** Cualquier canal de la cascada (principal a quinto). */
  @TextoBuscado()
  canal?: string;

  // --- Situación ---

  /** SI: tiene polígono cargado; NO: le falta. */
  @IsOptional()
  @Texto()
  @IsIn(SI_NO, { message: 'Indique SI o NO.' })
  conPoligono?: (typeof SI_NO)[number];

  /** SI: tiene deuda pendiente registrada por Recaudación; NO: no tiene. */
  @IsOptional()
  @Texto()
  @IsIn(SI_NO, { message: 'Indique SI o NO.' })
  conDeuda?: (typeof SI_NO)[number];

  // --- Orden y página ---

  @IsOptional()
  @Texto()
  @IsIn(ORDENES_CONCESIONES, { message: 'Orden desconocido.' })
  orden: (typeof ORDENES_CONCESIONES)[number] = 'NUMERO';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Se pueden pedir hasta 100 concesiones por página.' })
  porPagina: number = 25;
}
