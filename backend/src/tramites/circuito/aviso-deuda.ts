// Texto del correo con que Recaudación avisa la deuda a un titular. Función pura (se prueba sola).
// Solo informa en qué concesión hay deuda: NO lleva montos (el detalle se ve en Recaudación).

export interface DatosAvisoDeuda {
  /** «123/332-2026». */
  expediente: string;
  /** Qué trámite es (el asunto del expediente: «Alta de concesión», «Cambio de titularidad»…). */
  tramite: string;
  /** Nombre del titular («Medina, Juan Carlos» o la razón social). */
  titular: string;
  /** Una por deuda (ej: «Deuda de la concesión N° 906»). */
  deudas: { detalle: string }[];
  /** Lo que agregó Recaudación (ej: horario de atención). */
  observaciones?: string;
}

export function armarAvisoDeuda(d: DatosAvisoDeuda): { asunto: string; cuerpo: string } {
  const lineas = [...new Set(d.deudas.map((deuda) => deuda.detalle))].map((detalle) => `  - ${detalle}`);
  const cuerpo = [
    `Estimado/a ${d.titular}:`,
    '',
    `Le informamos que el trámite «${d.tramite}» del expediente ${d.expediente} se encuentra en espera en la Oficina de Recaudación de la Dirección de Recursos Hídricos, porque se registra deuda a su nombre en:`,
    '',
    ...lineas,
    '',
    'Para conocer el detalle y regularizarla, acérquese a la Oficina de Recaudación. El trámite continuará cuando la deuda esté regularizada.',
    ...(d.observaciones ? ['', d.observaciones] : []),
    '',
    'Dirección de Recursos Hídricos de Tucumán — Av. Brígido Terán 636, San Miguel de Tucumán.',
    'Este correo se envió automáticamente: no lo responda.',
  ].join('\n');

  return { asunto: `Aviso de deuda — expediente ${d.expediente}`, cuerpo };
}
