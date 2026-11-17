import { BadRequestException, ConflictException, Injectable, type OnModuleInit } from '@nestjs/common';
import { Not, type EntityManager } from 'typeorm';
import { SuministroCatalogoService } from '../../catalogos/suministro/suministro-catalogo.service.js';
import { EstadoConcesion } from '../../concesiones/concesiones.constantes.js';
import { fijarVigenciaDesde } from '../../concesiones/datos-vigentes.js';
import { matriculaEnUso, poligonoDuplicado } from '../../concesiones/duplicados.js';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import { Inmueble } from '../../concesiones/entities/inmueble.entity.js';
import { Titular } from '../../concesiones/entities/titular.entity.js';
import type { Expediente } from '../../expedientes/entities/expediente.entity.js';
import type { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import { Etapa, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import type { Persona } from '../../personas/entities/persona.entity.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import type { ConfigTramite } from '../circuito/config-tramite.js';
import { RegistroTramitesService } from '../circuito/registro-tramites.service.js';
import { armarRespuestaAlta } from './alta-concesion.respuesta.js';
import { AltaConcesionService } from './alta-concesion.service.js';

/** Nombre de cada paso de la carga, para avisar qué falta antes de enviar. */
const NOMBRE_PASO: Record<string, string> = {
  inicio: 'Inicio',
  titulares: 'Titulares y domicilios',
  ubicacion: 'Ubicación de la concesión',
  inmueble: 'Datos catastrales',
  usos: 'Usos',
  suministro: 'Suministro',
};

/**
 * Lo propio del Alta de Concesión en el circuito por las oficinas (ver tramites/circuito/).
 * Se registra sola al arrancar: las oficinas la buscan por el tipo de trámite del expediente.
 */
@Injectable()
export class AltaCircuitoConfig implements ConfigTramite, OnModuleInit {
  readonly tipoTramite = TipoTramite.ALTA_CONCESION;
  /** La concesión nace sin número: Secretaría lo pide a Catastro antes de la resolución. */
  readonly pideNumeroConcesion = true;
  /** Finaliza cuando llega el padrón de Rentas. */
  readonly esperaPadron = true;

  constructor(
    private readonly alta: AltaConcesionService,
    private readonly registro: RegistroTramitesService,
    private readonly catalogoSuministro: SuministroCatalogoService,
  ) {}

  onModuleInit() {
    this.registro.registrar(this);
  }

  /** Recaudación verifica la deuda de los titulares (vigentes) de la concesión del alta. */
  async personasAVerificar(tx: EntityManager, expediente: Expediente): Promise<Persona[]> {
    const titulares = await tx.find(Titular, { where: { concesion: { expediente: { id: expediente.id } }, vigente: true }, order: { orden: 'ASC' } });
    return titulares.map((t) => t.persona);
  }

  /**
   * Los seis pasos de la carga completos, el suministro del catálogo y sin duplicados (matrícula o polígono).
   * Para la verificación final (cierre), además, el polígono: es optativo en la carga
   * preliminar (D6) pero toda concesión otorgada tiene que verse en el visor y en QGIS.
   */
  async validarCarga(tx: EntityManager, expediente: Expediente): Promise<void> {
    //1.- Todos los pasos completos.
    const piezas = await this.alta.cargarPiezas(tx, expediente.id);
    const { pasos } = armarRespuestaAlta(piezas);
    const faltan = Object.entries(pasos).filter(([, completo]) => !completo).map(([paso]) => NOMBRE_PASO[paso] ?? paso);
    if (faltan.length) throw new BadRequestException(`Falta completar: ${faltan.join(', ')}.`);

    //2.- En el cierre, el polígono es obligatorio.
    if (expediente.etapa === Etapa.CIERRE && !piezas.poligono) {
      throw new BadRequestException('Falta el polígono de la concesión (KML o GeoJSON): es obligatorio para la verificación final, así la concesión queda en el visor.');
    }

    //3.- El suministro tiene que seguir siendo un camino del árbol del distrito (pudo cambiar después del paso 6).
    const s = piezas.datos.suministro;
    if (s) {
      const seleccion = {
        fuentes: [s.fuentePrincipal, ...s.fuentesAdicionales].filter((f): f is string => !!f),
        sistemaDistribucion: s.sistemaDistribucion,
        canalPrincipal: s.canalPrincipal,
        canalSecundario: s.canalSecundario,
        canalTerciario: s.canalTerciario,
        canalCuarto: s.canalCuarto,
        canalQuinto: s.canalQuinto,
        desague: s.desague,
      };
      await this.catalogoSuministro.exigirValido(tx, piezas.datos.inmueble, seleccion).catch((error: unknown) => {
        if (error instanceof BadRequestException) throw new BadRequestException(`Suministro (paso 6): ${error.message} Vuelva a guardar el suministro.`);
        throw error;
      });
    }

    //4.- Que no sea una concesión duplicada.
    const matricula = piezas.datos.inmueble?.matriculaCatastral;
    const duplicado = (matricula && (await matriculaEnUso(tx, matricula, piezas.concesion.id))) || (await poligonoDuplicado(tx, piezas.concesion.id));
    if (duplicado) throw new ConflictException(duplicado);
  }

  /** «No apto»: la concesión no se otorga (deja de verse en el visor y en QGIS). */
  async alRechazar(tx: EntityManager, expediente: Expediente, usuario: Usuario): Promise<void> {
    await tx.update(Concesion, { expediente: { id: expediente.id } }, { estado: EstadoConcesion.DENEGADA, modificadoUsuarioId: usuario.id });
  }

  /** El alta pide un solo número: el de su concesión. */
  async etiquetasNumero(): Promise<string[]> {
    return [];
  }

  async alAsignarNumeros(tx: EntityManager, expediente: Expediente, [numero]: string[], usuario: Usuario): Promise<void> {
    await tx.update(Concesion, { expediente: { id: expediente.id } }, { numero, modificadoUsuarioId: usuario.id });
  }

  /** La resolución queda enlazada a la concesión y su fecha es la de otorgamiento. */
  async alRegistrarResolucion(tx: EntityManager, expediente: Expediente, resolucion: Resolucion, usuario: Usuario): Promise<string> {
    const concesion = await tx.findOneByOrFail(Concesion, { expediente: { id: expediente.id } });
    await tx.update(Concesion, concesion.id, { resolucion: { id: resolucion.id }, fechaOtorgamiento: resolucion.fecha, modificadoUsuarioId: usuario.id });
    return `Concesión N° ${concesion.numero}.`;
  }

  /**
   * Llegó el padrón de Rentas:
   *   1. No puede estar usado por otra concesión.
   *   2. Se guarda en el inmueble vigente.
   *   3. La concesión queda VIGENTE y todo lo cargado rige desde la fecha de la resolución.
   */
  async alFinalizar(tx: EntityManager, expediente: Expediente, padron: string | null, usuario: Usuario): Promise<Record<string, unknown>> {
    if (!padron) throw new BadRequestException('El alta finaliza con el padrón de Rentas.');
    const concesion = await tx.findOneByOrFail(Concesion, { expediente: { id: expediente.id } });

    //1.- El padrón no puede estar en otra concesión.
    const otra = await tx.findOne(Inmueble, { where: { padron, vigente: true, concesion: { id: Not(concesion.id), estado: Not(EstadoConcesion.DENEGADA) } }, relations: { concesion: true } });
    if (otra) throw new ConflictException(`El padrón ${padron} ya corresponde a la concesión ${otra.concesion.numero ?? otra.concesion.id}.`);

    //2.- El padrón va en el inmueble vigente.
    await tx.update(Inmueble, { concesion: { id: concesion.id }, vigente: true }, { padron });

    //3.- La concesión queda vigente desde la resolución.
    await tx.update(Concesion, concesion.id, { estado: EstadoConcesion.VIGENTE, modificadoUsuarioId: usuario.id });
    await fijarVigenciaDesde(tx, concesion.id, concesion.fechaOtorgamiento);
    return { numeroConcesion: concesion.numero };
  }
}
