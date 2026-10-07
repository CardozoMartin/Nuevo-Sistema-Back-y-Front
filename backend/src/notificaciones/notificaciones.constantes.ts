// Valores fijos del módulo de notificaciones.

/** Qué pasó con un correo. */
export enum EstadoEmail {
  /** Se entregó al servidor de correo. */
  ENVIADO = 'ENVIADO',
  /** No hay servidor de correo configurado (desarrollo): quedó registrado pero no salió. */
  NO_ENVIADO_PRUEBA = 'NO_ENVIADO_PRUEBA',
  /** El servidor de correo lo rechazó o no respondió (el motivo queda en `error`). */
  ERROR = 'ERROR',
}

/** Para qué se mandó el correo (sirve para buscarlos y para armar estadísticas). */
export enum TipoEmail {
  /** Recaudación avisa al titular que tiene deuda y que el trámite está en espera. */
  AVISO_DEUDA = 'AVISO_DEUDA',
}
