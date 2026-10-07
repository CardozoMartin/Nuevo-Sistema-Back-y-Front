import { Transform } from 'class-transformer';

/**
 * Para campos de texto de los DTO: recorta espacios y convierte el texto vacío en undefined.
 * Así un campo opcional que llega como "" (el formulario manda los campos vacíos así) se
 * trata igual que uno que no llegó, y uno obligatorio con solo espacios falla.
 */
export function Texto() {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const recortado = value.trim();
    return recortado === '' ? undefined : recortado;
  });
}

/**
 * Para listas de textos: recorta cada elemento. Los vacíos se mantienen (como "") para
 * que la validación del elemento diga cuál falta, en vez de correrse las posiciones.
 */
export function TextoLista() {
  return Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((v: unknown) => (typeof v === 'string' ? v.trim() : v)) : value,
  );
}
