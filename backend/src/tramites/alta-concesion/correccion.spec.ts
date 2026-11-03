import { diferencias, exigirCambios, type Instantanea } from './correccion.js';

const campos = (pares: [string, string | null, boolean?][]): Instantanea => new Map(pares.map(([c, valor, sensible]) => [c, { valor, sensible }]));

describe('Corrección de datos: antes y después', () => {
  it('lista solo los campos que cambiaron, en orden', () => {
    const antes = campos([['Parcela', '254b'], ['Lámina', '2356'], ['Orden', null]]);
    const despues = campos([['Parcela', '254B'], ['Lámina', '2356'], ['Orden', '12']]);
    expect(diferencias(antes, despues)).toEqual([
      { campo: 'Parcela', antes: '254b', despues: '254B' },
      { campo: 'Orden', antes: null, despues: '12' },
    ]);
  });

  it('marca los datos sensibles (el historial los oculta sin permiso)', () => {
    const antes = campos([['Titular 1 · Documento', '30123456', true]]);
    const despues = campos([['Titular 1 · Documento', '30123465', true]]);
    expect(diferencias(antes, despues)).toEqual([{ campo: 'Titular 1 · Documento', antes: '30123456', despues: '30123465', sensible: true }]);
  });

  it('sin cambios no se registra nada', () => {
    const iguales = campos([['Folio', '154']]);
    expect(diferencias(iguales, iguales)).toEqual([]);
    expect(() => exigirCambios([])).toThrow('No hay cambios para guardar');
  });
});
