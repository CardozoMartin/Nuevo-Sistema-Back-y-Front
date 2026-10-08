// Pruebas del árbol del catálogo de suministro (sin base: npm test).
import { arbolDeCanales, claveLocalidad, datosDeArbol, esTextoAjeno, exigirSuministroDelCatalogo, normalizarCatalogo } from './arbol-suministro.js';

// Un pedazo del catálogo de la DRH (Burruyacú, distrito II), con la forma del archivo original.
const crudo = {
  Burruyacu: {
    'La Ramada': {
      II: {
        fuentesAgua: ['rio sali', 'ARR. EL TIMBO', 'RIO SALI'],
        sistemasDistribucion: ['DIQUE NIVELADOR'],
        canalesPrincipales: { MATRIZ: ['DVDO. NORTE', 'DVDO. SUR'], COMUNERO: [] },
        cascada: { MATRIZ: { 'DVDO. NORTE': { 'LOS RALOS': { 'COMPUERTA 1': [], 'CPTA.7': ['PROPIO'] } } } },
        desagies: ['MISMA PROPIEDAD'],
      },
    },
  },
};
const zona = normalizarCatalogo(crudo).BURRUYACU['LA RAMADA'].II;
const LUGAR = 'LA RAMADA (BURRUYACU), distrito II';

describe('Catálogo de suministro: lectura del archivo de la DRH', () => {
  it('normaliza como el frontend: mayúsculas, sin repetidos, «desagies» → desagues', () => {
    expect(zona.fuentesAgua).toEqual(['ARR. EL TIMBO', 'RIO SALI']);
    expect(zona.desagues).toEqual(['MISMA PROPIEDAD']);
  });

  it('junta canalesPrincipales y cascada en un solo árbol, y lo vuelve a armar igual', () => {
    const arbol = arbolDeCanales(zona);
    expect(arbol.map((c) => c.nombre)).toEqual(['COMUNERO', 'MATRIZ']);
    expect(arbol[1].hijos.map((c) => c.nombre)).toEqual(['DVDO. NORTE', 'DVDO. SUR']);
    const datos = datosDeArbol(arbol);
    expect(datos.canalesPrincipales.MATRIZ).toEqual(['DVDO. NORTE', 'DVDO. SUR']);
    // El canal cuarto lleva sus quintos como lista (formato del frontend).
    expect(datos.cascada).toMatchObject({ MATRIZ: { 'DVDO. NORTE': { 'LOS RALOS': { 'COMPUERTA 1': [], 'CPTA.7': ['PROPIO'] } } } });
  });

  it('junta los canales hermanos que quedan con el mismo nombre al normalizar (no pisa el primero)', () => {
    // Caso real: Talamuyo (Juan B. Alberdi, distrito VI) trae «DVDO. NORTE» y «DVDO.  NORTE».
    const repetido = { B: { L: { VI: { cascada: { MATRIZ: { 'DVDO. NORTE': { 'LOS RALOS': { 'COMPUERTA 27': ['PROPIO'] } }, 'DVDO.  NORTE': { 'LOS RALOS': {} } } } } } } };
    expect(normalizarCatalogo(repetido).B.L.VI.cascada).toEqual({ MATRIZ: { 'DVDO. NORTE': { 'LOS RALOS': { 'COMPUERTA 27': ['PROPIO'] } } } });
  });

  it('descarta los textos de la página web que vinieron mezclados como canales', () => {
    const descartados: string[] = [];
    const conBasura = { B: { L: { II: { canalesPrincipales: { MATRIZ: ['DVDO. NORTE', '2. COSTO: ESTAMPILLAS PROVINCIALES $ 30'] }, cascada: { MATRIZ: { FORMULARIOS: {} } } } } } };
    const arbol = arbolDeCanales(normalizarCatalogo(conBasura, descartados).B.L.II);
    expect(arbol[0].hijos.map((c) => c.nombre)).toEqual(['DVDO. NORTE']);
    expect(descartados).toEqual(['2. COSTO: ESTAMPILLAS PROVINCIALES $ 30', 'FORMULARIOS']);
    expect(esTextoAjeno('6. E-MAIL: CATASTRO@RECURSOSHIDRICOS.GOV.AR')).toBe(true);
    expect(esTextoAjeno('CPTA.7')).toBe(false);
    expect(esTextoAjeno('DVDO. 2 DE MAYO')).toBe(false);
  });

  it('compara localidades escritas distinto (tildes, asterisco)', () => {
    expect(claveLocalidad('El Ojo*')).toBe(claveLocalidad('EL OJO'));
    expect(claveLocalidad('Concepción')).toBe('CONCEPCION');
  });
});

describe('Catálogo de suministro: validación del paso 6', () => {
  it('acepta un camino del árbol completo, hasta el canal quinto', () => {
    const seleccion = {
      fuentes: ['rio sali'],
      sistemaDistribucion: 'DIQUE NIVELADOR',
      canalPrincipal: 'MATRIZ',
      canalSecundario: 'DVDO. NORTE',
      canalesAdicionales: ['LOS RALOS', 'CPTA.7', 'PROPIO'],
      desague: 'MISMA PROPIEDAD',
    };
    expect(() => exigirSuministroDelCatalogo(zona, seleccion, LUGAR)).not.toThrow();
  });

  it('exige al menos una fuente y que cada valor sea de la zona', () => {
    expect(() => exigirSuministroDelCatalogo(zona, { fuentes: [] }, LUGAR)).toThrow('Seleccione al menos una fuente de agua.');
    expect(() => exigirSuministroDelCatalogo(zona, { fuentes: ['RIO LULES'] }, LUGAR)).toThrow('La fuente de agua «RIO LULES» no está en el catálogo de suministro de LA RAMADA');
    expect(() => exigirSuministroDelCatalogo(zona, { fuentes: ['RIO SALI'], desague: 'CANAL' }, LUGAR)).toThrow('El desagüe «CANAL»');
  });

  it('rechaza un canal que existe pero en otra rama del árbol', () => {
    expect(() => exigirSuministroDelCatalogo(zona, { fuentes: ['RIO SALI'], canalPrincipal: 'COMUNERO', canalSecundario: 'DVDO. NORTE' }, LUGAR)).toThrow(
      'El canal secundario «DVDO. NORTE» que deriva del canal principal «COMUNERO» no está en el catálogo',
    );
    expect(() => exigirSuministroDelCatalogo(zona, { fuentes: ['RIO SALI'], canalPrincipal: 'MATRIZ', canalSecundario: 'DVDO. SUR', canalesAdicionales: ['LOS RALOS'] }, LUGAR)).toThrow(
      'No tiene derivaciones en el catálogo.',
    );
  });

  it('sin catálogo para la ubicación, solo se acepta observación y caudal', () => {
    expect(() => exigirSuministroDelCatalogo(null, { fuentes: [] }, LUGAR)).not.toThrow();
    expect(() => exigirSuministroDelCatalogo(null, { fuentes: ['RIO SALI'] }, LUGAR)).toThrow('No hay catálogo de suministro para');
  });
});
