// Pruebas de la coordenada de los puntos (desagüe, entrega): X/Y POSGAR o latitud/longitud.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CoordenadaDto } from './usos.dto.js';

const errores = (datos: object) =>
  validateSync(plainToInstance(CoordenadaDto, datos)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('CoordenadaDto', () => {
  it('acepta X/Y POSGAR 2007 faja 3 dentro de Tucumán', () => {
    expect(errores({ x: 3577293.45, y: 7035340.12 })).toEqual([]);
  });

  it('acepta latitud/longitud en grados decimales dentro de Tucumán', () => {
    expect(errores({ latitud: -27.05362983, longitud: -65.23122447 })).toEqual([]);
  });

  it('rechaza latitud/longitud fuera de Tucumán (ej: provincia de Buenos Aires)', () => {
    const e = errores({ latitud: -34.01362983, longitud: -59.98122447 });
    expect(e).toContain('La latitud debe estar entre -28,1 y -25,95 (Tucumán).');
    expect(e).toContain('La longitud debe estar entre -66,3 y -64,4 (Tucumán).');
  });

  it('rechaza latitud y longitud invertidas', () => {
    expect(errores({ latitud: -65.23, longitud: -27.05 }).length).toBeGreaterThan(0);
  });

  it('pide la coordenada si no viene ninguna', () => {
    expect(errores({})).toContain('Ingrese la X POSGAR en metros (hasta 2 decimales), o la latitud y longitud.');
  });

  it('si viene en grados no exige X/Y (y al revés)', () => {
    expect(errores({ latitud: -27.05 })).toContain('Ingrese la longitud en grados decimales (hasta 8 decimales).');
    expect(errores({ x: 3577293 })).toContain('Ingrese la Y POSGAR en metros (hasta 2 decimales), o la latitud y longitud.');
  });
});
