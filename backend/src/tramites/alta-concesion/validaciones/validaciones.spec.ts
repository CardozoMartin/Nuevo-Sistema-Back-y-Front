// Pruebas de las reglas del alta. Son funciones puras: no necesitan la base (npm test).
import { BadRequestException } from '@nestjs/common';
import type { SituacionLegal } from '../../../catalogos/entities/situacion-legal.entity.js';
import type { TipoUso } from '../../../catalogos/entities/tipo-uso.entity.js';
import { exigirAnioEnCurso, exigirDocumentosDeLaSituacion } from './inicio.validaciones.js';
import { exigirAnioDominioNoFuturo } from './inmueble.validaciones.js';
import { exigirCascadaEnOrden } from './suministro.validaciones.js';
import { exigirDocumentosSinRepetir } from './titulares.validaciones.js';
import { exigirPeriodoValido, exigirPuntoEntregaSiCorresponde, exigirUsosDelCatalogo, exigirUsosSinRepetir } from './usos.validaciones.js';

const HOY = new Date('2026-10-07T12:00:00');

describe('Paso 1: inicio', () => {
  it('acepta un expediente del año en curso y rechaza otro año', () => {
    expect(() => exigirAnioEnCurso(2026, HOY)).not.toThrow();
    expect(() => exigirAnioEnCurso(2025, HOY)).toThrow(new BadRequestException('El expediente tiene que ser del año en curso.'));
  });

  const poseedor = {
    nombre: 'Poseedor',
    documentos: [
      { id: 2, activo: true },
      { id: 3, activo: true },
      { id: 9, activo: false },
    ],
  } as unknown as SituacionLegal;

  it('acepta papeles de la situación legal elegida (o ninguno)', () => {
    expect(() => exigirDocumentosDeLaSituacion(poseedor, [2, 3])).not.toThrow();
    expect(() => exigirDocumentosDeLaSituacion(poseedor, [])).not.toThrow();
  });

  it('rechaza papeles de otra situación legal o dados de baja', () => {
    expect(() => exigirDocumentosDeLaSituacion(poseedor, [2, 7, 9])).toThrow('Los documentos 7, 9 no corresponden a la situación legal Poseedor.');
  });
});

describe('Paso 2: titulares', () => {
  it('rechaza el mismo documento en dos titulares', () => {
    expect(() => exigirDocumentosSinRepetir([{ documento: '20123456789' }, { documento: '27301112225' }])).not.toThrow();
    expect(() => exigirDocumentosSinRepetir([{ documento: '23456789' }, { documento: '23456789' }])).toThrow('El documento 23456789 está cargado en más de un titular.');
  });
});

describe('Paso 4: inmueble', () => {
  it('rechaza un año de dominio futuro', () => {
    expect(() => exigirAnioDominioNoFuturo(undefined, HOY)).not.toThrow();
    expect(() => exigirAnioDominioNoFuturo(2026, HOY)).not.toThrow();
    expect(() => exigirAnioDominioNoFuturo(2027, HOY)).toThrow('El año de dominio no puede ser futuro.');
  });
});

describe('Paso 5: usos', () => {
  const riego = { codigo: 'agricola-riego', nombre: 'Agrícola - Riego', requierePuntoEntrega: false } as TipoUso;
  const pecuario = { codigo: 'pecuario', nombre: 'Pecuario', requierePuntoEntrega: true } as TipoUso;

  it('el fin del período no puede ser anterior al inicio', () => {
    expect(() => exigirPeriodoValido('2026-01-01', '2026-12-31')).not.toThrow();
    expect(() => exigirPeriodoValido(undefined, '2026-12-31')).not.toThrow();
    expect(() => exigirPeriodoValido('2026-12-31', '2026-01-01')).toThrow('El fin del período no puede ser anterior al inicio.');
  });

  it('cada uso una sola vez y del catálogo', () => {
    expect(() => exigirUsosSinRepetir(['agricola-riego', 'pecuario'])).not.toThrow();
    expect(() => exigirUsosSinRepetir(['pecuario', 'pecuario'])).toThrow('El uso pecuario está cargado más de una vez.');
    const catalogo = new Map([[riego.codigo, riego]]);
    expect(() => exigirUsosDelCatalogo(['agricola-riego'], catalogo)).not.toThrow();
    expect(() => exigirUsosDelCatalogo(['agricola-riego', 'minero-x'], catalogo)).toThrow('Usos inexistentes: minero-x.');
  });

  it('el punto de entrega es obligatorio solo si algún uso lo exige', () => {
    expect(exigirPuntoEntregaSiCorresponde([riego], false)).toEqual([]);
    expect(exigirPuntoEntregaSiCorresponde([riego, pecuario], true)).toEqual([pecuario]);
    expect(() => exigirPuntoEntregaSiCorresponde([riego, pecuario], false)).toThrow('Ingrese el punto de entrega del agua (lo exige el uso Pecuario).');
  });
});

describe('Paso 6: suministro', () => {
  it('la cascada se completa en orden', () => {
    expect(() => exigirCascadaEnOrden({ canalPrincipal: 'MATRIZ', canalSecundario: 'DVDO. COSSIO', canalesAdicionales: ['LOS RALOS'] })).not.toThrow();
    expect(() => exigirCascadaEnOrden({ canalSecundario: 'DVDO. COSSIO' })).toThrow('Seleccione el canal principal antes que el secundario.');
    expect(() => exigirCascadaEnOrden({ canalPrincipal: 'MATRIZ', canalesAdicionales: ['LOS RALOS'] })).toThrow('Seleccione el canal secundario antes que los canales siguientes.');
  });
});
