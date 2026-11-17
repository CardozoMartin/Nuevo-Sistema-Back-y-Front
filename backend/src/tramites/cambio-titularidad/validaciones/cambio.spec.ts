// Pruebas de las reglas del Cambio de Titularidad (sin base: npm test).
import { EstadoConcesion } from '../../../concesiones/concesiones.constantes.js';
import {
  exigirConcesionVigente,
  exigirFechaDeResolucion,
  exigirPropuestaCompleta,
  exigirSinTramiteEnCurso,
  exigirTitularesDistintos,
  unirPersonas,
} from './cambio.validaciones.js';

describe('Inicio sobre una concesión', () => {
  it('solo sobre una concesión vigente', () => {
    expect(() => exigirConcesionVigente({ estado: EstadoConcesion.VIGENTE, numero: '906' })).not.toThrow();
    expect(() => exigirConcesionVigente({ estado: EstadoConcesion.EN_TRAMITE, numero: null })).toThrow('La concesión no está vigente (en tramite)');
    expect(() => exigirConcesionVigente({ estado: EstadoConcesion.ANULADA, numero: '906' })).toThrow('La concesión N° 906 no está vigente (anulada)');
  });

  it('sin otro trámite en curso', () => {
    expect(() => exigirSinTramiteEnCurso('906', null)).not.toThrow();
    expect(() => exigirSinTramiteEnCurso('906', { expediente: '12/332-2026', tramite: 'Cambio de titularidad' })).toThrow(
      'La concesión N° 906 tiene un trámite en curso (Cambio de titularidad, expediente 12/332-2026). Espere a que finalice.',
    );
  });
});

describe('Nuevos titulares', () => {
  it('no pueden ser exactamente los actuales', () => {
    expect(() => exigirTitularesDistintos(['20123456789'], ['20123456789'])).toThrow('son los mismos que los actuales');
    // El DNI y el CUIL que lo contiene son la misma persona.
    expect(() => exigirTitularesDistintos(['20123456789'], ['12345678'])).toThrow('son los mismos que los actuales');
    // El orden no importa.
    expect(() => exigirTitularesDistintos(['12345678', '23456789'], ['23456789', '12345678'])).toThrow('son los mismos que los actuales');
  });

  it('cambia si entra o sale alguno (puede quedar un cotitular)', () => {
    expect(() => exigirTitularesDistintos(['12345678'], ['23456789'])).not.toThrow();
    expect(() => exigirTitularesDistintos(['12345678'], ['12345678', '23456789'])).not.toThrow();
    expect(() => exigirTitularesDistintos(['12345678', '23456789'], ['12345678'])).not.toThrow();
    // Una concesión migrada puede tener titulares sin documento: no cuentan como iguales.
    expect(() => exigirTitularesDistintos([null], ['12345678'])).not.toThrow();
  });

  it('para enviar hace falta el nuevo titular y su domicilio legal', () => {
    expect(() => exigirPropuestaCompleta(1, 1)).not.toThrow();
    expect(() => exigirPropuestaCompleta(0, 1)).toThrow('Falta cargar el nuevo titular.');
    expect(() => exigirPropuestaCompleta(1, 0)).toThrow('Falta cargar el domicilio legal.');
    expect(() => exigirPropuestaCompleta(0, 0)).toThrow('Falta cargar el nuevo titular y el domicilio legal.');
  });
});

describe('Recaudación', () => {
  it('verifica a los actuales y a los nuevos, sin repetir a los que siguen', () => {
    const a = { id: '1' };
    const b = { id: '2' };
    const c = { id: '3' };
    expect(unirPersonas([a, b], [b, c]).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(unirPersonas([a], []).map((p) => p.id)).toEqual(['1']);
  });
});

describe('Cierre', () => {
  it('rige desde la fecha de la resolución', () => {
    expect(exigirFechaDeResolucion({ fecha: '2026-11-10' })).toBe('2026-11-10');
    expect(() => exigirFechaDeResolucion(null)).toThrow('falta la resolución');
  });
});
