// Pruebas de las reglas del circuito y del texto del aviso de deuda (sin base: npm test).
import { armarAvisoDeuda } from '../aviso-deuda.js';
import { exigirFechaDelAnio, exigirMotivoSiNoEsApto, normalizarNumerosConcesion } from './circuito.validaciones.js';

describe('Distrito y Jurídico', () => {
  it('observado y no apto llevan motivo; apto no', () => {
    expect(() => exigirMotivoSiNoEsApto('APTO')).not.toThrow();
    expect(() => exigirMotivoSiNoEsApto('OBSERVADO')).toThrow('Indique qué hay que corregir.');
    expect(() => exigirMotivoSiNoEsApto('NO_APTO')).toThrow('Indique el motivo por el que no es apto.');
    expect(() => exigirMotivoSiNoEsApto('NO_APTO', 'Sin disponibilidad hídrica.')).not.toThrow();
  });
});

describe('Secretaría General', () => {
  it('la fecha de la resolución es de su año', () => {
    expect(() => exigirFechaDelAnio('2026-10-02', 2026)).not.toThrow();
    expect(() => exigirFechaDelAnio('2025-12-30', 2026)).toThrow('La fecha de la resolución no coincide con el año.');
  });
});

describe('Catastro: números de concesión del libro', () => {
  it('quita los ceros a la izquierda', () => {
    expect(normalizarNumerosConcesion(['004521'], 1)).toEqual(['4521']);
  });

  it('tantos como se pidieron y sin repetir', () => {
    expect(() => normalizarNumerosConcesion(['1', '2'], 1)).toThrow('Ingrese un solo número de concesión.');
    expect(() => normalizarNumerosConcesion(['1'], 3)).toThrow('Se pidieron 3 números de concesión y llegaron 1.');
    expect(() => normalizarNumerosConcesion(['10', '010'], 2)).toThrow('El número de concesión 10 está repetido.');
    expect(normalizarNumerosConcesion(['10', '11'], 2)).toEqual(['10', '11']);
  });
});

describe('Aviso de deuda por correo', () => {
  const base = { expediente: '123/332-2026', tramite: 'Alta de concesión', titular: 'Medina, Juan Carlos' };

  it('lista cada deuda con su monto y el total', () => {
    const { asunto, cuerpo } = armarAvisoDeuda({
      ...base,
      deudas: [
        { detalle: 'Canon de riego 2025', monto: 125000 },
        { detalle: 'Canon de riego 2024', monto: 50000.5 },
      ],
    });
    expect(asunto).toBe('Deuda pendiente — expediente 123/332-2026');
    expect(cuerpo).toContain('Estimado/a Medina, Juan Carlos:');
    expect(cuerpo).toContain('trámite «Alta de concesión» del expediente 123/332-2026');
    expect(cuerpo).toMatch(/Canon de riego 2025: \$\s?125\.000,00/);
    expect(cuerpo).toMatch(/Total: \$\s?175\.000,50/);
  });

  it('sin monto no muestra importe ni total, y suma lo que agregó Recaudación', () => {
    const { cuerpo } = armarAvisoDeuda({ ...base, deudas: [{ detalle: 'Tasa al uso del agua', monto: null }], observaciones: 'Puede pagar en Brígido Terán 636.' });
    expect(cuerpo).toContain('  - Tasa al uso del agua\n');
    expect(cuerpo).not.toContain('Total');
    expect(cuerpo).toContain('Puede pagar en Brígido Terán 636.');
  });
});
