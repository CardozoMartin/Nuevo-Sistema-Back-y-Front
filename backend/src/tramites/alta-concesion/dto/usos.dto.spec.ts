// Pruebas de la coordenada de los puntos (desagüe, entrega): X/Y POSGAR o latitud/longitud.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CoordenadaDto, DesagueDto } from './usos.dto.js';

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
    expect(errores({})).toContain('Ingrese la X POSGAR en metros (ej: 3577293.45), o la latitud y longitud.');
  });

  it('si viene en grados no exige X/Y (y al revés)', () => {
    expect(errores({ latitud: -27.05 })).toContain('Ingrese la longitud en grados decimales (hasta 8 decimales).');
    expect(errores({ x: 3577293 })).toContain('Ingrese la Y POSGAR en metros (ej: 7035340.12), o la latitud y longitud.');
  });
});

describe('DesagueDto (solo X/Y POSGAR faja 3, regla compartida con el frontend)', () => {
  const erroresDesague = (datos: object) =>
    // Igual que el ValidationPipe de main.ts: un mensaje por campo.
    validateSync(plainToInstance(DesagueDto, datos), { stopAtFirstError: true }).flatMap((e) => Object.values(e.constraints ?? {}));

  it('acepta X/Y de Tucumán con hasta 2 decimales', () => {
    expect(erroresDesague({ x: 3577293.45, y: 7035340.12 })).toEqual([]);
  });

  it('rechaza cifras de más (ej: X sin el punto decimal)', () => {
    expect(erroresDesague({ x: 3584508751, y: 7035340 })).toEqual([
      'La X POSGAR faja 3 lleva 7 cifras antes del punto decimal (ej: 3577293.45) y tiene 10: ¿falta el punto decimal?',
    ]);
  });

  it('rechaza más de 2 decimales y texto', () => {
    expect(erroresDesague({ x: 3577293.456, y: 7035340 })).toEqual(['La X POSGAR admite hasta 2 decimales (centímetros).']);
    expect(erroresDesague({ x: '3.577.293', y: 7035340 })).toEqual(['Ingrese la X POSGAR del desagüe en metros (ej: 3577293.45).']);
  });

  it('no acepta latitud/longitud', () => {
    expect(erroresDesague({ latitud: -27.05, longitud: -65.23 })).toContain('El desagüe se carga en X/Y POSGAR 2007 faja 3, no en latitud/longitud.');
  });

  it('pide las dos coordenadas', () => {
    expect(erroresDesague({ x: 3577293 })).toEqual(['Ingrese la Y POSGAR del desagüe en metros (ej: 7035340.12).']);
  });
});
