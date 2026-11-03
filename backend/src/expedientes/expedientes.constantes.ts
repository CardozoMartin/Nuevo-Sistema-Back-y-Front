// Valores fijos del módulo de expedientes: oficinas, etapas del circuito, estados y resultados.

/** Repartición de la DRH en el número de expediente (123/332-2026). */
export const REPARTICION_DRH = '332';

/** Oficinas por las que circula un expediente (mismos códigos que seg_oficina y el frontend). */
export enum Oficina {
  CATASTRO = 'catastro',
  RECAUDACION = 'recaudacion',
  DISTRITO = 'distrito',
  JURIDICO = 'juridico',
  SECRETARIA_GENERAL = 'secretaria_general',
  /** Pozos (agua subterránea): inicia los trámites de pozos, como la baja. */
  POZOS = 'pozos',
}

export const NOMBRE_OFICINA: Record<Oficina, string> = {
  [Oficina.CATASTRO]: 'Catastro',
  [Oficina.RECAUDACION]: 'Recaudación',
  [Oficina.DISTRITO]: 'Distrito',
  [Oficina.JURIDICO]: 'Jurídico',
  [Oficina.SECRETARIA_GENERAL]: 'Secretaría General',
  [Oficina.POZOS]: 'Pozos',
};

export enum TipoTramite {
  ALTA_CONCESION = 'ALTA_CONCESION',
  CAMBIO_TITULARIDAD = 'CAMBIO_TITULARIDAD',
  ANULACION = 'ANULACION',
  AMPLIACION_REDUCCION = 'AMPLIACION_REDUCCION',
  SUBDIVISION = 'SUBDIVISION',
  REUBICACION = 'REUBICACION',
  PERMISO_USO = 'PERMISO_USO',
  AUTORIZACION_PERFORACION = 'AUTORIZACION_PERFORACION',
  REGISTRO_POZO = 'REGISTRO_POZO',
  BAJA_POZO = 'BAJA_POZO',
  REGISTRO_EMPRESA = 'REGISTRO_EMPRESA',
  OTRO = 'OTRO',
}

/** Nombre del trámite para mostrar (ej: «el expediente ya es de un Alta de concesión»). */
export const NOMBRE_TIPO_TRAMITE: Record<TipoTramite, string> = {
  [TipoTramite.ALTA_CONCESION]: 'Alta de concesión',
  [TipoTramite.CAMBIO_TITULARIDAD]: 'Cambio de titularidad',
  [TipoTramite.ANULACION]: 'Anulación',
  [TipoTramite.AMPLIACION_REDUCCION]: 'Ampliación o reducción',
  [TipoTramite.SUBDIVISION]: 'Subdivisión',
  [TipoTramite.REUBICACION]: 'Reubicación',
  [TipoTramite.PERMISO_USO]: 'Permiso de uso',
  [TipoTramite.AUTORIZACION_PERFORACION]: 'Autorización de perforación',
  [TipoTramite.REGISTRO_POZO]: 'Registro de pozo',
  [TipoTramite.BAJA_POZO]: 'Baja de pozo',
  [TipoTramite.REGISTRO_EMPRESA]: 'Registro de empresa',
  [TipoTramite.OTRO]: 'Otro trámite',
};

/**
 * Estado general del expediente.
 *   EN_TRAMITE  circulando normalmente.
 *   OBSERVADO   una oficina lo devolvió a la oficina que lo inició (Catastro, Pozos) para corregir.
 *   EN_ESPERA   pausado: Recaudación detectó deuda de un titular; sigue cuando la paga.
 *   FINALIZADO  completó el circuito con el visto bueno de todas las oficinas.
 *   RECHAZADO   una oficina dictaminó «no apto»: el trámite termina sin otorgar.
 *   ANULADO     se inició por error y se canceló antes de salir de la oficina que lo inició:
 *               queda en el historial, pero su número se libera para volver a usarlo.
 */
export enum EstadoExpediente {
  EN_TRAMITE = 'EN_TRAMITE',
  OBSERVADO = 'OBSERVADO',
  EN_ESPERA = 'EN_ESPERA',
  FINALIZADO = 'FINALIZADO',
  RECHAZADO = 'RECHAZADO',
  ARCHIVADO = 'ARCHIVADO',
  ANULADO = 'ANULADO',
}

/** Estados en los que el expediente ya no circula. */
export const ESTADOS_FINALES = [EstadoExpediente.FINALIZADO, EstadoExpediente.RECHAZADO, EstadoExpediente.ARCHIVADO, EstadoExpediente.ANULADO];

