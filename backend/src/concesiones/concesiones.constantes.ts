// Valores fijos del módulo de concesiones (enumerados de con_concesion y con_titular).

export enum TipoDerecho {
  CONCESION = 'CONCESION',
  /** Derechos de uso anteriores al régimen de concesiones (figuran así en el padrón histórico). */
  DERECHO_TRADICIONAL = 'DERECHO_TRADICIONAL',
  PERMISO_USO = 'PERMISO_USO',
  PERMISO_POZO = 'PERMISO_POZO',
}

/**
 * EN_TRAMITE no está en esquema_drh.sql: se agregó porque la concesión se crea al iniciar
 * el alta (para colgarle titulares, inmueble, usos…) y recién queda VIGENTE cuando
 * Catastro le asigna el número en el cierre.
 */
export enum EstadoConcesion {
  EN_TRAMITE = 'EN_TRAMITE',
  /** Distrito o Jurídico dictaminaron «no apto»: el alta no se otorgó. */
  DENEGADA = 'DENEGADA',
  VIGENTE = 'VIGENTE',
  MODIFICADA = 'MODIFICADA',
  ANULADA = 'ANULADA',
  ARCHIVADA = 'ARCHIVADA',
}

export enum TipoPersona {
  FISICA = 'FISICA',
  JURIDICA = 'JURIDICA',
}

/** Persona jurídica: siempre CUIT. Persona física: DNI, CUIL o CUIT. */
export enum TipoDocumento {
  DNI = 'DNI',
  CUIL = 'CUIL',
  CUIT = 'CUIT',
}

/** Trámite que generó un polígono de la concesión. */
export enum OrigenPoligono {
  ALTA = 'ALTA',
  AMPLIACION = 'AMPLIACION',
  REDUCCION = 'REDUCCION',
  REUBICACION = 'REUBICACION',
  SUBDIVISION = 'SUBDIVISION',
  /** Polígonos importados del sistema anterior o relevados por la DRH. */
  MIGRACION = 'MIGRACION',
}

/**
 * Si el polígono se ve en el mapa público (Argenmap, a través de GeoServer y sig.v_concesiones).
 * Los usuarios internos lo ven siempre en el visor del sistema; afuera, solo PUBLICADO.
 *   PENDIENTE  en trámite, o con resolución y esperando que quien publica lo verifique.
 *   OBSERVADO  quien publica encontró un problema (nota obligatoria): Catastro corrige el KML.
 *   PUBLICADO  verificado: se ve en Argenmap.
 */
export enum PublicacionMapa {
  PENDIENTE = 'PENDIENTE',
  OBSERVADO = 'OBSERVADO',
  PUBLICADO = 'PUBLICADO',
}

/** Carácter del derecho de uso. */
export enum Caracter {
  PERMANENTE = 'PERMANENTE',
  EVENTUAL = 'EVENTUAL',
}

/**
 * Códigos de servicio de Catastro (0 a 5). Salen del padrón real (BASE_DE_DATOS_LA_AGUADITA):
 * cada código combina el tipo de obra de toma con el carácter del derecho.
 */
export const SERVICIOS = {
  0: 'Dique de embalse permanente',
  1: 'Dique de embalse eventual',
  2: 'Dique nivelador permanente',
  3: 'Dique nivelador eventual',
  4: 'Toma rústica permanente',
  5: 'Toma rústica eventual',
} as const;
export const CODIGOS_SERVICIO = [0, 1, 2, 3, 4, 5] as const;

/** De dónde salió la concesión: cargada en el sistema (alta) o importada del padrón anterior. */
export enum OrigenConcesion {
  SISTEMA = 'SISTEMA',
  MIGRACION = 'MIGRACION',
}

/** Puntos con coordenadas que se declaran en la sección de usos. */
export enum TipoPunto {
  /** Dónde se devuelve el agua (obligatorio). */
  DESAGUE = 'DESAGUE',
  /** Dónde se entrega el agua; obligatorio solo si algún uso lo exige (ej: pecuario). */
  ENTREGA = 'ENTREGA',
}

/** Rango de coordenadas decimales válidas para Argentina (mismo que el frontend). */
export const RANGO_LATITUD = { min: -55, max: -21 } as const;
export const RANGO_LONGITUD = { min: -74, max: -53 } as const;

/**
 * Coordenadas POSGAR 2007 faja 3 (EPSG:5345) válidas para Tucumán, en metros (mismo rango que
 * el frontend). Es el sistema en que la oficina carga los puntos.
 */
export { RANGO_POSGAR_FAJA3 as RANGO_POSGAR } from '../comun/validadores/posgar-faja3.js';

/** Circunscripciones y secciones catastrales válidas (mismas listas que el frontend). */
export const CIRCUNSCRIPCIONES = ['I', 'II', 'III'] as const;
export const SECCIONES_CATASTRALES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
