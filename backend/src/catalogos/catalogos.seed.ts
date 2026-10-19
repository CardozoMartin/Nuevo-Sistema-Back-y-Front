// Datos iniciales de los catálogos. Son los mismos del mock del frontend
// (mock-server/db.json → situacionesLegales, usos). Se cargan solo si la tabla está vacía.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Caracter, CODIGOS_SERVICIO, SECCIONES_CATASTRALES, SERVICIOS } from '../concesiones/concesiones.constantes.js';
import { EstadoExpediente, Oficina, TipoTramite } from '../expedientes/expedientes.constantes.js';
import { GrupoOpcion } from './entities/opcion.entity.js';

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

// --- Dominio de los expedientes (GET /api/dominio) ------------------------------------

/** Descripción e ícono de los trámites que se ofrecen en el menú de Catastro (en ese orden). */
export const TRAMITES_MENU_CATASTRO: Partial<Record<TipoTramite, { descripcion: string; icono: string }>> = {
  [TipoTramite.ALTA_CONCESION]: { descripcion: 'Iniciar el proceso de registro para una nueva concesión.', icono: 'add_location_alt' },
  [TipoTramite.CAMBIO_TITULARIDAD]: { descripcion: 'Transferencia de derechos y obligaciones a un nuevo titular legal.', icono: 'switch_access_shortcut' },
  [TipoTramite.ANULACION]: { descripcion: 'Solicitud formal para dar de baja una concesión vigente.', icono: 'block' },
  [TipoTramite.SUBDIVISION]: { descripcion: 'División de parcelas, terrenos o unidades catastrales.', icono: 'call_split' },
  [TipoTramite.REUBICACION]: { descripcion: 'Traslado de derechos de uso a una nueva ubicación física.', icono: 'move_location' },
  [TipoTramite.AMPLIACION_REDUCCION]: { descripcion: 'Ajustes en superficie, caudal o alcance de la concesión vigente.', icono: 'tune' },
  [TipoTramite.PERMISO_USO]: { descripcion: 'Permiso precario de uso del agua.', icono: 'verified' },
};

/**
 * Plazos iniciales (días corridos en la oficina), por oficina, para todos los trámites.
 * Por ahora solo Recaudación, 10 días en cada trámite; después se ajusta trámite por trámite en la base.
 */
export const PLAZOS_INICIALES: Partial<Record<Oficina, number>> = {
  [Oficina.RECAUDACION]: 10,
};

export const ESTADOS_EXPEDIENTE_INICIALES: Record<EstadoExpediente, { nombre: string; color: string; pendiente: boolean }> = {
  [EstadoExpediente.EN_TRAMITE]: { nombre: 'En trámite', color: 'azul', pendiente: true },
  [EstadoExpediente.OBSERVADO]: { nombre: 'Observado', color: 'ambar', pendiente: true },
  [EstadoExpediente.EN_ESPERA]: { nombre: 'En espera', color: 'ambar', pendiente: true },
  [EstadoExpediente.FINALIZADO]: { nombre: 'Finalizado', color: 'verde', pendiente: false },
  [EstadoExpediente.RECHAZADO]: { nombre: 'Rechazado', color: 'gris', pendiente: false },
  [EstadoExpediente.ARCHIVADO]: { nombre: 'Archivado', color: 'gris', pendiente: false },
  [EstadoExpediente.ANULADO]: { nombre: 'Anulado', color: 'gris', pendiente: false },
};

/** Listas cortas (cat_opcion). Circunscripciones y secciones: las mismas que valida el alta. */
export const OPCIONES_INICIALES: Record<GrupoOpcion, { codigo: string; nombre: string }[]> = {
  [GrupoOpcion.CIRCUNSCRIPCION]: [
    { codigo: 'I', nombre: 'I - Capital' },
    { codigo: 'II', nombre: 'II - Zona Norte' },
    { codigo: 'III', nombre: 'III - Zona Sur' },
  ],
  [GrupoOpcion.SECCION_CATASTRAL]: SECCIONES_CATASTRALES.map((s) => ({ codigo: s, nombre: `Sección ${s}` })),
  [GrupoOpcion.CARACTER]: [
    { codigo: Caracter.PERMANENTE, nombre: 'Permanente' },
    { codigo: Caracter.EVENTUAL, nombre: 'Eventual' },
  ],
  [GrupoOpcion.CODIGO_SERVICIO]: CODIGOS_SERVICIO.map((c) => ({ codigo: String(c), nombre: `${c} - ${SERVICIOS[c]}` })),
  [GrupoOpcion.TIPO_CONCESION]: [
    { codigo: 'PERMANENTE', nombre: 'Permanente' },
    { codigo: 'TEMPORAL', nombre: 'Temporal' },
  ],
  [GrupoOpcion.DOCUMENTO_JURIDICO]: [
    { codigo: 'DNI', nombre: 'DNI del solicitante' },
    { codigo: 'ESCRITURA', nombre: 'Escritura o título de propiedad' },
    { codigo: 'PLANO', nombre: 'Plano catastral actualizado' },
    { codigo: 'CERTIFICADO_DEUDA', nombre: 'Certificado de deuda' },
    { codigo: 'HABILITACION', nombre: 'Habilitación municipal' },
    { codigo: 'ACTA_CONSTITUTIVA', nombre: 'Acta constitutiva (personas jurídicas)' },
  ],
};