/**
 * Etapa del circuito: dónde está el trámite y qué falta. Cada etapa pertenece a una oficina.
 *
 *   CARGA → RECAUDACION → DISTRITO → JURIDICO → SECRETARIA_GENERAL → CIERRE → ESPERA_PADRON
 *     ↑                       │           │
 *     └──── CORRECCION ◄──────┴───────────┘  (si Distrito o Jurídico lo observan)
 */
export enum Etapa {
  /** Catastro carga los datos del expediente en papel. */
  CARGA = 'CARGA',
  /** Catastro corrige lo que observó Distrito o Jurídico. */
  CORRECCION = 'CORRECCION',
  /** Recaudación verifica que los titulares no tengan deuda. */
  RECAUDACION = 'RECAUDACION',
  /** Distrito verifica que haya agua disponible y que la concesión sea viable. */
  DISTRITO = 'DISTRITO',
  /** Jurídico verifica los aspectos legales. */
  JURIDICO = 'JURIDICO',
  /** Secretaría General asigna el número de concesión y carga la resolución. */
  SECRETARIA_GENERAL = 'SECRETARIA_GENERAL',
  /** Catastro completa los datos que faltan y hace la verificación final. */
  CIERRE = 'CIERRE',
  /** Se espera el número de padrón de Rentas (suele demorar 30 a 60 días). */
  ESPERA_PADRON = 'ESPERA_PADRON',
  /** Pozos (mesa de entrada) carga la solicitud y controla la documentación presentada. */
  INICIO_POZOS = 'INICIO_POZOS',
  /** Pozos verifica los antecedentes del pozo (titular, concesión, tasa, trámites anteriores). */
  ANTECEDENTES_POZOS = 'ANTECEDENTES_POZOS',
  /** Pozos (área técnica) evalúa la perforación: inspección e informe técnico. */
  EVALUACION_TECNICA_POZOS = 'EVALUACION_TECNICA_POZOS',
  /** Pozos corrige lo que observó Jurídico. */
  CORRECCION_POZOS = 'CORRECCION_POZOS',
  /** Pozos registra la clausura física de la perforación (si la resolución la exige). */
  CLAUSURA_POZOS = 'CLAUSURA_POZOS',
}

export const OFICINA_DE_ETAPA: Record<Etapa, Oficina> = {
  [Etapa.CARGA]: Oficina.CATASTRO,
  [Etapa.CORRECCION]: Oficina.CATASTRO,
  [Etapa.RECAUDACION]: Oficina.RECAUDACION,
  [Etapa.DISTRITO]: Oficina.DISTRITO,
  [Etapa.JURIDICO]: Oficina.JURIDICO,
  [Etapa.SECRETARIA_GENERAL]: Oficina.SECRETARIA_GENERAL,
  [Etapa.CIERRE]: Oficina.CATASTRO,
  [Etapa.ESPERA_PADRON]: Oficina.CATASTRO,
  [Etapa.INICIO_POZOS]: Oficina.POZOS,
  [Etapa.ANTECEDENTES_POZOS]: Oficina.POZOS,
  [Etapa.EVALUACION_TECNICA_POZOS]: Oficina.POZOS,
  [Etapa.CORRECCION_POZOS]: Oficina.POZOS,
  [Etapa.CLAUSURA_POZOS]: Oficina.POZOS,
};

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  [Etapa.CARGA]: 'Carga de datos',
  [Etapa.CORRECCION]: 'Corrección de observaciones',
  [Etapa.RECAUDACION]: 'Verificación de deuda',
  [Etapa.DISTRITO]: 'Informe técnico de Distrito',
  [Etapa.JURIDICO]: 'Dictamen jurídico',
  [Etapa.SECRETARIA_GENERAL]: 'Resolución',
  [Etapa.CIERRE]: 'Verificación final',
  [Etapa.ESPERA_PADRON]: 'Espera del padrón de Rentas',
  [Etapa.INICIO_POZOS]: 'Mesa de entrada: documentación',
  [Etapa.ANTECEDENTES_POZOS]: 'Verificación de antecedentes',
  [Etapa.EVALUACION_TECNICA_POZOS]: 'Evaluación técnica',
  [Etapa.CORRECCION_POZOS]: 'Corrección de observaciones',
  [Etapa.CLAUSURA_POZOS]: 'Clausura física',
};

/**
 * Recorrido de los trámites de concesiones (alta, cambio de titularidad, anulación…):
 * cada etapa y la que le sigue cuando la oficina da el visto bueno. No se puede saltear
 * ninguna: el único camino a ESPERA_PADRON es pasar por todas.
 */
