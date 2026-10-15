import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { Etapa, NOMBRE_ETAPA, NOMBRE_TIPO_TRAMITE, OFICINA_DE_ETAPA, SIGUIENTE_ETAPA, TipoTramite } from '../expedientes/expedientes.constantes.js';
import { OficinaDrh } from '../seguridad/entities/oficina.entity.js';
import { UsuariosService } from '../seguridad/usuarios.service.js';
import { CatalogosService } from './catalogos.service.js';
import { ESTADOS_EXPEDIENTE_INICIALES, OPCIONES_INICIALES, TRAMITES_MENU_CATASTRO } from './catalogos.seed.js';
import { EstadoExpedienteCatalogo } from './entities/estado-expediente.entity.js';
import { EtapaCatalogo } from './entities/etapa.entity.js';
import { GrupoOpcion, Opcion } from './entities/opcion.entity.js';
import { TipoTramiteCatalogo } from './entities/tipo-tramite.entity.js';

/**
 * Pases entre oficinas de los trámites de concesiones, en orden: de la carga en Catastro hasta
 * la verificación final (la espera del padrón de Rentas ya no es un pase entre oficinas).
 */
const CIRCUITO_CONCESIONES: string[] = [];
for (let e: Etapa | undefined = Etapa.CARGA; e && e !== Etapa.ESPERA_PADRON; e = SIGUIENTE_ETAPA[e]) CIRCUITO_CONCESIONES.push(e);

const comoOpciones = (filas: Opcion[], grupo: GrupoOpcion) => filas.filter((o) => o.grupo === grupo).map((o) => ({ id: o.codigo, nombre: o.nombre }));

/**
 * Datos de referencia que el frontend carga una vez al abrir la app (GET /api/dominio):
 * oficinas, etapas, trámites, estados, usos, situaciones legales, listas de los formularios y
 * usuarios. Todo sale de la base; al arrancar se cargan las filas que falten.
 */
