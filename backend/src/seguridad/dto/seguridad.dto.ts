import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Texto, TextoLista } from '../../comun/validadores/texto.js';

export class LoginDto {
  @Texto()
  @IsString()
  @MaxLength(150)
  @IsNotEmpty({ message: 'Ingrese su legajo o email.' })
  usuario: string;

  @IsString()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese la contraseña.' })
  clave: string;
}

export class CambiarClaveDto {
  @IsString()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese la contraseña actual.' })
  actual: string;

  @IsString()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese la contraseña nueva.' })
  nueva: string;
}

/** Alta y modificación de un usuario (ABM del administrador). */
export class UsuarioDto {
  @Texto()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'El legajo admite letras, números y guiones (hasta 20).' })
  @IsNotEmpty({ message: 'Ingrese el legajo.' })
  legajo: string;

  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese el apellido.' })
  apellido: string;

  @Texto()
  @MaxLength(100)
  @IsNotEmpty({ message: 'Ingrese el nombre.' })
  nombre: string;

  @Texto()
  @IsEmail({}, { message: 'El email no es válido.' })
  @MaxLength(150)
  @IsNotEmpty({ message: 'Ingrese el email.' })
  email: string;

  @IsOptional()
  @IsBoolean()
  esAdministrador?: boolean;

  /** Obligatorios salvo para un administrador sin oficina. */
  @ValidateIf((u: UsuarioDto) => !u.esAdministrador || u.oficina != null)
  @Texto()
  @IsString()
  @IsNotEmpty({ message: 'Elija la oficina.' })
  oficina?: string;

  @ValidateIf((u: UsuarioDto) => !u.esAdministrador || u.rol != null)
  @Texto()
  @IsString()
  @IsNotEmpty({ message: 'Elija el rol.' })
  rol?: string;

  /**
   * Permisos del usuario (de su oficina o generales). Si no viene: en el alta, o si cambió la
   * oficina o el rol, se precargan con la plantilla del rol; si no, se dejan como estaban.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permisos?: string[];
}

export class BajaUsuarioDto {
  @Texto()
  @MinLength(3, { message: 'Indique el motivo de la baja.' })
  @MaxLength(500)
  @IsNotEmpty({ message: 'Indique el motivo de la baja.' })
  motivo: string;
}

export class PermisosRolDto {
  @Texto()
  @IsString()
  @IsNotEmpty()
  oficina: string;

  @Texto()
  @IsString()
  @IsNotEmpty()
  rol: string;

  @IsArray()
  @ArrayMaxSize(100)
  @TextoLista()
  @IsString({ each: true })
  permisos: string[];
}

export const FILTROS_ESTADO_USUARIO = ['activos', 'baja', 'todos'] as const;

export class ListarUsuariosQuery {
  @IsOptional()
  @Texto()
  @MaxLength(100)
  texto?: string;

  @IsOptional()
  @Texto()
  oficina?: string;

  @IsOptional()
  @Texto()
  @IsIn(FILTROS_ESTADO_USUARIO)
  estado?: (typeof FILTROS_ESTADO_USUARIO)[number];
}
