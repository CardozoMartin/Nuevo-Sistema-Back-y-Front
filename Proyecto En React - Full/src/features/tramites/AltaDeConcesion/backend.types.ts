// Tipos de lo que devuelve el backend real para el Alta de Concesión
// (backend/src/tramites/alta-concesion/alta-concesion.respuesta.ts).
import type { MultiPolygon } from 'geojson'
import type { Superposicion } from '@/services/sig'

export type EtapaCircuito = 'CARGA' | 'CORRECCION' | 'RECAUDACION' | 'DISTRITO' | 'JURIDICO' | 'SECRETARIA_GENERAL' | 'CIERRE' | 'ESPERA_PADRON'
export type EstadoExpedienteBackend = 'EN_TRAMITE' | 'OBSERVADO' | 'EN_ESPERA' | 'FINALIZADO' | 'RECHAZADO' | 'ARCHIVADO' | 'ANULADO'
export type OficinaBackend = 'catastro' | 'recaudacion' | 'distrito' | 'juridico' | 'secretaria_general'

export interface CircuitoAlta {
  estado: EstadoExpedienteBackend
  etapa: EtapaCircuito
  etapaNombre: string
  oficinaActual: OficinaBackend
  oficinaNombre: string
  tomadoPor: { id: string; nombre: string } | null
  tomadoEn: string | null
}

export interface TitularBackend {
  personaId: string
  tipoPersona: 'FISICA' | 'JURIDICA'
  tipoDocumento: 'DNI' | 'CUIL' | 'CUIT' | null
  documento: string | null
  apellido: string | null
  nombre: string | null
  fechaNacimiento: string | null
  razonSocial: string | null
  fechaConstitucion: string | null
  email: string | null
  telefono: string | null
}

export interface AltaBackend {
  id: string
  numeroExpediente: string
  expediente: { numero: string; reparticion: string; anio: number }
  fechaIngreso: string
  actualizado: string
  circuito: CircuitoAlta
  situacionLegal: { codigo: string; nombre: string } | null
  documentacionPresentada: { id: number; descripcion: string }[]
  concesion: {
    id: string
    numero: string | null
    estado: string
    caudalAsignado: number | null
    fechaOtorgamiento: string | null
    resolucion: { numero: string; anio: number; fecha: string } | null
  }
  titulares: TitularBackend[]
  domicilios: { id: string; calle: string; numero: string | null; departamento: string; localidad: string; distrito: string }[]
  ubicacion: {
    departamento: string | null
    localidad: string | null
    distrito: string | null
    poligono: {
      id: string
      geojson: MultiPolygon
      superficieHa: number
      perimetroM: number
      puntoInterior: { latitud: number; longitud: number }
      origen: string
      archivo: { nombre: string; bytes: number } | null
      desde: string
    } | null
    superposiciones: Superposicion[]
  } | null
  inmueble: {
    catastral: { padron: string | null; matricula: string; circunscripcion: string | null; seccion: string | null; parcela: string; lamina: string | null; orden: string | null }
    registral: { libro: string | null; folio: string | null; anio: number | null; matricula: string | null; serie: string | null }
  } | null
  usos: {
    caracter: 'PERMANENTE' | 'EVENTUAL' | null
    codigoServicio: number | null
    periodoInicio: string | null
    periodoFin: string | null
    /**
     * X/Y POSGAR 2007 faja 3 (null en puntos cargados antes) y latitud/longitud WGS84, con el
     * sistema en que se cargó (POSGAR_FAJA3 o WGS84).
     */
    desague: { sistema: string; x: number | null; y: number | null; latitud: number; longitud: number } | null
    items: { uso: string; nombre: string; unidad: string; magnitud: number; dotacion: number; caudal: number }[]
    puntoEntrega: { sistema: string; x: number | null; y: number | null; latitud: number; longitud: number; referencia: string | null } | null
    caudalCalculado: number
  } | null
  suministro: {
    fuentes: string[]
    sistemaDistribucion: string | null
    canalPrincipal: string | null
    canalSecundario: string | null
    canalesAdicionales: string[]
    desague: string | null
    observacion: string | null
  } | null
  pasos: Record<'inicio' | 'titulares' | 'ubicacion' | 'inmueble' | 'usos' | 'suministro', boolean>
}

export interface SituacionLegalBackend {
  codigo: string
  nombre: string
  titulo: string
  documentos: { id: number; descripcion: string }[]
}

/** Una entrada del historial: un pase entre oficinas o una actuación de una oficina. */
export type EntradaHistorial =
  | {
      tipo: 'PASE'
      fecha: string
      oficinaOrigen: string | null
      oficinaDestino: string
      etapa: string
      enviadoPor: string
      recibidoPor: string | null
      recibidoEn: string | null
      dictamen: string
      esDevolucion: boolean
      observaciones: string | null
    }
  | {
      tipo: 'ACTUACION'
      fecha: string
      oficina: string
      etapa: string
      actuacion: string
      resultado: string
      usuario: string
      observaciones: string | null
      datos: Record<string, unknown> | null
    }

/** GET /tramites/alta-concesion/:id/recaudacion: lo que verifica Recaudación. */
export interface AntecedentesDeuda {
  titulares: { personaId: string; nombre: string; documento: string | null }[]
  /** Concesiones otorgadas de los titulares, con todos sus titulares y si tienen deuda (sí / no). */
  concesiones: {
    id: string
    numero: string | null
    departamento: string | null
    localidad: string | null
    titulares: { personaId: string; nombre: string }[]
    /** Cuáles de los titulares del alta son titulares de esta concesión. */
    deTitulares: string[]
    tieneDeuda: boolean
  }[]
  /** Deudas pendientes registradas sin concesión (de antes). */
  otrasDeudas: { id: string; personaId: string; detalle: string }[]
}

/** GET /expedientes/disponibilidad: si el número está libre o de qué trámite es. */
export interface DisponibilidadExpediente {
  /** El número completo, normalizado («123/332-2026»). */
  numero: string
  disponible: boolean
  expediente: {
    id: string
    tipoTramite: string
    tipoTramiteNombre: string
    estado: EstadoExpedienteBackend
    etapaNombre: string
    oficinaNombre: string
    fechaIngreso: string
  } | null
}

export interface ExpedienteEnBandeja {
  id: string
  numero: string
  tipoTramite: string
  estado: EstadoExpedienteBackend
  etapa: EtapaCircuito
  etapaNombre: string
  titular: string | null
  tomadoPor: string | null
  enLaOficinaDesde: string | null
}

export interface DeudaBackend {
  id: string
  persona: { id: string; nombre: string; documento: string | null }
  detalle: string
  monto: number | null
  estado: 'PENDIENTE' | 'CANCELADA'
  creadoEn: string
  canceladoEn: string | null
  comprobantePago: string | null
}