export const SIGUIENTE_ETAPA: Partial<Record<Etapa, Etapa>> = {
  [Etapa.CARGA]: Etapa.RECAUDACION,
  [Etapa.RECAUDACION]: Etapa.DISTRITO,
  [Etapa.DISTRITO]: Etapa.JURIDICO,
  [Etapa.JURIDICO]: Etapa.SECRETARIA_GENERAL,
  [Etapa.SECRETARIA_GENERAL]: Etapa.CIERRE,
  [Etapa.CIERRE]: Etapa.ESPERA_PADRON,
};

/** Resultado que deja cada oficina en el pase (apto / no apto de Distrito y Jurídico). */
export enum Dictamen {
  APTO = 'APTO',
  NO_APTO = 'NO_APTO',
  OBSERVADO = 'OBSERVADO',
  SIN_DICTAMEN = 'SIN_DICTAMEN',
}

/** Qué hizo una oficina sobre el expediente (exp_actuacion). */
export enum TipoActuacion {
  CARGA_COMPLETA = 'CARGA_COMPLETA',
  CORRECCION = 'CORRECCION',
  VERIFICACION_DEUDA = 'VERIFICACION_DEUDA',
  DEUDA_CANCELADA = 'DEUDA_CANCELADA',
  INFORME_TECNICO = 'INFORME_TECNICO',
  DICTAMEN_JURIDICO = 'DICTAMEN_JURIDICO',
  NUMERO_CONCESION = 'NUMERO_CONCESION',
  RESOLUCION = 'RESOLUCION',
  VERIFICACION_FINAL = 'VERIFICACION_FINAL',
  PADRON = 'PADRON',
  /** Control de la documentación presentada (completa / pendiente). */
  DOCUMENTACION = 'DOCUMENTACION',
  /** Verificación de antecedentes del pozo. */
  ANTECEDENTES = 'ANTECEDENTES',
  /** Evaluación técnica de la perforación (favorable / requiere subsanación). */
  EVALUACION_TECNICA = 'EVALUACION_TECNICA',
  /** Constancia de la clausura física de la perforación. */
  CLAUSURA = 'CLAUSURA',
  /** Una oficina toma conocimiento de lo resuelto, sin dictaminar (ej: Distrito, de una baja de pozo). */
  TOMA_CONOCIMIENTO = 'TOMA_CONOCIMIENTO',
  /** Secretaría General pide a Catastro el número de concesión. */
  SOLICITUD_NUMERO = 'SOLICITUD_NUMERO',
  /** Se avisó por correo a alguien (ej: Recaudación, la deuda a los titulares). */
  NOTIFICACION = 'NOTIFICACION',
  /**
   * Publicación del polígono en el mapa público (Argenmap), por fuera del circuito: APTO (publicado),
   * OBSERVADO (con nota) o REGISTRADO (Catastro reemplazó el polígono observado).
   */
  PUBLICACION_MAPA = 'PUBLICACION_MAPA',
  /** La oficina que lo inició lo canceló (cargado por error) antes de enviarlo: queda ANULADO. */
  CANCELACION = 'CANCELACION',
  /**
   * Corrección de un error material (dato mal escrito, KML mal cargado) por fuera del circuito,
   * con permiso y motivo. En `datos`: la sección y cada campo con su valor anterior y el nuevo.
   */
  CORRECCION_DATOS = 'CORRECCION_DATOS',
}

/** Pedido del número de concesión (Secretaría General → Catastro). */
export enum EstadoSolicitudNumero {
  /** Secretaría lo pidió; Catastro todavía no lo cargó. */
  PENDIENTE = 'PENDIENTE',
  /** Catastro cargó el número (del libro de concesiones). */
  ASIGNADA = 'ASIGNADA',
}

/** Resultado de una actuación. */
export enum ResultadoActuacion {
  APTO = 'APTO',
  NO_APTO = 'NO_APTO',
  OBSERVADO = 'OBSERVADO',
  SIN_DEUDA = 'SIN_DEUDA',
  CON_DEUDA = 'CON_DEUDA',
  /**
   * Recaudación no pudo cobrar la deuda y le dio curso igual, con una nota de por qué. La deuda
   * sigue pendiente; las oficinas siguientes ven el aviso y la nota.
   */
  CURSO_CON_DEUDA = 'CURSO_CON_DEUDA',
  /** Para actuaciones que registran un dato (número de concesión, resolución, padrón). */
  REGISTRADO = 'REGISTRADO',
}

/** Verificaciones de deuda con las que el expediente sigue: sin deuda, o con curso autorizado por Recaudación. */
export const DEUDA_VERIFICADA = [ResultadoActuacion.SIN_DEUDA, ResultadoActuacion.CURSO_CON_DEUDA];

/** "123/332-2026": número sin ceros a la izquierda, igual que el frontend. */
export const formatearNumeroExpediente = (numero: string, reparticion: string, anio: number) =>
  `${Number(numero)}/${Number(reparticion)}-${anio}`;
