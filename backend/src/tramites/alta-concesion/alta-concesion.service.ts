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
import { EstadoExpediente, Etapa, NOMBRE_ETAPA, Oficina, TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { Usuario } from '../../seguridad/entities/usuario.entity.js';
import { UsuariosService } from '../../seguridad/usuarios.service.js';
import { GeometriaService } from '../../sig/geometria.service.js';
import { armarRespuestaAlta, type PiezasAlta, type RespuestaAlta } from './alta-concesion.respuesta.js';
import { diferencias, exigirCambios, instantanea, NOMBRE_SECCION, type Instantanea, type SeccionCorregible } from './correccion.js';

/**
 * Etapas en las que Catastro puede cargar o corregir los datos del alta:
 *   CARGA       la carga preliminar;
 *   CORRECCION  lo devolvió Distrito o Jurídico con observaciones;
 *   CIERRE      la verificación final («cargan los datos que faltan»).
 */
const ETAPAS_EDITABLES = [Etapa.CARGA, Etapa.CORRECCION, Etapa.CIERRE];

/**
 * Corrección de errores materiales: se puede desde que el alta sale de la carga (mientras está
 * en carga o en corrección, Catastro la edita normalmente) y mientras no terminó sin otorgarse.
 */
const ETAPAS_SIN_CORRECCION = [Etapa.CARGA, Etapa.CORRECCION];
const ESTADOS_SIN_CORRECCION = [EstadoExpediente.ANULADO, EstadoExpediente.RECHAZADO, EstadoExpediente.ARCHIVADO];

/** Secciones con una sola fila vigente por concesión. */
type SeccionUnica = Inmueble | Condicion | Suministro;

/** Lo que necesita cada paso para guardar: el expediente bloqueado, su concesión y quién guarda. */
export interface AltaEditable {
  expediente: Expediente;
  concesion: Concesion;
  usuario: Usuario;
  /**
   * Corrección de un error material por fuera del circuito (con permiso y motivo). Saltea las
   * reglas del cierre («solo completar lo que falta»): justamente corrige lo ya aprobado.
   */
  correccion: boolean;
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
 */
@Injectable()
export class AltaConcesionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly geometria: GeometriaService,
    private readonly poligonos: PoligonosService,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Todo lo cargado en un alta (cualquiera sea la oficina en que esté). */
  async obtener(expedienteId: string): Promise<RespuestaAlta> {
    const respuesta = armarRespuestaAlta(await this.cargarPiezas(this.dataSource.manager, expedienteId));
    return { ...respuesta, avisoDeuda: await this.expedientes.avisoDeuda(expedienteId) };
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
    const poligonoPropuesto = await this.poligonos.propuesto(tx, concesion.id);
    const superposiciones = poligono ? await this.geometria.superposicionesDeConcesion(concesion.id, tx) : [];
    return { expediente, concesion, datos, documentacion, solicitudNumero, poligono, poligonoPropuesto, superposiciones };
  }

  /**
   * Bloquea el expediente (FOR UPDATE: dos guardados simultáneos no se pisan) y exige que
   * Catastro pueda editarlo: etapa de carga, corrección o cierre, circulando, y tomado por
   * el usuario que guarda.
   */
  async exigirEditable(tx: EntityManager, expedienteId: string, usuarioId: string, correccion = false): Promise<AltaEditable> {
    //1.- Se bloquea el expediente hasta el fin de la transacción.
    const expediente = await this.expedientes.bloquear(tx, expedienteId, TipoTramite.ALTA_CONCESION);
    if (correccion) return this.exigirCorregible(tx, expediente, usuarioId);

    //2.- Se valida que esté en una etapa en la que Catastro carga datos.
    if (!ETAPAS_EDITABLES.includes(expediente.etapa)) {
      throw new ConflictException(`El alta está en «${NOMBRE_ETAPA[expediente.etapa]}»: Catastro no puede modificar sus datos en esta etapa.`);
    }

    //3.- Se valida que lo tenga tomado quien guarda (y que sea de la oficina).
    const usuario = await this.expedientes.exigirParaActuar(expediente, ETAPAS_EDITABLES, usuarioId, [EstadoExpediente.EN_TRAMITE, EstadoExpediente.OBSERVADO]);
    const concesion = await tx.findOneByOrFail(Concesion, { expediente: { id: expediente.id } });
    return { expediente, concesion, usuario, correccion: false };
  }

  /**
   * Corrección de un error material: el permiso «Corregir datos de altas» lo exige el controller.
   * No hace falta tener el expediente tomado (puede estar en otra oficina o ya finalizado).
   */
  private async exigirCorregible(tx: EntityManager, expediente: Expediente, usuarioId: string): Promise<AltaEditable> {
    //1.- Mientras está en carga o en corrección, se edita normalmente (sin motivo).
    if (ETAPAS_SIN_CORRECCION.includes(expediente.etapa)) {
      throw new ConflictException(`El alta está en «${NOMBRE_ETAPA[expediente.etapa]}»: Catastro la edita desde la carga de datos, sin corrección.`);
    }

    //2.- Un trámite que terminó sin otorgarse no se corrige.
    if (ESTADOS_SIN_CORRECCION.includes(expediente.estado)) {
      throw new ConflictException(`El expediente está ${expediente.estado.toLowerCase()}: no se pueden corregir sus datos.`);
    }

    //3.- La corrección es de Catastro (o de un administrador).
    const usuario = await this.usuarios.exigirDeOficina(usuarioId, Oficina.CATASTRO);
    const concesion = await tx.findOneByOrFail(Concesion, { expediente: { id: expediente.id } });
    return { expediente, concesion, usuario, correccion: true };
  }

  /** Cómo está una sección antes de corregirla (para el antes / después del historial). */
  async instantanea(tx: EntityManager, expedienteId: string, seccion: SeccionCorregible): Promise<Instantanea> {
    return instantanea(armarRespuestaAlta(await this.cargarPiezas(tx, expedienteId)), seccion);
  }

  /**
   * Registra la corrección en el historial (motivo + antes / después de cada campo) y en la
   * auditoría. `extra`: cambios que no salen de la sección (ej: el polígono corregido).
   * Si no cambió nada, 400 y no se guarda.
   */
  async registrarCorreccion(
    tx: EntityManager,
    { expediente, usuario }: AltaEditable,
    seccion: SeccionCorregible,
    antes: Instantanea,
    motivo: string,
    extra: ReturnType<typeof diferencias> = [],
  ): Promise<void> {
    const cambios = [...diferencias(antes, await this.instantanea(tx, expediente.id, seccion)), ...extra];
    exigirCambios(cambios);
    await this.expedientes.registrarCorreccion(tx, expediente, { usuario, seccion: NOMBRE_SECCION[seccion], motivo, cambios });
    await tx.update(Expediente, expediente.id, { modificadoUsuarioId: usuario.id });
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
