import { claveCorrecta, cifrarClave, claveTemporal, errorClave, hashToken, nuevoToken } from './claves.js';

describe('claves', () => {
  it('cifra con sal al azar y verifica', async () => {
    const a = await cifrarClave('Secreta123');
    const b = await cifrarClave('Secreta123');
    expect(a).toMatch(/^scrypt\$/);
    expect(a).not.toBe(b);
    expect(await claveCorrecta('Secreta123', a)).toBe(true);
    expect(await claveCorrecta('secreta123', a)).toBe(false);
  });

  it('un hash vacío o con otro formato nunca coincide', async () => {
    expect(await claveCorrecta('x', null)).toBe(false);
    expect(await claveCorrecta('x', 'md5$abc')).toBe(false);
  });

  it('reglas: 8 o más caracteres, con letras y números', () => {
    expect(errorClave('corta1')).toMatch(/al menos 8/);
    expect(errorClave('soloLetras')).toMatch(/letras y números/);
    expect(errorClave('12345678')).toMatch(/letras y números/);
    expect(errorClave('Valida2026')).toBeNull();
  });

  it('la contraseña temporal cumple las reglas', () => {
    for (let i = 0; i < 50; i++) expect(errorClave(claveTemporal())).toBeNull();
  });

  it('el token se guarda solo como hash', () => {
    const t = nuevoToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
  });
});
