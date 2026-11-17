// Lo que aporta cada trámite al circuito por las oficinas.
//
// Las oficinas (Recaudación, Distrito, Jurídico, Secretaría, Catastro) hacen lo mismo en todos
// los trámites de concesiones; lo que cambia es A QUIÉN se le verifica la deuda y QUÉ PASA con
// la concesión cuando el trámite se rechaza, se le asigna número, se resuelve o se finaliza.
// Cada trámite (alta, cambio de titularidad, anulación…) entrega su ConfigTramite y los
// services de tramites/circuito/ la llaman en el momento que corresponde.
// Es la misma idea que ConfigTramite en el frontend (features/tramites/shared/etapas/config.ts).
import type { EntityManager } from 'typeorm';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import type { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import type { TipoTramite } from '../../expedientes/expedientes.constantes.js';
import type { Persona } from '../../personas/entities/persona.entity.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';

export interface ConfigTramite {
  tipoTramite: TipoTramite;

  /**
   * Secretaría pide a Catastro el número de concesión antes de la resolución. El alta sí (la
   * concesión nace sin número); un cambio de titularidad no (la concesión ya lo tiene).
   */
  readonly pideNumeroConcesion: boolean;

  /**
   * Después de la verificación final se espera el padrón de Rentas para finalizar. El alta sí;
   * en un cambio de titularidad el padrón no cambia (es del inmueble) y finaliza en la verificación final.
   */
  readonly esperaPadron: boolean;

  /** Recaudación: las personas a las que se les verifica la deuda (alta: los titulares). */
  personasAVerificar(tx: EntityManager, expediente: Expediente): Promise<Persona[]>;

  /** Catastro, antes de enviar o reenviar: que la carga esté completa y sin duplicados (lanza 400/409). */
  validarCarga(tx: EntityManager, expediente: Expediente): Promise<void>;

  /** Distrito o Jurídico dictaminaron «no apto»: qué pasa con la concesión (alta: DENEGADA). */
  alRechazar(tx: EntityManager, expediente: Expediente, usuario: Usuario): Promise<void>;

  /**
   * Cuántos números de concesión se piden y qué es cada uno. Vacío = un solo número para la
   * concesión del expediente (alta). Una subdivisión pide uno por fracción.
   */
  etiquetasNumero(tx: EntityManager, expediente: Expediente): Promise<string[]>;

  /** Catastro cargó los números de concesión: se aplican a la concesión (o a las fracciones). */
  alAsignarNumeros(tx: EntityManager, expediente: Expediente, numeros: string[], usuario: Usuario): Promise<void>;

  /** Secretaría registró la resolución: se enlaza. Devuelve el texto para el pase («Concesión N° …»). */
  alRegistrarResolucion(tx: EntityManager, expediente: Expediente, resolucion: Resolucion, usuario: Usuario): Promise<string>;

  /**
   * Se cumplieron todos los vistos buenos: el trámite surte efecto. Devuelve datos para el historial.
   * `padron` es el de Rentas si el trámite lo espera (esperaPadron); si no, null.
   */
  alFinalizar(tx: EntityManager, expediente: Expediente, padron: string | null, usuario: Usuario): Promise<Record<string, unknown>>;
}
