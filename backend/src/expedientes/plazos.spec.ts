import { describe, expect, it } from 'vitest';
import { calcularPlazo, compararPorPlazo } from './plazos.js';

// Las horas van en Tucumán (-03:00): lo que cuenta es la fecha local, no la UTC.
const llegada = new Date('2026-10-01T23:30:00-03:00');
const el = (fecha: string) => new Date(`${fecha}T10:00:00-03:00`);

describe('calcularPlazo (10 días)', () => {
  it('el día que llega: en plazo, vence 10 días después', () => {
    expect(calcularPlazo(llegada, 10, el('2026-10-01'))).toEqual({ dias: 10, transcurridos: 0, restantes: 10, vence: '2026-10-11', semaforo: 'EN_PLAZO' });
  });
  it('usa la fecha de Tucumán aunque en UTC ya sea el día siguiente', () => {
    expect(calcularPlazo(llegada, 10, new Date('2026-10-02T01:00:00-03:00')).transcurridos).toBe(1);
  });
  it('a 2 días del vencimiento avisa', () => {
    expect(calcularPlazo(llegada, 10, el('2026-10-08')).semaforo).toBe('EN_PLAZO');
    expect(calcularPlazo(llegada, 10, el('2026-10-09')).semaforo).toBe('POR_VENCER');
  });
  it('el día del vencimiento todavía no está vencido; al otro día sí', () => {
    expect(calcularPlazo(llegada, 10, el('2026-10-11'))).toMatchObject({ restantes: 0, semaforo: 'POR_VENCER' });
    expect(calcularPlazo(llegada, 10, el('2026-10-14'))).toMatchObject({ restantes: -3, semaforo: 'VENCIDO' });
  });
});

describe('compararPorPlazo', () => {
  it('vencidos (el más atrasado primero), por vencer, y el resto en su orden', () => {
    const fila = (id: string, fecha: string | null) => ({ id, plazo: fecha ? calcularPlazo(llegada, 10, el(fecha)) : null });
    const filas = [fila('a', '2026-10-02'), fila('sin', null), fila('b', '2026-10-10'), fila('c', '2026-10-12'), fila('d', '2026-10-20'), fila('e', '2026-10-03')];
    expect(filas.sort(compararPorPlazo).map((f) => f.id)).toEqual(['d', 'c', 'b', 'a', 'sin', 'e']);
  });
});
