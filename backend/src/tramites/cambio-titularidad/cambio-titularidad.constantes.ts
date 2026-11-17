// Valores fijos del Cambio de Titularidad.

/**
 * Estado del cambio (con_cambio_titularidad.estado). Acompaña al del expediente; se guarda
 * aparte para poder exigir en la base UN solo cambio en trámite por concesión.
 *   EN_TRAMITE  circulando (incluye observado y en espera por deuda).
 *   FINALIZADO  la concesión cambió de titular.
 *   RECHAZADO   Distrito o Jurídico dictaminaron «no apto»: la concesión sigue igual.
 *   ANULADO     Catastro lo inició por error y lo canceló antes de enviarlo.
 */
export enum EstadoCambioTitularidad {
  EN_TRAMITE = 'EN_TRAMITE',
  FINALIZADO = 'FINALIZADO',
  RECHAZADO = 'RECHAZADO',
  ANULADO = 'ANULADO',
}
