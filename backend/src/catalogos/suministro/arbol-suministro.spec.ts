// Pruebas del árbol de suministro por distrito (sin base: npm test).
import { arbolDesdeRamas, esTextoAjeno, exigirSuministroDelArbol, type NodoArbol } from './arbol-suministro.js';

// Un pedazo de lo que cargaron los jefes (distrito I), con la forma del Excel: una fila por rama.
const ramas = [
  ['RIO CHOROMORO', 'DIQUE LA HIGUERA-CHOROMORO', 'MATRIZ LA HIGUERA', 'DERIVADO ESTE (LA COLONIA)', null, null, null, null],
  ['RIO CHOROMORO', 'DIQUE LA HIGUERA-CHOROMORO', 'MATRIZ LA HIGUERA', 'DERIVADO NORTE (SAN JULIAN-BENJAMIN PAZ)', 'DERIVADO NORTE I (BENJAMIN PAZ)', 'DERIVADO BENJAMIN PAZ DE ABAJO', null, null],
  ['RIO CHOROMORO', 'DIQUE LA HIGUERA-CHOROMORO', 'MATRIZ LA HIGUERA', 'DERIVADO NORTE (SAN JULIAN-BENJAMIN PAZ)', 'DERIVADO NORTE I (BENJAMIN PAZ)', 'DERIVADO BENJAMIN PAZ DE ARRIBA', null, null],
  ['rio  sali', 'DIQUE EL TALA', null, null, null, null, null, null],
  // Una rama sin canal secundario ni siguientes: el desagüe cuelga del principal.
  ['RIO EL CHURQUI', 'ZAVALETA', 'MATRIZ PRESURIZADO EL CHURQUI', null, null, null, null, 'RIO EL CHURQUI'],
];
const arbol = arbolDesdeRamas(ramas);
const LUGAR = 'el distrito I';
const nombres = (nodos: NodoArbol[]) => nodos.map((n) => n.nombre);

describe('Árbol de suministro: lectura del Excel de los jefes', () => {
  it('junta las ramas que comparten el comienzo y ordena alfabéticamente', () => {
    expect(nombres(arbol)).toEqual(['RIO CHOROMORO', 'RIO EL CHURQUI', 'RIO SALI']);
    const matriz = arbol[0].hijos[0].hijos[0];
    expect(matriz).toMatchObject({ nombre: 'MATRIZ LA HIGUERA', nivel: 'CANAL_PRINCIPAL' });
    expect(nombres(matriz.hijos)).toEqual(['DERIVADO ESTE (LA COLONIA)', 'DERIVADO NORTE (SAN JULIAN-BENJAMIN PAZ)']);
    expect(nombres(matriz.hijos[1].hijos[0].hijos)).toEqual(['DERIVADO BENJAMIN PAZ DE ABAJO', 'DERIVADO BENJAMIN PAZ DE ARRIBA']);
  });

  it('deja los nombres como están (solo mayúsculas y sin espacios de más)', () => {
    expect(arbol[2]).toMatchObject({ nombre: 'RIO SALI', nivel: 'FUENTE' });
  });

  it('un nivel vacío se salta: lo siguiente cuelga del último con valor', () => {
    const matriz = arbol[1].hijos[0].hijos[0];
    expect(matriz.hijos).toEqual([{ nombre: 'RIO EL CHURQUI', nivel: 'DESAGUE', hijos: [] }]);
  });

  it('una rama sin fuente no se carga y se informa', () => {
    const descartadas: string[] = [];
    expect(arbolDesdeRamas([[null, 'SISTEMA SUELTO', null, null, null, null, null, null]], descartadas)).toEqual([]);
    expect(descartadas).toEqual(['SISTEMA SUELTO']);
  });

  it('reconoce los textos que no son tramos (los de la página web de la DRH)', () => {
    expect(esTextoAjeno('2. COSTO: ESTAMPILLAS PROVINCIALES $ 30')).toBe(true);
    expect(esTextoAjeno('DERIVADO NORTE')).toBe(false);
  });
});

describe('Árbol de suministro: validación del paso 6', () => {
  const camino = {
    fuentes: ['RIO CHOROMORO'],
    sistemaDistribucion: 'DIQUE LA HIGUERA-CHOROMORO',
    canalPrincipal: 'MATRIZ LA HIGUERA',
    canalSecundario: 'DERIVADO NORTE (SAN JULIAN-BENJAMIN PAZ)',
    canalTerciario: 'DERIVADO NORTE I (BENJAMIN PAZ)',
    canalCuarto: 'DERIVADO BENJAMIN PAZ DE ARRIBA',
  };

  it('acepta un camino del árbol, completo o cortado en cualquier tramo', () => {
    expect(() => exigirSuministroDelArbol(arbol, camino, LUGAR)).not.toThrow();
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: ['RIO SALI'], sistemaDistribucion: 'DIQUE EL TALA' }, LUGAR)).not.toThrow();
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: ['rio sali'] }, LUGAR)).not.toThrow();
  });

  it('acepta los niveles salteados si la rama no los tiene', () => {
    const conDesague = { fuentes: ['RIO EL CHURQUI'], sistemaDistribucion: 'ZAVALETA', canalPrincipal: 'MATRIZ PRESURIZADO EL CHURQUI', desague: 'RIO EL CHURQUI' };
    expect(() => exigirSuministroDelArbol(arbol, conDesague, LUGAR)).not.toThrow();
  });

  it('rechaza saltear un nivel que la rama sí tiene', () => {
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: ['RIO CHOROMORO'], canalPrincipal: 'MATRIZ LA HIGUERA' }, LUGAR)).toThrow(
      'El canal principal «MATRIZ LA HIGUERA» no sale de «RIO CHOROMORO» en el árbol de suministro de el distrito I. De «RIO CHOROMORO» no sale ningún canal principal.',
    );
  });

  it('exige al menos una fuente y que cada fuente sea del distrito', () => {
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: [] }, LUGAR)).toThrow('Seleccione al menos una fuente de agua.');
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: ['RIO CHOROMORO', 'RIO VIPOS'] }, LUGAR)).toThrow('La fuente de agua «RIO VIPOS» no está en el árbol de suministro de el distrito I.');
  });

  it('rechaza un tramo que existe pero en otra rama, con las opciones válidas', () => {
    expect(() => exigirSuministroDelArbol(arbol, { ...camino, canalSecundario: 'DERIVADO ESTE (LA COLONIA)' }, LUGAR)).toThrow(
      'El canal terciario «DERIVADO NORTE I (BENJAMIN PAZ)» no sale de «DERIVADO ESTE (LA COLONIA)»',
    );
    expect(() => exigirSuministroDelArbol(arbol, { fuentes: ['RIO SALI'], sistemaDistribucion: 'ZAVALETA' }, LUGAR)).toThrow('Opciones: DIQUE EL TALA.');
  });

  it('sin árbol para el distrito, solo se acepta observación y caudal', () => {
    expect(() => exigirSuministroDelArbol(null, { fuentes: [] }, 'el distrito V')).not.toThrow();
    expect(() => exigirSuministroDelArbol(null, { fuentes: ['RIO MEDINA'] }, 'el distrito V')).toThrow('No hay árbol de suministro cargado para el distrito V');
  });
});
