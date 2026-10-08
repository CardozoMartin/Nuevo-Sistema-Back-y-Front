import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type DeepPartial, type EntityManager, type EntityTarget, type FindOptionsWhere } from 'typeorm';
import { cargarDatosVigentes } from '../../concesiones/datos-vigentes.js';
import { Concesion } from '../../concesiones/entities/concesion.entity.js';
import type { Condicion } from '../../concesiones/entities/condicion.entity.js';
import type { Inmueble } from '../../concesiones/entities/inmueble.entity.js';
import type { Suministro } from '../../concesiones/entities/suministro.entity.js';
import { PoligonosService } from '../../concesiones/poligonos.service.js';
import { DocumentacionPresentada } from '../../expedientes/entities/documentacion-presentada.entity.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { SolicitudNumero } from '../../expedientes/entities/solicitud-numero.entity.js';
import { EstadoExpediente, Etapa, NOMBRE_ETAPA, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { GeometriaService } from '../../sig/geometria.service.js';
import { armarRespuestaAlta, type PiezasAlta, type RespuestaAlta } from './alta-concesion.respuesta.js';

/**
 * Etapas en las que Catastro puede cargar o corregir los datos del alta:
 *   CARGA       la carga preliminar;
 *   CORRECCION  lo devolvió Distrito o Jurídico con observaciones;
 *   CIERRE      la verificación final («cargan los datos que faltan»).
 */
const ETAPAS_EDITABLES = [Etapa.CARGA, Etapa.CORRECCION, Etapa.CIERRE];

/** Secciones con una sola fila vigente por concesión. */
type SeccionUnica = Inmueble | Condicion | Suministro;

/** Lo que necesita cada paso para guardar: el expediente bloqueado, su concesión y quién guarda. */
export interface AltaEditable {
  expediente: Expediente;
  concesion: Concesion;
  usuario: Usuario;
}

/**
 * Alta de Concesión — lo que comparten los pasos de la carga y el circuito:
 *   - consultar un alta y las altas en carga;
 *   - juntar todo lo cargado (cargarPiezas) para armar la respuesta;
 *   - exigir que Catastro pueda editar (exigirEditable).
 *
 * Cada paso de la carga está en su propio service, en pasos/:
 *   Paso 1  InicioAltaService      expediente en papel (único) + situación legal + checklist
 *   Paso 2  TitularesAltaService   titulares (personas únicas por documento) y domicilios legales
 *   Paso 3  UbicacionAltaService   ubicación de la concesión (catálogo) + KML/GeoJSON optativo
 *   Paso 4  InmuebleAltaService    datos catastrales (matrícula sin duplicar) + dominio
 *   Paso 5  UsosAltaService        carácter, período, desagüe, usos con su caudal y punto de entrega
 *   Paso 6  SuministroAltaService  fuente → sistema → canales en cascada y caudal asignado
 *
 * El circuito por las oficinas (envío, Recaudación, Distrito…) está en AltaCircuitoService.
 */
@Injectable()
export class AltaConcesionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly geometria: GeometriaService,
    private readonly poligonos: PoligonosService,
  ) {}

  /** Todo lo cargado en un alta (cualquiera sea la oficina en que esté). */
  async obtener(expedienteId: string): Promise<RespuestaAlta> {
    return armarRespuestaAlta(await this.cargarPiezas(this.dataSource.manager, expedienteId));
  }

  /** Junta el expediente, su concesión y todo lo vigente. 404 si no es un alta. */
  async cargarPiezas(tx: EntityManager, expedienteId: string): Promise<PiezasAlta> {
    //1.- El expediente tiene que ser un alta.
    const expediente = await tx.findOneBy(Expediente, { id: expedienteId, tipoTramite: TipoTramite.ALTA_CONCESION });
    if (!expediente) throw new NotFoundException('No se encontró el alta de concesión.');

    //2.- La concesión que el alta creó en el paso 1.
    const concesion = await tx.findOneBy(Concesion, { expediente: { id: expediente.id } });
    if (!concesion) throw new NotFoundException('El expediente no tiene concesión asociada.');

    //3.- Lo vigente de cada sección, el checklist, el pedido del N° de concesión, el polígono y las superposiciones.
    const datos = await cargarDatosVigentes(tx, concesion.id);
    const documentacion = await tx.find(DocumentacionPresentada, { where: { expediente: { id: expediente.id } }, order: { documento: { orden: 'ASC' } } });
    const solicitudNumero = await tx.findOneBy(SolicitudNumero, { expediente: { id: expediente.id } });
    const poligono = await this.poligonos.vigente(tx, concesion.id);
    const superposiciones = poligono ? await this.geometria.superposicionesDeConcesion(concesion.id, tx) : [];
    return { expediente, concesion, datos, documentacion, solicitudNumero, poligono, superposiciones };
  }

  /**
   * Bloquea el expediente (FOR UPDATE: dos guardados simultáneos no se pisan) y exige que
   * Catastro pueda editarlo: etapa de carga, corrección o cierre, circulando, y tomado por
   * el usuario que guarda.
   */
  async exigirEditable(tx: EntityManager, expedienteId: string, usuarioId: string): Promise<AltaEditable> {
    //1.- Se bloquea el expediente hasta el fin de la transacción.
    const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.ALTA_CONCESION);

    //2.- Se valida que esté en una etapa en la que Catastro carga datos.
    if (!ETAPAS_EDITABLES.includes(expediente.etapa)) {
      throw new ConflictException(`El alta está en «${NOMBRE_ETAPA[expediente.etapa]}»: Catastro no puede modificar sus datos en esta etapa.`);
    }

    //3.- Se valida que lo tenga tomado quien guarda (y que sea de la oficina).
    const usuario = await this.expedientes.exigirParaActuar(expediente, ETAPAS_EDITABLES, usuarioId, [EstadoExpediente.EN_TRAMITE, EstadoExpediente.OBSERVADO]);
    const concesion = await tx.findOneByOrFail(Concesion, { expediente: { id: expediente.id } });
    return { expediente, concesion, usuario };
  }

  /**
   * Guarda cambios en una sección que tiene UNA fila vigente por concesión: el inmueble
   * (pasos 3 y 4), las condiciones (pasos 5 y 6) o el suministro (paso 6). Si todavía no
   * hay fila vigente, la crea con el expediente que la cargó.
   */
  async guardarEnVigente<T extends SeccionUnica>(tx: EntityManager, entidad: EntityTarget<T>, { expediente, concesion }: AltaEditable, cambios: DeepPartial<T>): Promise<void> {
    //1.- Se busca la fila vigente de la concesión.
    // (TypeScript no puede deducir que las tres entidades tienen concesion y vigente: se le indica.)
    const deLaConcesion = { concesion: { id: concesion.id }, vigente: true } as unknown as FindOptionsWhere<T>;
    const existente = await tx.findOneBy(entidad, deLaConcesion);

    //2.- Si existe se actualiza; si no, se crea.
    if (existente) await tx.save(entidad, tx.merge(entidad, existente, cambios));
    else await tx.save(entidad, tx.create(entidad, { ...cambios, concesion, expediente, vigente: true } as DeepPartial<T>));
  }

  /** Deja registrado quién tocó el expediente por última vez (bandejas, «altas en curso»). */
  async marcarModificado(tx: EntityManager, { expediente, usuario }: AltaEditable): Promise<void> {
    await tx.update(Expediente, expediente.id, { modificadoUsuarioId: usuario.id });
  }
}
