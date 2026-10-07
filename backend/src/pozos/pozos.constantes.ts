// Valores fijos del módulo de pozos (enumerados de poz_pozo).

/** Estado del pozo (esquema_drh.sql). */
export enum EstadoPozo {
  EN_USO = 'EN_USO',
  FUERA_DE_SERVICIO = 'FUERA_DE_SERVICIO',
  PARADO = 'PARADO',
  BAJA = 'BAJA',
  ANULADO = 'ANULADO',
}

/**
 * Cómo se registró el pozo. MIGRACION no está en esquema_drh.sql: se agregó para los pozos
 * del padrón anterior, que no tienen expediente digital (igual que las concesiones migradas).
 */
export enum OrigenPozo {
  AUTORIZACION = 'AUTORIZACION',
  OFICIO = 'OFICIO',
  MIGRACION = 'MIGRACION',
}

/** Cómo se da de baja un pozo. */
export enum OrigenBaja {
  /** La pide el titular o propietario del pozo: expediente que recorre Pozos → Distrito → Jurídico → Secretaría. */
  A_SOLICITUD = 'A_SOLICITUD',
  /**
   * La DRH ya sabe que el pozo no existe o no funciona: Pozos lo da de baja en el acto,
   * sin expediente ni circuito.
   */
  DE_OFICIO = 'DE_OFICIO',
}

/** Estado del trámite de baja (poz_baja). */
export enum EstadoBaja {
  /** Iniciado / en análisis. */
  EN_TRAMITE = 'EN_TRAMITE',
  /** Pausada: falta documentación o la evaluación técnica pidió subsanar algo. */
  EN_ESPERA = 'EN_ESPERA',
  /** Jurídico la devolvió a Pozos para corregir. */
  OBSERVADA = 'OBSERVADA',
  /** Aprobada y el pozo dado de baja, pero falta registrar la clausura física. */
  CLAUSURA_PENDIENTE = 'CLAUSURA_PENDIENTE',
  /** Terminada: el pozo quedó dado de baja (y clausurado, si correspondía). */
  CONFIRMADA = 'CONFIRMADA',
  /** Jurídico dictaminó «no apto» o Secretaría la rechazó: el pozo sigue como estaba. */
  RECHAZADA = 'RECHAZADA',
}

/** Estados en los que la baja todavía no se resolvió (un pozo solo puede tener una a la vez). */
export const BAJAS_ABIERTAS = [EstadoBaja.EN_TRAMITE, EstadoBaja.EN_ESPERA, EstadoBaja.OBSERVADA];

/** Estados en los que el pozo ya quedó dado de baja. */
export const BAJAS_APROBADAS = [EstadoBaja.CLAUSURA_PENDIENTE, EstadoBaja.CONFIRMADA];

/**
 * Documentación que se presenta para la baja a solicitud.
 * TODO(catálogo): lista PROVISORIA, a confirmar con la oficina. Cuando esté confirmada,
 * pasarla a una tabla de catálogo (como cat_documento_requerido del alta).
 */
export const DOCUMENTOS_BAJA = [
  { codigo: 'NOTA_SOLICITUD', descripcion: 'Nota de solicitud de baja firmada por el titular', obligatorio: true },
  { codigo: 'DOCUMENTO_TITULAR', descripcion: 'Copia del DNI / constancia de CUIT del titular', obligatorio: true },
  { codigo: 'TITULO_INMUEBLE', descripcion: 'Título o informe de dominio del inmueble', obligatorio: true },
  { codigo: 'LIBRE_DEUDA', descripcion: 'Libre deuda de la tasa de uso del agua', obligatorio: false },
  { codigo: 'CROQUIS', descripcion: 'Croquis de ubicación de la perforación', obligatorio: false },
  { codigo: 'PODER', descripcion: 'Poder o autorización (si se presenta un tercero)', obligatorio: false },
] as const;
export type CodigoDocumentoBaja = (typeof DOCUMENTOS_BAJA)[number]['codigo'];
