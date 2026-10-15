// Contraseñas: scrypt (incluido en Node, sin dependencias) con sal al azar por usuario.
// Formato guardado: scrypt$<sal base64>$<hash base64>.
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;
const LARGO = 64;

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(clave, sal, LARGO);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

/** Compara en tiempo constante. false si el hash guardado no tiene el formato esperado. */
export async function claveCorrecta(clave: string, guardado: string | null | undefined): Promise<boolean> {
  const [algoritmo, sal, hash] = guardado?.split('$') ?? [];
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(clave, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(calculado, esperado);
}

/** Reglas mínimas: 8 caracteres o más, con letras y números. Mensaje de error o null. */
export function errorClave(clave: string): string | null {
  if (clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
  if (clave.length > 100) return 'La contraseña admite hasta 100 caracteres.';
  if (!/[a-zA-ZñÑ]/.test(clave) || !/\d/.test(clave)) return 'La contraseña tiene que tener letras y números.';
  return null;
}

/** Contraseña temporal para el alta o el restablecimiento (se cambia al entrar). Sin caracteres que se confunden. */
export function claveTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const todos = letras + numeros;
  const chars = [letras[randomInt(letras.length)], numeros[randomInt(numeros.length)], ...Array.from({ length: 8 }, () => todos[randomInt(todos.length)])];
  return chars.sort(() => randomInt(3) - 1).join('');
}

/** Token de sesión: 32 bytes al azar. En la base se guarda solo su SHA-256. */
export const nuevoToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