@Injectable()
export class DominioService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DominioService.name);

  constructor(
    @InjectRepository(TipoTramiteCatalogo) private readonly tramites: Repository<TipoTramiteCatalogo>,
    @InjectRepository(EtapaCatalogo) private readonly etapas: Repository<EtapaCatalogo>,
    @InjectRepository(EstadoExpedienteCatalogo) private readonly estados: Repository<EstadoExpedienteCatalogo>,
    @InjectRepository(Opcion) private readonly opciones: Repository<Opcion>,
    @InjectRepository(OficinaDrh) private readonly oficinas: Repository<OficinaDrh>,
    private readonly catalogos: CatalogosService,
    private readonly usuarios: UsuariosService,
  ) {}

  /**
   * Agrega las filas que falten (un trámite o etapa nueva del código aparece también en una base
   * que ya tenía las demás). No pisa lo que se haya editado en la base.
   */
  async onApplicationBootstrap() {
    const menu = Object.keys(TRAMITES_MENU_CATASTRO);
    const tramites = Object.values(TipoTramite).map((codigo, i) => ({
      codigo,
      nombre: NOMBRE_TIPO_TRAMITE[codigo],
      descripcion: TRAMITES_MENU_CATASTRO[codigo]?.descripcion ?? null,
      icono: TRAMITES_MENU_CATASTRO[codigo]?.icono ?? null,
      enMenuCatastro: menu.includes(codigo),
      orden: menu.includes(codigo) ? menu.indexOf(codigo) : menu.length + i,
    }));
    await this.agregarFaltantes(this.tramites, tramites, 'trámites');

    // Las etapas apuntan a seg_oficina: se espera a que estén cargadas las oficinas.
    await this.usuarios.cargaInicial();
    const etapas = Object.values(Etapa).map((codigo, i) => ({ codigo, nombre: NOMBRE_ETAPA[codigo], oficina: { codigo: OFICINA_DE_ETAPA[codigo] }, orden: i + 1 }));
    await this.agregarFaltantes(this.etapas, etapas, 'etapas');

    const estados = Object.entries(ESTADOS_EXPEDIENTE_INICIALES).map(([codigo, e], i) => ({ codigo, ...e, orden: i }));
    await this.agregarFaltantes(this.estados, estados, 'estados de expediente');

    const existentes = new Set((await this.opciones.find()).map((o) => `${o.grupo}|${o.codigo}`));
    const opciones = Object.entries(OPCIONES_INICIALES)
      .flatMap(([grupo, filas]) => filas.map((f, orden) => ({ grupo: grupo as GrupoOpcion, ...f, orden })))
      .filter((o) => !existentes.has(`${o.grupo}|${o.codigo}`));
    if (opciones.length) {
      await this.opciones.save(opciones);
      this.logger.log(`Opciones de formularios cargadas: ${opciones.length}.`);
    }
  }

  private async agregarFaltantes<T extends { codigo: string }>(repo: Repository<T>, filas: (DeepPartial<T> & { codigo: string })[], nombre: string) {
    const existentes = new Set((await repo.find()).map((f) => f.codigo));
    const nuevas = filas.filter((f) => !existentes.has(f.codigo));
    if (!nuevas.length) return;
    await repo.save(nuevas);
    this.logger.log(`Catálogo de ${nombre}: ${nuevas.length} filas cargadas.`);
  }

  async obtener() {
    const [oficinas, etapas, tramites, estados, situaciones, usos, opciones, usuarios] = await Promise.all([
      this.oficinas.find({ where: { activa: true }, order: { orden: 'ASC' } }),
      this.etapas.find({ where: { activo: true }, relations: { oficina: true }, order: { orden: 'ASC' } }),
      this.tramites.find({ where: { activo: true }, order: { orden: 'ASC' } }),
      this.estados.find({ order: { orden: 'ASC' } }),
      this.catalogos.listarSituacionesLegales(),
      this.catalogos.listarTiposUso(),
      this.opciones.find({ where: { activo: true }, order: { grupo: 'ASC', orden: 'ASC' } }),
      this.usuarios.listar(),
    ]);

    return {
      oficinas: oficinas.map((o) => ({ id: o.codigo, nombre: o.nombre, descripcion: o.descripcion ?? '', descripcionBandeja: o.descripcionBandeja ?? '' })),
      // Circuito de concesiones (el front lo usa para la barra de pasos); las de pozos tienen su barra.
      etapas: etapas
        .filter((e) => CIRCUITO_CONCESIONES.includes(e.codigo))
        .sort((a, b) => CIRCUITO_CONCESIONES.indexOf(a.codigo) - CIRCUITO_CONCESIONES.indexOf(b.codigo))
        .map((e, i) => ({ id: e.codigo, nombre: e.nombre, oficinaId: e.oficina.codigo, orden: i + 1 })),
      tramites: tramites.map((t) => ({ id: t.codigo, nombre: t.nombre, descripcion: t.descripcion ?? '', icono: t.icono ?? 'description', enMenuCatastro: t.enMenuCatastro })),
      estados: estados.map((e) => ({ id: e.codigo, nombre: e.nombre, color: e.color, pendiente: e.pendiente })),
      situacionesLegales: situaciones.map((s) => ({ id: s.codigo, nombre: s.nombre, titulo: s.titulo, documentacion: s.documentos.map((d) => d.descripcion) })),
      usos: usos.map((u) => ({ id: u.codigo, nombre: u.nombre, dotacion: Number(u.dotacion), unidad: u.unidad, requierePuntoEntrega: u.requierePuntoEntrega })),
      circunscripciones: comoOpciones(opciones, GrupoOpcion.CIRCUNSCRIPCION),
      seccionesCatastrales: comoOpciones(opciones, GrupoOpcion.SECCION_CATASTRAL),
      caracteres: comoOpciones(opciones, GrupoOpcion.CARACTER),
      codigosServicio: comoOpciones(opciones, GrupoOpcion.CODIGO_SERVICIO),
      tiposConcesion: comoOpciones(opciones, GrupoOpcion.TIPO_CONCESION),
      documentosJuridicos: comoOpciones(opciones, GrupoOpcion.DOCUMENTO_JURIDICO),
      usuarios: usuarios.map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}`, oficinaId: u.oficina?.codigo ?? null })),
    };
  }
}
