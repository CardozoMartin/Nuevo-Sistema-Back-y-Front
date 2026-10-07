// Pruebas de la lectura de archivos geográficos (sin base: npm test).
import { leerGeoJson } from './leer-geojson.js';
import { sridDeclarado } from './sistema-coordenadas.js';

const cuadrado = [
  [
    [3560000, 7030000],
    [3560200, 7030000],
    [3560200, 7030200],
    [3560000, 7030000],
  ],
];
const geojson = (extra: Record<string, unknown> = {}, propiedades: Record<string, unknown> = {}) =>
  Buffer.from(JSON.stringify({ type: 'FeatureCollection', ...extra, features: [{ type: 'Feature', properties: propiedades, geometry: { type: 'Polygon', coordinates: cuadrado } }] }));

describe('Sistema de coordenadas que declara un GeoJSON', () => {
  it('lee las formas habituales de «crs»', () => {
    const crs = (name: string) => ({ type: 'name', properties: { name } });
    expect(sridDeclarado(undefined)).toBeUndefined();
    expect(sridDeclarado(crs('urn:ogc:def:crs:EPSG::5345'))).toBe(5345);
    expect(sridDeclarado(crs('EPSG:22193'))).toBe(22193);
    expect(sridDeclarado(crs('urn:ogc:def:crs:EPSG:6.6:4326'))).toBe(4326);
    expect(sridDeclarado(crs('http://www.opengis.net/def/crs/EPSG/0/5345'))).toBe(5345);
    expect(sridDeclarado(crs('urn:ogc:def:crs:OGC:1.3:CRS84'))).toBe(4326);
  });

  it('rechaza un sistema declarado que no se puede leer (no lo adivina)', () => {
    expect(() => sridDeclarado({ type: 'name', properties: { name: 'POSGAR 2007' } })).toThrow('no se reconoce');
  });

  it('devuelve el sistema declarado y los números de concesión de la capa de la DRH', () => {
    const leido = leerGeoJson(geojson({ crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::22193' } } }, { concesion: '02480' }));
    expect(leido.sridDeclarado).toBe(22193);
    expect(leido.numerosConcesion).toEqual(['2480']);
    expect(leido.nombres).toEqual(['Concesión 02480']);
  });

  it('sin «crs» no declara nada (el sistema se reconoce por los números)', () => {
    expect(leerGeoJson(geojson()).sridDeclarado).toBeUndefined();
  });
});
