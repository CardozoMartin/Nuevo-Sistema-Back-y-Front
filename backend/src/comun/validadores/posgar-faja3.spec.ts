import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorEjePosgar, errorPuntoConvertido, mascaraPosgar } from './posgar-faja3.js';

describe('posgar-faja3 (regla compartida con el frontend)', () => {
  it('la copia del frontend es idéntica', () => {
    const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8').replace(/\r\n/g, '\n');
    expect(leer('../Proyecto En React - Full/src/lib/posgar-faja3.ts')).toBe(leer('src/comun/validadores/posgar-faja3.ts'));
  });

  describe('errorEjePosgar', () => {
    it('acepta X/Y de Tucumán con hasta 2 decimales, como texto o número', () => {
      expect(errorEjePosgar('3577293.45', 'x')).toBeNull();
      expect(errorEjePosgar(7035340.1, 'y')).toBeNull();
      expect(errorEjePosgar(3577293, 'x')).toBeNull();
    });

    it('rechaza cifras de más o de menos (ej: sin el punto decimal)', () => {
      expect(errorEjePosgar(3584508751, 'x')).toMatch(/7 cifras .* tiene 10: ¿falta el punto decimal\?/);
      expect(errorEjePosgar('357729', 'x')).toMatch(/tiene 6\./);
      expect(errorEjePosgar('03577293', 'x')).toMatch(/tiene 8/);
    });

    it('rechaza más de 2 decimales, separadores de miles y texto', () => {
      expect(errorEjePosgar(3577293.456, 'x')).toMatch(/hasta 2 decimales/);
      expect(errorEjePosgar('3.577.293', 'x')).toMatch(/solo con números y punto decimal/);
      expect(errorEjePosgar('3577293,45', 'x')).toMatch(/solo con números y punto decimal/);
      expect(errorEjePosgar('-3577293', 'x')).toMatch(/solo con números/);
    });

    it('rechaza fuera de rango y avisa si están invertidas', () => {
      expect(errorEjePosgar('7035340', 'x')).toMatch(/parece la Y/);
      expect(errorEjePosgar('3900000', 'x')).toMatch(/va de 3\.400\.000 a 3\.750\.000/);
      expect(errorEjePosgar('', 'y', 'del desagüe')).toBe('Ingrese la Y POSGAR del desagüe.');
    });
  });

  describe('mascaraPosgar', () => {
    it('ignora la tecla que agrega una cifra entera o un decimal de más', () => {
      expect(mascaraPosgar('35772934', '3577293')).toBe('3577293');
      expect(mascaraPosgar('3577293.456', '3577293.45')).toBe('3577293.45');
      expect(mascaraPosgar('3577293.4', '3577293.')).toBe('3577293.4');
      expect(mascaraPosgar('3.', '3')).toBe('3');
      expect(mascaraPosgar('3577293,', '3577293')).toBe('3577293.');
    });

    it('al tipear con puntos de miles (3.577.293,45) queda el número bien', () => {
      let v = '';
      for (const tecla of '3.577.293,45') v = mascaraPosgar(v + tecla, v);
      expect(v).toBe('3577293.45');
    });

    it('convierte la coma decimal y saca los separadores de miles', () => {
      expect(mascaraPosgar('3577293,45')).toBe('3577293.45');
      expect(mascaraPosgar('3.577.293,45')).toBe('3577293.45');
      expect(mascaraPosgar('3.577.293')).toBe('3577293');
      expect(mascaraPosgar('X: 3577293')).toBe('3577293');
    });

    it('un valor pegado con cifras de más no se recorta: lo marca la validación', () => {
      expect(mascaraPosgar('3584508751', '')).toBe('3584508751');
    });
  });

  it('errorPuntoConvertido: el punto convertido tiene que caer en Tucumán', () => {
    expect(errorPuntoConvertido(-26.83, -65.2)).toBeNull();
    expect(errorPuntoConvertido(-34.01, -59.98, 'del desagüe')).toMatch(/^El punto del desagüe cae fuera de Tucumán/);
    expect(errorPuntoConvertido(Number.NaN, -65)).toMatch(/No se pudo convertir/);
  });
});
