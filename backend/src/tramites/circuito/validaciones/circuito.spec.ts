// Pruebas de las reglas del circuito y del texto del aviso de deuda (sin base: npm test).
import { armarAvisoDeuda } from '../aviso-deuda.js';
import { destinoTrasVerificarDeuda, exigirFechaDelAnio, exigirMotivoSiNoEsApto, normalizarNumerosConcesion, personasSinVerificar, respuestasDeDeuda, validarDecisionDeuda } from './circuito.validaciones.js';

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

  it('arma el aviso sin montos: solo en qué concesión hay deuda', () => {
    const { asunto, cuerpo } = armarAvisoDeuda({
      ...base,
      deudas: [{ detalle: 'Deuda de la concesión N° 906' }, { detalle: 'Deuda de la concesión N° 906' }, { detalle: 'Deuda de la concesión N° 1204' }],
    });
    expect(asunto).toBe('Aviso de deuda — expediente 123/332-2026');
    expect(cuerpo).toContain('Estimado/a Medina, Juan Carlos:');
    expect(cuerpo).toContain('trámite «Alta de concesión» del expediente 123/332-2026');
    expect(cuerpo).toContain('  - Deuda de la concesión N° 906\n  - Deuda de la concesión N° 1204\n');
    expect(cuerpo).toContain('acérquese a la Oficina de Recaudación');
    expect(cuerpo).not.toMatch(/\$|Total|monto/i);
  });

  it('agrega lo que escribió Recaudación', () => {
    const { cuerpo } = armarAvisoDeuda({ ...base, deudas: [{ detalle: 'Deuda de la concesión N° 906' }], observaciones: 'Atención de 8 a 13 h.' });
    expect(cuerpo).toContain('Atención de 8 a 13 h.');
  });
});

describe('Recaudación: titulares que cambiaron al corregir', () => {
  it('detecta las personas que Recaudación todavía no verificó', () => {
    expect(personasSinVerificar(['1', '2'], ['1', '2'])).toEqual([]);
    expect(personasSinVerificar(['1', '2'], ['2', '7'])).toEqual(['7']);
    // Verificaciones viejas (sin la lista de personas): no se puede saber, se toma como sin cambios.
    expect(personasSinVerificar(undefined, ['7'])).toEqual([]);
  });

  it('después del «sin deuda» vuelve a la oficina que observó solo si vino por un cambio de titulares', () => {
    const correccion = { id: '20', datos: { reverificaDeuda: true, vuelveA: 'JURIDICO' } };
    expect(destinoTrasVerificarDeuda(null, null, 'DISTRITO')).toBe('DISTRITO');
    // (Si hubo un «con deuda» en el medio, el último «sin deuda» sigue siendo el anterior a la corrección.)
    expect(destinoTrasVerificarDeuda(correccion, { id: '10', datos: null }, 'DISTRITO')).toBe('JURIDICO');
    // Una corrección ya atendida (hubo un «sin deuda» después) no cambia el camino.
    expect(destinoTrasVerificarDeuda(correccion, { id: '25', datos: null }, 'DISTRITO')).toBe('DISTRITO');
    // Una corrección común (sin cambio de titulares) tampoco.
    expect(destinoTrasVerificarDeuda({ id: '30', datos: { respondeA: '29' } }, { id: '10', datos: null }, 'DISTRITO')).toBe('DISTRITO');
  });
});

describe('Recaudación: deuda de las concesiones de los titulares', () => {
  const concesiones = [
    { id: '10', numero: '1234' },
    { id: '11', numero: null },
  ];

  it('devuelve la respuesta de cada concesión', () => {
    const r = respuestasDeDeuda(concesiones, [
      { concesionId: '10', tieneDeuda: true },
      { concesionId: '11', tieneDeuda: false },
    ]);
    expect(r.get('10')).toBe(true);
    expect(r.get('11')).toBe(false);
  });

  it('sin concesiones no hay nada que responder', () => {
    expect(respuestasDeDeuda([], []).size).toBe(0);
  });

  it('exige responder todas, una vez cada una y ninguna ajena', () => {
    expect(() => respuestasDeDeuda(concesiones, [{ concesionId: '10', tieneDeuda: false }])).toThrow('id 11');
    expect(() => respuestasDeDeuda(concesiones, [{ concesionId: '99', tieneDeuda: false }])).toThrow('no es de los titulares');
    expect(() =>
      respuestasDeDeuda(concesiones, [
        { concesionId: '10', tieneDeuda: false },
        { concesionId: '10', tieneDeuda: true },
      ]),
    ).toThrow('más de una vez');
  });
});

describe('Recaudación: Apto / No apto', () => {
  const concesiones = [
    { id: '10', numero: '906' },
    { id: '11', numero: null },
  ];
  const sinDeuda = new Map([
    ['10', false],
    ['11', false],
  ]);
  const conDeuda = new Map([
    ['10', true],
    ['11', false],
  ]);

  it('Apto sin deudas pasa', () => {
    expect(() => validarDecisionDeuda('APTO', concesiones, sinDeuda, [], undefined)).not.toThrow();
    expect(() => validarDecisionDeuda('APTO', [], new Map(), [], undefined)).not.toThrow();
  });

  it('Apto con una concesión marcada con deuda: corresponde No apto', () => {
    expect(() => validarDecisionDeuda('APTO', concesiones, conDeuda, [], undefined)).toThrow('Marcó deuda en la concesión N° 906: corresponde «No apto».');
  });

  it('Apto con deudas anteriores sin cancelar', () => {
    expect(() => validarDecisionDeuda('APTO', concesiones, sinDeuda, [{ detalle: 'Canon 2024' }], undefined)).toThrow(/registre el pago antes de marcar «Apto»/);
  });

  it('No apto exige la concesión con deuda y el motivo', () => {
    expect(() => validarDecisionDeuda('NO_APTO', concesiones, sinDeuda, [], 'Debe canon')).toThrow('Para «No apto», marque en qué concesión está la deuda.');
    expect(() => validarDecisionDeuda('NO_APTO', [], new Map(), [], 'Debe canon')).toThrow(/no hay deuda para marcar «No apto»/);
    expect(() => validarDecisionDeuda('NO_APTO', concesiones, conDeuda, [], '  ')).toThrow('Indique el motivo del «No apto» (qué se adeuda).');
    expect(() => validarDecisionDeuda('NO_APTO', concesiones, conDeuda, [], 'Canon 2025 impago')).not.toThrow();
    expect(() => validarDecisionDeuda('NO_APTO', [], new Map(), [{ detalle: 'Canon 2024' }], 'Deuda anterior')).not.toThrow();
  });
});
