// Datos que recibe el catálogo de suministro de riego (consulta y ABM del árbol por distrito).
// Los nombres se guardan en mayúsculas y sin espacios de más (lo hace el service).
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, MaxLength } from 'class-validator';
import { Texto } from '../../comun/validadores/texto.js';
import { NivelSuministro } from '../entities/suministro-nodo.entity.js';

/** Nombre de un tramo (fuente, sistema, canal o desagüe). */
export class NombreSuministroDto {
  @Texto()
  @MaxLength(120, { message: 'El nombre admite hasta 120 caracteres.' })
  @IsNotEmpty({ message: 'Ingrese el nombre.' })
  nombre: string;
}

/** Alta de un tramo: una fuente (sin `padreId`) o lo que cuelga de un tramo de un nivel anterior. */
export class NodoSuministroDto extends NombreSuministroDto {
  @IsPositive({ message: 'Seleccione el distrito.' })
  @IsInt({ message: 'Seleccione el distrito.' })
  distritoId: number;

  @IsEnum(NivelSuministro, { message: 'El nivel es FUENTE, SISTEMA, CANAL_PRINCIPAL … CANAL_QUINTO o DESAGUE.' })
  nivel: NivelSuministro;

  @IsOptional()
  @IsPositive({ message: 'El tramo del que viene tiene que ser un id.' })
  @IsInt({ message: 'El tramo del que viene tiene que ser un id.' })
  padreId?: number;
}

/** GET /api/catalogos/suministro: con `distrito` («II») devuelve solo el árbol de ese distrito. */
export class DistritoSuministroDto {
  @IsOptional() @Texto() @MaxLength(10) @IsNotEmpty()
  distrito?: string;
}
