import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { claveCorrecta, cifrarClave, errorClave, hashToken, nuevoToken } from './claves.js';
import { Sesion } from './entities/sesion.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PermisosService } from './permisos.service.js';

/** Intentos fallidos seguidos antes de bloquear, y por cuánto. */
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const INCORRECTO = 'Usuario o contraseña incorrectos.';

/**
 * Login con legajo o email y contraseña. Abre una sesión (token al azar; en la base solo su hash)
 * que vence por inactividad (SESION_HORAS, 8 por defecto).
 */
@Injectable()
export class AuthService {
  private readonly duracionMs: number;

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Sesion) private readonly sesiones: Repository<Sesion>,
    private readonly permisos: PermisosService,
    config: ConfigService,
  ) {
    this.duracionMs = Number(config.get('SESION_HORAS') ?? 8) * 3_600_000;
  }

  async login(identificador: string, clave: string, ip?: string, agente?: string) {
    //1.- Por legajo (sin importar mayúsculas) o por email.
    const id = identificador.trim();
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.claveHash')
      .leftJoinAndSelect('u.oficina', 'oficina')
      .leftJoinAndSelect('u.rol', 'rol')
      .leftJoinAndSelect('u.distrito', 'distrito')
      .where('upper(u.legajo) = upper(:id) OR lower(u.email) = lower(:id)', { id })
      .getOne();
    if (!usuario || !usuario.activo || !usuario.claveHash) throw new UnauthorizedException(INCORRECTO);

    //2.- Bloqueado por intentos fallidos.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const hora = usuario.bloqueadoHasta.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
      throw new UnauthorizedException(`Demasiados intentos fallidos: el usuario está bloqueado hasta las ${hora}.`);
    }

    //3.- Contraseña. Al quinto error seguido se bloquea un rato.
    if (!(await claveCorrecta(clave, usuario.claveHash))) {
      const intentos = usuario.intentosFallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await this.usuarios.update(usuario.id, { intentosFallidos: bloquear ? 0 : intentos, bloqueadoHasta: bloquear ? new Date(Date.now() + BLOQUEO_MIN * 60_000) : null });
      throw new UnauthorizedException(bloquear ? `Demasiados intentos fallidos: el usuario queda bloqueado ${BLOQUEO_MIN} minutos.` : INCORRECTO);
    }

    //4.- Sesión nueva.
    await this.usuarios.update(usuario.id, { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() });
    const token = nuevoToken();
    await this.sesiones.save(
      this.sesiones.create({ usuario: { id: usuario.id }, tokenHash: hashToken(token), expiraEn: new Date(Date.now() + this.duracionMs), ip: ip?.slice(0, 60) ?? null, agente: agente?.slice(0, 255) ?? null }),
    );
    return { token, usuario: await this.permisos.armarSesion(usuario) };
  }

  /** El usuario de un token válido. Cada uso corre el vencimiento (se guarda a lo sumo cada 5 minutos). */
  async validar(token: string): Promise<{ usuario: Usuario; sesionId: string }> {
    const sesion = await this.sesiones.findOne({ where: { tokenHash: hashToken(token), cerradaEn: IsNull(), expiraEn: MoreThan(new Date()) } });
    if (!sesion || !sesion.usuario.activo) throw new UnauthorizedException('La sesión venció o se cerró: vuelva a ingresar.');
    const nuevoVencimiento = Date.now() + this.duracionMs;
    if (nuevoVencimiento - sesion.expiraEn.getTime() > 5 * 60_000) await this.sesiones.update(sesion.id, { expiraEn: new Date(nuevoVencimiento) });
    return { usuario: sesion.usuario, sesionId: sesion.id };
  }

  async logout(sesionId: string) {
    await this.sesiones.update(sesionId, { cerradaEn: new Date() });
  }

  /** Cierra las sesiones abiertas del usuario (baja, restablecimiento o cambio de contraseña), salvo `excepto`. */
  async cerrarSesionesDe(usuarioId: string, excepto?: string) {
    await this.sesiones.update({ usuario: { id: usuarioId }, cerradaEn: IsNull(), ...(excepto ? { id: Not(excepto) } : {}) }, { cerradaEn: new Date() });
  }

  async cambiarClave(usuarioId: string, sesionId: string | undefined, actual: string, nueva: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId }, select: { id: true, claveHash: true } });
    if (!usuario || !(await claveCorrecta(actual, usuario.claveHash))) throw new BadRequestException('La contraseña actual no es correcta.');
    const error = errorClave(nueva);
    if (error) throw new BadRequestException(error);
    if (actual === nueva) throw new BadRequestException('La contraseña nueva tiene que ser distinta de la actual.');
    await this.usuarios.update(usuarioId, { claveHash: await cifrarClave(nueva), debeCambiarClave: false, modificadoUsuarioId: usuarioId });
    // Las demás sesiones abiertas (otra PC) se cierran; esta sigue.
    await this.cerrarSesionesDe(usuarioId, sesionId);
    const completo = await this.usuarios.findOneByOrFail({ id: usuarioId });
    return this.permisos.armarSesion(completo);
  }
}
