import { localidad } from './fila-padron.js';

describe('Localidad del padrón → nombre del catálogo', () => {
  it('traduce las variantes confirmadas del departamento', () => {
    expect(localidad('TRANCAS', 'TRANCAS')).toBe('VILLA DE TRANCAS');
    expect(localidad('Trancas', ' el unquillar ')).toBe('UNQUILLAL');
    expect(localidad('TRANCAS', 'LEOCADIO PAZ')).toBe('LEOCADIO PAEZ');
  });

  it('las demás quedan como vienen (en mayúsculas)', () => {
    expect(localidad('TRANCAS', 'Ticucho')).toBe('TICUCHO');
    expect(localidad('TRANCAS', 'ZARATE')).toBe('ZARATE');
    // La equivalencia es por departamento: «TRANCAS» en otro departamento no se traduce.
    expect(localidad('BURRUYACU', 'TRANCAS')).toBe('TRANCAS');
  });

  it('sin dato → null', () => {
    expect(localidad('TRANCAS', '(SIN LOCALIDAD)')).toBeNull();
    expect(localidad('TRANCAS', null)).toBeNull();
  });
});
