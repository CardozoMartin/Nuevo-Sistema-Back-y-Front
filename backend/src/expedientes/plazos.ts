/**
 * Plazo de un expediente en la oficina donde está (los días salen de cat_plazo_oficina).
 * Se cuentan días corridos desde el día en que llegó, en la fecha de Tucumán.
 *   EN_PLAZO     le quedan más de AVISO_DIAS_ANTES días.
 *   POR_VENCER   le quedan AVISO_DIAS_ANTES días o menos (incluye el día en que vence).
 *   VENCIDO      pasó el día del vencimiento.
 */
export type SemaforoPlazo = 'EN_PLAZO' | 'POR_VENCER' | 'VENCIDO';

/** Desde cuántos días antes del vencimiento la bandeja avisa. */
export const AVISO_DIAS_ANTES = 2;

const DIA = 86_400_000;
const fechaTucuman = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Tucuman' }).format(d);

export interface PlazoEnOficina {
  dias: number;
  transcurridos: number;
  /** Negativo: días de atraso. */
  restantes: number;
  /** Fecha de vencimiento (AAAA-MM-DD). */
  vence: string;
  semaforo: SemaforoPlazo;
}

export function calcularPlazo(llegada: Date, dias: number, ahora = new Date()): PlazoEnOficina {
  const desde = Date.parse(fechaTucuman(llegada));
  const transcurridos = Math.round((Date.parse(fechaTucuman(ahora)) - desde) / DIA);
  const restantes = dias - transcurridos;
  return {
    dias,
    transcurridos,
    restantes,
    vence: new Date(desde + dias * DIA).toISOString().slice(0, 10),
    semaforo: restantes < 0 ? 'VENCIDO' : restantes <= AVISO_DIAS_ANTES ? 'POR_VENCER' : 'EN_PLAZO',
  };
}

const URGENCIA: Record<SemaforoPlazo, number> = { VENCIDO: 0, POR_VENCER: 1, EN_PLAZO: 2 };

/** Orden de la bandeja: vencidos y por vencer primero (el más atrasado arriba); los demás, como venían. */
export const compararPorPlazo = (a: { plazo: PlazoEnOficina | null }, b: { plazo: PlazoEnOficina | null }) =>
  (a.plazo ? URGENCIA[a.plazo.semaforo] : 2) - (b.plazo ? URGENCIA[b.plazo.semaforo] : 2) ||
  (a.plazo && b.plazo && a.plazo.semaforo !== 'EN_PLAZO' ? a.plazo.restantes - b.plazo.restantes : 0);
