// Arma lo que devuelve la API para un alta: el expediente con todo lo cargado hasta ahora
// y qué pasos de la carga en Catastro están completos.
//
// La forma de la respuesta es la que usa el frontend: aunque por dentro la ubicación se guarde
// con ids del catálogo y los datos con historial, acá salen los nombres y solo lo vigente.
import { TipoPunto } from '../../concesiones/concesiones.constantes.js';
import { caudalTotal } from '../../concesiones/caudal.js';
import type { DatosVigentes } from '../../concesiones/datos-vigentes.js';
import type { Concesion } from '../../concesiones/entities/concesion.entity.js';
import type { Punto } from '../../concesiones/entities/punto.entity.js';
import type { PoligonoVigente } from '../../concesiones/poligonos.service.js';
import type { DocumentacionPresentada } from '../../expedientes/entities/documentacion-presentada.entity.js';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import type { SolicitudNumero } from '../../expedientes/entities/solicitud-numero.entity.js';
import { formatearNumeroExpediente, NOMBRE_ETAPA, NOMBRE_OFICINA } from '../../expedientes/expedientes.constantes.js';
import { nombreUsuario } from '../../seguridad/entities/usuario.entity.js';
import type { Superposicion } from '../../sig/geometria.service.js';

export interface PiezasAlta {
  expediente: Expediente;
  concesion: Concesion;
  /** Lo vigente de cada sección (titulares, domicilios, inmueble, condiciones, usos, puntos, suministro). */
  datos: DatosVigentes;
  documentacion: DocumentacionPresentada[];
  /** Pedido del N° de concesión (Secretaría → Catastro). NULL si todavía no se pidió. */
  solicitudNumero: SolicitudNumero | null;
  poligono: PoligonoVigente | null;
  superposiciones: Superposicion[];
}

/**
 * Pasos de la carga en Catastro (pantallas 1 a 7 de infotecnica.md §6.2): cuáles están completos.
 * La ubicación se da por completa con departamento / localidad / distrito: el polígono es
 * optativo (decisión D6).
 */
function pasosDeCarga({ datos }: PiezasAlta) {
  return {
    inicio: true,
    titulares: datos.titulares.length > 0 && datos.domicilios.length > 0,
    ubicacion: !!datos.inmueble?.departamento,
    inmueble: !!datos.inmueble?.matriculaCatastral,
    usos: datos.usos.length > 0 && datos.puntos.some((p) => p.tipo === TipoPunto.DESAGUE),
    suministro: datos.suministro !== null,
  };
}

/**
 * X/Y POSGAR (null en puntos viejos) y latitud/longitud WGS84, con el sistema en que se cargó
 * (el formulario lo vuelve a mostrar igual).
 */
const coordenada = (p: Punto) => ({
  sistema: p.sistemaCarga,
  x: p.coordX === null ? null : Number(p.coordX),
  y: p.coordY === null ? null : Number(p.coordY),
  latitud: Number(p.latitud),
  longitud: Number(p.longitud),
});

/**
 * Sección de ubicación de la concesión: departamento / localidad / distrito (nombres del
 * catálogo) y el polígono (WGS84, listo para Leaflet), con las superposiciones detectadas.
 */
function seccionUbicacion({ datos, poligono, superposiciones }: PiezasAlta) {
  const i = datos.inmueble;
  if (!poligono && !i?.departamento) return null;
  return {
    departamento: i?.departamento?.nombre ?? null,
    localidad: i?.localidad?.nombre ?? null,
    distrito: i?.distrito?.codigo ?? null,
    poligono,
    superposiciones,
  };
}

/** Sección de usos con la misma forma que recibe PUT /usos, más el caudal de cada uso. */
function seccionUsos({ usos, puntos, condicion }: DatosVigentes) {
  if (!usos.length) return null;
  const desague = puntos.find((p) => p.tipo === TipoPunto.DESAGUE);
  const entrega = puntos.find((p) => p.tipo === TipoPunto.ENTREGA);
  const items = usos.map((u) => ({
    uso: u.tipoUso.codigo,
    nombre: u.tipoUso.nombre,
    unidad: u.tipoUso.unidad,
    magnitud: Number(u.magnitud),
    dotacion: Number(u.tipoUso.dotacion),
    caudal: Number(u.caudalLps),
  }));
  return {
    caracter: condicion?.caracter ?? null,
    codigoServicio: condicion?.codigoServicio ?? null,
    periodoInicio: condicion?.periodoInicio ?? null,
    periodoFin: condicion?.periodoFin ?? null,
    desague: desague ? coordenada(desague) : null,
    items,
    puntoEntrega: entrega ? { ...coordenada(entrega), referencia: entrega.referencia } : null,
    /** Suma de los caudales de los usos (l/s). */
    caudalCalculado: caudalTotal(items.map((i) => i.caudal)),
  };
}

