import { esTelefonoValido } from './telefono.js';

describe('Teléfono de contacto', () => {
  it('acepta los formatos habituales', () => {
    expect(esTelefonoValido('(0381) 452-6393')).toBe(true);
    expect(esTelefonoValido('+54 9 381 123-4567')).toBe(true);
    expect(esTelefonoValido('3814526393')).toBe(true);
  });

  it('rechaza números muy cortos, muy largos o con letras', () => {
    expect(esTelefonoValido('452-63')).toBe(false);
    expect(esTelefonoValido('1234567890123456')).toBe(false);
    expect(esTelefonoValido('381 llamar tarde')).toBe(false);
  });
});
