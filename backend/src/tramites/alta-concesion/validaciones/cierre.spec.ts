// Pruebas de las reglas del cierre: después de la resolución solo se completa lo que falta.
import { exigirSinCambios, exigirSoloCompletar } from './cierre.validaciones.js';

describe('Cierre: solo completar', () => {
  it('deja completar lo vacío y repetir lo mismo (sin importar mayúsculas ni formato del número)', () => {
    expect(() =>
      exigirSoloCompletar('el inmueble', [
        { nombre: 'lámina', actual: null, nuevo: '12' },
        { nombre: 'matrícula catastral', actual: 'MAT-1', nuevo: 'mat-1 ' },
        { nombre: 'año de dominio', actual: '1990', nuevo: 1990 },
      ]),
    ).not.toThrow();
  });

  it('rechaza cambiar o borrar lo que ya tenía valor, y dice qué campos', () => {
    expect(() =>
      exigirSoloCompletar('el inmueble', [
        { nombre: 'matrícula catastral', actual: 'MAT-1', nuevo: 'MAT-2' },
        { nombre: 'folio', actual: '300', nuevo: '' },
        { nombre: 'lámina', actual: null, nuevo: '12' },
      ]),
    ).toThrow('(matrícula catastral, folio)');
  });

  it('una sección bloqueada no acepta ningún cambio, ni siquiera completar', () => {
    expect(() => exigirSinCambios('el caudal asignado', [{ nombre: 'caudal', actual: '12.500', nuevo: 12.5 }])).not.toThrow();
    expect(() => exigirSinCambios('los titulares', [{ nombre: 'documentos', actual: ['20123456789'], nuevo: ['20123456789', '27301112225'] }])).toThrow('cambió: documentos');
  });
});