/** Sección de suministro con la misma forma que recibe PUT /suministro. */
function seccionSuministro({ suministro: s }: DatosVigentes) {
  if (!s) return null;
  return {
    fuentes: s.fuentePrincipal ? [s.fuentePrincipal, ...s.fuentesAdicionales] : [],
    sistemaDistribucion: s.sistemaDistribucion,
    canalPrincipal: s.canalPrincipal,
    canalSecundario: s.canalSecundario,
    canalesAdicionales: [s.canalTerciario, s.canalCuarto, s.canalQuinto].filter((c): c is string => c !== null),
    desague: s.desague,
    observacion: s.observacion,
  };
}

export function armarRespuestaAlta(piezas: PiezasAlta) {
  const { expediente, concesion, datos, documentacion, solicitudNumero } = piezas;
  const { inmueble, condicion } = datos;
  const resolucion = concesion.resolucion;

  return {
    id: expediente.id,
    numeroExpediente: formatearNumeroExpediente(expediente.numero, expediente.reparticion, expediente.anio),
    expediente: { numero: expediente.numero, reparticion: expediente.reparticion, anio: expediente.anio },
    fechaIngreso: expediente.fechaIngreso,
    actualizado: expediente.modificadoEn,

    // Dónde está el trámite y quién lo tiene.
    circuito: {
      estado: expediente.estado,
      etapa: expediente.etapa,
      etapaNombre: NOMBRE_ETAPA[expediente.etapa],
      oficinaActual: expediente.oficinaActual,
      oficinaNombre: NOMBRE_OFICINA[expediente.oficinaActual],
      tomadoPor: expediente.tomadoPor && { id: expediente.tomadoPor.id, nombre: nombreUsuario(expediente.tomadoPor) },
      tomadoEn: expediente.tomadoEn,
    },

    // Una por expediente (decisión D1); solo las concesiones migradas no la tienen.
    situacionLegal: concesion.situacionLegal && { codigo: concesion.situacionLegal.codigo, nombre: concesion.situacionLegal.nombre },
    documentacionPresentada: documentacion.map((d) => ({ id: d.documento.id, descripcion: d.documento.descripcion })),

    concesion: {
      id: concesion.id,
      numero: concesion.numero,
      estado: concesion.estado,
      /** Caudal asignado (l/s): la suma de los usos o el que corrigió Catastro en el suministro. */
      caudalAsignado: condicion?.caudalLps == null ? null : Number(condicion.caudalLps),
      fechaOtorgamiento: concesion.fechaOtorgamiento,
      resolucion: resolucion && { numero: resolucion.numero, anio: resolucion.anio, fecha: resolucion.fecha },
      /** Pedido del número a Catastro: PENDIENTE (Catastro todavía no lo cargó) o ASIGNADA. */
      solicitudNumero: solicitudNumero && {
        id: solicitudNumero.id,
        estado: solicitudNumero.estado,
        solicitadoEn: solicitudNumero.solicitadoEn,
        asignadoEn: solicitudNumero.asignadoEn,
      },
    },

    // Datos de cada titular: salen de su persona (per_persona), única por documento.
    titulares: datos.titulares.map(({ persona: p }) => ({
      personaId: p.id,
      tipoPersona: p.tipoPersona,
      tipoDocumento: p.tipoDocumento,
      documento: p.documento,
      apellido: p.apellido,
      nombre: p.nombre,
      fechaNacimiento: p.fechaNacimiento,
      razonSocial: p.razonSocial,
      fechaConstitucion: p.fechaConstitucion,
      email: p.email,
      telefono: p.telefono,
    })),
    // Domicilio legal del titular (no la ubicación de la concesión), con los nombres del catálogo.
    domicilios: datos.domicilios.map((d) => ({
      id: d.id,
      calle: d.calle,
      numero: d.numero,
      departamento: d.departamento.nombre,
      localidad: d.localidad.nombre,
      distrito: d.distrito.codigo,
    })),

    ubicacion: seccionUbicacion(piezas),

    // Misma forma que manda el formulario: { catastral, registral }.
    inmueble: inmueble?.matriculaCatastral && {
      catastral: {
        padron: inmueble.padron,
        matricula: inmueble.matriculaCatastral,
        circunscripcion: inmueble.circunscripcion,
        seccion: inmueble.seccion,
        parcela: inmueble.parcela,
        lamina: inmueble.lamina,
        orden: inmueble.orden,
      },
      registral: {
        libro: inmueble.libro,
        folio: inmueble.folio,
        anio: inmueble.anioDominio,
        matricula: inmueble.matriculaDominio,
        serie: inmueble.serie,
      },
    },

    usos: seccionUsos(datos),
    suministro: seccionSuministro(datos),

    pasos: pasosDeCarga(piezas),
    // El historial completo (pases y actuaciones) está en GET /api/expedientes/:id/historial.
  };
}

export type RespuestaAlta = ReturnType<typeof armarRespuestaAlta>;
