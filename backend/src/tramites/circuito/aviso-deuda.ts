// Texto del correo con que Recaudación avisa la deuda a un titular. Función pura (se prueba sola).

export interface DatosAvisoDeuda {
  /** «123/332-2026». */
  expediente: string;
  /** Qué trámite es (el asunto del expediente: «Alta de concesión», «Cambio de titularidad»…). */
  tramite: string;
  /** Nombre del titular («Medina, Juan Carlos» o la razón social). */
  titular: string;
  deudas: { detalle: string; monto: number | null }[];
  /** Lo que agregó Recaudación (ej: dónde y cómo pagar). */
  observaciones?: string;
}

const pesos = (monto: number) => monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export function armarAvisoDeuda(d: DatosAvisoDeuda): { asunto: string; cuerpo: string } {
  //1.- Una línea por deuda, con el monto si se conoce.
  const lineas = d.deudas.map((deuda) => `  - ${deuda.detalle}${deuda.monto === null ? '' : `: ${pesos(deuda.monto)}`}`);

  //2.- El total, si todas las deudas tienen monto.
  const conMonto = d.deudas.filter((deuda) => deuda.monto !== null);
  const total = conMonto.length === d.deudas.length && d.deudas.length > 1 ? `\nTotal: ${pesos(conMonto.reduce((s, deuda) => s + deuda.monto!, 0))}\n` : '';

  //3.- El texto completo.
  const cuerpo = [
    `Estimado/a ${d.titular}:`,
    '',
    `Le informamos que el trámite «${d.tramite}» del expediente ${d.expediente} se encuentra en espera en la Oficina de Recaudación de la Dirección de Recursos Hídricos, porque se registra la siguiente deuda a su nombre:`,
    '',
    ...lineas,
    total,
    'El trámite continuará cuando la deuda esté regularizada.',
    ...(d.observaciones ? ['', d.observaciones] : []),
    '',
    'Dirección de Recursos Hídricos de Tucumán — Av. Brígido Terán 636, San Miguel de Tucumán.',
    'Este correo se envió automáticamente: no lo responda.',
  ].join('\n');

  return { asunto: `Deuda pendiente — expediente ${d.expediente}`, cuerpo };
}
