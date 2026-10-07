// Datos iniciales de los catálogos. Son los mismos del mock del frontend
// (mock-server/db.json → situacionesLegales, usos). Se cargan solo si la tabla está vacía.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Departamento → localidad → distritos, el mismo formato que usa el frontend. */
export type CatalogoUbicaciones = Record<string, Record<string, string[]>>;

/** Carpeta de los archivos de los catálogos (la API se corre desde backend/). */
const CARPETA_CATALOGOS = join(process.cwd(), 'recursos', 'catalogos');

const leerJson = <T>(archivo: string): T => JSON.parse(readFileSync(join(CARPETA_CATALOGOS, archivo), 'utf8')) as T;

/**
 * Departamentos, localidades y distritos de Tucumán. Sale de
 * mock-server/seed/localidadesDistritos.json del frontend, con los nombres en mayúsculas
 * (la misma normalización que hace build-db.mjs), así coinciden con lo que manda el formulario.
 */
export const leerUbicacionesIniciales = () => leerJson<CatalogoUbicaciones>('localidades-distritos.json');

/**
 * Catálogo de suministro de riego entregado por la DRH (departamento → localidad → distrito →
 * fuentes, sistemas, canales, desagües). Copia SIN TOCAR de mock-server/seed/suministroCatalogo.json
 * del frontend; la normalización la hace normalizarCatalogo (suministro/arbol-suministro.ts).
 */
export const leerSuministroInicial = () => leerJson<Record<string, Record<string, Record<string, Record<string, unknown>>>>>('suministro.json');

/** Cuencas hídricas que aparecen en el padrón. A CONFIRMAR con la DRH. */
export const leerCuencasIniciales = () => leerJson<string[]>('cuencas.json');

/** Dotaciones de la demo (ilustrativas): hay que confirmarlas con la DRH. */
export const TIPOS_USO_INICIALES = [
  { codigo: 'industrial', nombre: 'Industrial', dotacion: 1.2, unidad: 'unidad productiva', requierePuntoEntrega: false },
  { codigo: 'agricola-riego', nombre: 'Agrícola - Riego', dotacion: 0.75, unidad: 'ha', requierePuntoEntrega: false },
  { codigo: 'agricola-pulverizacion', nombre: 'Agrícola - Pulverización', dotacion: 0.4, unidad: 'ha', requierePuntoEntrega: false },
  { codigo: 'pecuario', nombre: 'Pecuario', dotacion: 0.05, unidad: 'cabeza', requierePuntoEntrega: true },
  { codigo: 'energetico', nombre: 'Energético', dotacion: 2, unidad: 'unidad', requierePuntoEntrega: false },
  { codigo: 'minero', nombre: 'Minero', dotacion: 1.5, unidad: 'unidad', requierePuntoEntrega: false },
  { codigo: 'medicinal', nombre: 'Medicinal', dotacion: 0.1, unidad: 'unidad', requierePuntoEntrega: false },
  { codigo: 'piscicola', nombre: 'Piscícola', dotacion: 0.6, unidad: 'ha espejo de agua', requierePuntoEntrega: false },
  { codigo: 'recreativo', nombre: 'Recreativo', dotacion: 0.2, unidad: 'unidad', requierePuntoEntrega: false },
];

export const SITUACIONES_LEGALES_INICIALES = [
  {
    codigo: 'TITULAR',
    nombre: 'Titular de dominio',
    titulo: 'A. Titular de dominio',
    documentos: ['Informe de registro inmobiliario'],
  },
  {
    codigo: 'POSEEDOR',
    nombre: 'Poseedor',
    titulo: 'B. Poseedor',
    documentos: [
      'Informe de registro inmobiliario',
      'Contrato de compra y venta con firma certificada',
      'Declaratoria de herederos',
      'Cesión o compra de acciones y derechos posesorios o hereditarios',
      'Certificado o acta de constatación de posesión ante juez de paz',
      'Boletas de servicios, impuestos y tasas municipales',
    ],
  },
  {
    codigo: 'TENEDOR',
    nombre: 'Tenedor',
    titulo: 'C. Tenedor',
    documentos: [
      'Contrato de arriendo, aparcería o comodato con firmas certificadas',
      'Certificación otorgada por comunidades indígenas para la explotación agrícola de un predio',
    ],
  },
];
