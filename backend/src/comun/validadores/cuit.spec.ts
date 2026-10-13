import { claveDeDocumento, dniDeDocumento } from './cuit.js';

describe('DNI dentro de un documento', () => {
  it('saca el DNI de un DNI o de un CUIL / CUIT de persona física', () => {
    expect(dniDeDocumento('12345678')).toBe('12345678');
    expect(dniDeDocumento('20123456786')).toBe('12345678');
    expect(dniDeDocumento('27301112225')).toBe('30111222');
    // DNI de 7 dígitos: en el CUIL va con un cero adelante.
    expect(dniDeDocumento('2345678')).toBe('2345678');
    expect(dniDeDocumento('20023456781')).toBe('2345678');
  });

  it('un CUIT de persona jurídica no lleva DNI', () => {
    expect(dniDeDocumento('30712345678')).toBeNull();
    expect(claveDeDocumento('30712345678')).toBe('30712345678');
  });

  it('DNI y CUIL de la misma persona tienen la misma clave', () => {
    expect(claveDeDocumento('12345678')).toBe(claveDeDocumento('20123456786'));
  });
});
