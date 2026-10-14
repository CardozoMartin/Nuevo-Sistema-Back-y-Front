import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import type { TipoUso } from '../catalogos/entities/tipo-uso.entity.js';
import { UbicacionesService, type IndiceUbicaciones } from '../catalogos/ubicaciones.service.js';
import { USUARIO_SISTEMA } from '../comun/usuario-sistema.js';
import { caudalDeUso } from '../concesiones/caudal.js';
import {
  EstadoConcesion,
  OrigenConcesion,
  OrigenPoligono,
  TipoDocumento,
  TipoPersona,
} from '../concesiones/concesiones.constantes.js';
import { Concesion } from '../concesiones/entities/concesion.entity.js';
import { Condicion } from '../concesiones/entities/condicion.entity.js';
import { Inmueble } from '../concesiones/entities/inmueble.entity.js';
import { Poligono } from '../concesiones/entities/poligono.entity.js';
import { Punto } from '../concesiones/entities/punto.entity.js';
import { Suministro } from '../concesiones/entities/suministro.entity.js';
import { Titular } from '../concesiones/entities/titular.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { Uso } from '../concesiones/entities/uso.entity.js';
import { Domicilio } from '../concesiones/entities/domicilio.entity.js';
import { PoligonosService } from '../concesiones/poligonos.service.js';
import { Pozo } from '../pozos/entities/pozo.entity.js';
import { EstadoPozo, OrigenPozo } from '../pozos/pozos.constantes.js';
import { GeometriaService } from '../sig/geometria.service.js';
import { LIMITES_TUCUMAN, SRID_POSGAR, SRID_WGS84 } from '../sig/sig.constantes.js';
import { LoteMigracion } from './entities/lote-migracion.entity.js';
import { RegistroOrigen } from './entities/registro-origen.entity.js';
import * as N from './fila-padron.js';
import type { FilaPadron } from './fila-padron.js';

const ENTIDAD = 'concesion';

export interface OpcionesImportacion {
  nombre: string;
  archivo?: string;
  /** Datos de prueba: el lote se puede borrar entero después. */
  demo?: boolean;
  /** Nombre de la hoja/tabla de origen (queda en la trazabilidad). */
  tablaOrigen?: string;
}

type ResultadoFila =
  | {
      fila: number;
      clave: string;
      resultado: 'importada';
      conPoligono: boolean;
      pozos: number;
      avisos: string[];
    }
  | { fila: number; clave: string; resultado: 'omitida'; motivo: string }
  | { fila: number; clave: string; resultado: 'error'; motivo: string };

/**
 * Importa el padrón de concesiones existentes (las otorgadas antes del sistema).
 *
 * Por cada fila, en su propia transacción (una fila con error no frena al resto):
 *   1. Si ya fue importada (mig_registro_origen), se omite: la importación es repetible.
 *   2. Concesión VIGENTE, origen MIGRACION, con su número de otorgamiento.
 *   3. Titulares (texto libre de la planilla → denominación, tipo de persona y documento).
 *   4. Inmueble con la ubicación administrativa, la cuenca y los padrones (Rentas y Catastro).
 *   5. Uso con su caudal (magnitud × dotación) → caudal asignado de la concesión.
 *   6. Suministro (fuente, sistema, canales, desagüe).
 *   7. Polígono, si la fila lo trae: PostGIS lo valida; si es inválido se importa la
 *      concesión igual, sin polígono, y queda el aviso.
 *   8. Pozos, si la fila los trae (avisa si alguno cae fuera del polígono).
 *   9. Registro de origen con la fila original completa.
 */
@Injectable()
export class ImportadorService {
  private readonly logger = new Logger(ImportadorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly catalogos: CatalogosService,
    private readonly ubicaciones: UbicacionesService,
    private readonly geometria: GeometriaService,
    private readonly poligonos: PoligonosService,
  ) {}

  async importar(
    filas: FilaPadron[],
    opciones: OpcionesImportacion,
  ): Promise<LoteMigracion> {
    if (!Array.isArray(filas) || !filas.length)
      throw new BadRequestException('El archivo no tiene filas para importar.');

    const tipos = new Map(
      (await this.catalogos.listarTiposUso()).map((t) => [t.codigo, t]),
    );
    // Departamentos, localidades, distritos y cuencas en memoria (una consulta, no una por fila).
    const indice = await this.ubicaciones.cargarIndice();
    const lote = await this.dataSource.getRepository(LoteMigracion).save({
      nombre: opciones.nombre,
      archivo: opciones.archivo ?? null,
      demo: !!opciones.demo,
      filas: filas.length,
    });

    const resultados: ResultadoFila[] = [];
    for (const [i, fila] of filas.entries()) {
      const numeroFila = i + 1;
      const clave = N.texto(fila.otorgamiento);
      if (!clave) {
        resultados.push({
          fila: numeroFila,
          clave: '',
          resultado: 'error',
          motivo: 'Falta el número de otorgamiento.',
        });
        continue;
      }
      try {
        resultados.push(
          await this.dataSource.transaction((tx) =>
            this.importarFila(
              tx,
              fila,
              numeroFila,
              clave,
              lote,
              tipos,
              indice,
              opciones,
            ),
          ),
        );
      } catch (error) {
        resultados.push({
          fila: numeroFila,
          clave,
          resultado: 'error',
          motivo: error instanceof Error ? error.message : String(error),
        });
      }
      if (numeroFila % 250 === 0)
        this.logger.log(`${numeroFila} / ${filas.length} filas procesadas…`);
    }

    // Resumen del lote. El informe guarda solo lo que hay que revisar (errores y avisos).
    lote.importadas = resultados.filter(
      (r) => r.resultado === 'importada',
    ).length;
    lote.omitidas = resultados.filter((r) => r.resultado === 'omitida').length;
    lote.conError = resultados.filter((r) => r.resultado === 'error').length;
    lote.conPoligono = resultados.filter(
      (r) => r.resultado === 'importada' && r.conPoligono,
    ).length;
    lote.informe = resultados.filter(
      (r) =>
        r.resultado === 'error' ||
        (r.resultado === 'importada' && r.avisos.length),
    );
    return this.dataSource.getRepository(LoteMigracion).save(lote);
  }

  private async importarFila(
    tx: EntityManager,
    fila: FilaPadron,
    numeroFila: number,
    clave: string,
    lote: LoteMigracion,
    tipos: Map<string, TipoUso>,
    indice: IndiceUbicaciones,
    opciones: OpcionesImportacion,
  ): Promise<ResultadoFila> {
    // Paso 1: ¿ya importada?
    if (
      await tx.existsBy(RegistroOrigen, {
        entidadTipo: ENTIDAD,
        idOrigen: clave,
      })
    ) {
      return {
        fila: numeroFila,
        clave,
        resultado: 'omitida',
        motivo: 'Ya estaba importada.',
      };
    }
    if (await tx.existsBy(Concesion, { numero: clave })) {
      throw new Error(
        `Ya existe una concesión con el número ${clave} (cargada en el sistema).`,
      );
    }
    const avisos: string[] = [];

    // Paso 2: concesión. Una fila con el polígono y nada más (capa de QGIS sin los datos del
    //   padrón) se importa igual, marcada para completar: así el polígono queda asociado al número.
    const propietario = N.texto(fila.propietariosActuales);
    const soloPoligono = !!fila.geometria && !N.texto(fila.titulares) && !N.texto(fila.uso) && !N.texto(fila.fuente);
    if (soloPoligono) avisos.push('Solo trae el polígono: faltan los datos de la concesión.');
    const concesion = await tx.save(
      tx.create(Concesion, {
        numero: clave,
        origen: OrigenConcesion.MIGRACION,
        estado: EstadoConcesion.VIGENTE,
        tipoDerecho: N.tipoDerecho(fila.tipoOtorgamiento),
        anioOtorgamiento:
          Number.isInteger(Number(fila.anio)) && fila.anio
            ? Number(fila.anio)
            : null,
        expediente: null,
        situacionLegal: null,
        observaciones: soloPoligono
          ? 'Importada solo con el polígono: faltan los datos de la concesión.'
          : propietario
            ? `Propietario actual informado en el padrón: ${propietario}.`
            : null,
        creadoUsuarioId: USUARIO_SISTEMA,
      }),
    );

    // Paso 3: titulares. Cada uno es una persona (per_persona):
    //   - con documento, se unifica con la persona que ya tenga ese documento (el mismo
    //     titular de varias concesiones queda una sola vez);
    //   - sin documento no hay con qué compararla: se crea una persona nueva.
    const titulares = N.titulares(fila, avisos);
    if (!titulares.length && !soloPoligono) avisos.push('La fila no tiene titulares.');
    for (const [orden, t] of titulares.entries()) {
      const existente = t.documento ? await tx.findOneBy(Persona, { documento: t.documento }) : null;
      const persona =
        existente ??
        (await tx.save(
          tx.create(Persona, {
            tipoPersona: t.tipoPersona,
            denominacion: t.denominacion,
            razonSocial: t.tipoPersona === TipoPersona.JURIDICA ? t.denominacion : null,
            documento: t.documento,
            tipoDocumento: t.tipoDocumento as TipoDocumento | null,
            creadoUsuarioId: USUARIO_SISTEMA,
          }),
        ));
      await tx.save(tx.create(Titular, { concesion, persona, orden, vigente: true }));
    }

    // Paso 4: inmueble (ubicación administrativa), con los nombres traducidos al catálogo.
    //   Lo que no está en el catálogo queda vacío y se avisa; el texto original sigue en
    //   mig_registro_origen (la fila completa de la planilla).
    const ubicacion = this.ubicacionDelCatalogo(fila, indice, avisos);
    await tx.save(
      tx.create(Inmueble, {
        concesion,
        ...ubicacion,
        padron: N.texto(fila.padronRentas),
        matriculaCatastral: N.texto(fila.padronCatastro),
        vigente: true,
      }),
    );

    // Paso 5: uso y caudal.
    const codigoUso = N.codigoUso(fila.uso);
    const tipo = codigoUso ? tipos.get(codigoUso) : undefined;
    const magnitud = Number(fila.cantidad);
    let caudalAsignado: number | null = null;
    if (!tipo) {
      if (N.texto(fila.uso))
        avisos.push(`Uso «${N.texto(fila.uso)}» desconocido: no se cargó.`);
    } else if (!(magnitud > 0)) {
      avisos.push(`Uso ${tipo.nombre} sin cantidad: no se cargó.`);
    } else {
      const caudal = caudalDeUso(magnitud, Number(tipo.dotacion));
      await tx.save(
        tx.create(Uso, {
          concesion,
          orden: 0,
          tipoUso: tipo,
          magnitud: String(magnitud),
          caudalLps: String(caudal),
          vigente: true,
        }),
      );
      caudalAsignado = caudal;
    }

    // Condiciones del derecho: carácter, código de servicio y caudal asignado.
    await tx.save(
      tx.create(Condicion, {
        concesion,
        caracter: N.caracter(fila.caracter),
        codigoServicio: N.codigoServicio(fila.codigoServicio),
        caudalLps: caudalAsignado === null ? null : String(caudalAsignado),
        vigente: true,
      }),
    );

    // Paso 6: suministro.
    const fuente = N.textoConDato(fila.fuente);
    if (fuente) {
      await tx.save(
        tx.create(Suministro, {
          concesion,
          fuentePrincipal: fuente,
          fuentesAdicionales: [],
          sistemaDistribucion: N.textoConDato(fila.sistema),
          canalPrincipal: N.textoConDato(fila.canalPrincipal),
          canalSecundario: N.textoConDato(fila.canalSecundario),
          canalTerciario: N.textoConDato(fila.canalTerciario),
          canalCuarto: N.textoConDato(fila.canalCuarto),
          canalQuinto: N.textoConDato(fila.canalQuinto),
          desague: N.textoConDato(fila.desague),
        }),
      );
    }

    // Paso 7: polígono (opcional). Un polígono malo no impide importar la concesión.
    //   Va en una transacción anidada (SAVEPOINT): si PostGIS rechaza la geometría con un
    //   error de SQL, se deshace solo esta parte y la fila sigue.
    let conPoligono = false;
    if (fila.geometria) {
      try {
        await tx.transaction(async (sp) => {
          // Varias parcelas de la concesión: las que comparten linderos se unen en una.
          const recibida = N.aMultiPolygon(fila.geometria!);
          const unidas = await this.geometria.unirPartes(recibida, sp);
          if (unidas.partes < recibida.coordinates.length)
            avisos.push(`Se unieron parcelas vecinas: ${recibida.coordinates.length} partes → ${unidas.partes}.`);
          // El polígono puede venir en POSGAR 2007 faja 3 o en lat/long: se lleva a WGS84.
          const { geometria } = await this.geometria.normalizar(unidas.geometria, sp);
          await this.geometria.analizar(geometria, concesion.id, sp);
          await this.poligonos.insertar(sp, {
            concesionId: concesion.id,
            expedienteId: null,
            origen: OrigenPoligono.MIGRACION,
            geometria,
            archivo: null,
            usuarioId: USUARIO_SISTEMA,
          });
        });
        conPoligono = true;
      } catch (error) {
        avisos.push(
          `Polígono descartado: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Paso 8: pozos.
    const pozos = await this.importarPozos(tx, fila, clave, concesion, avisos);

    // Paso 9: trazabilidad (sin la geometría ni los pozos, que ya están en sus tablas).
    const { geometria: _geometria, pozos: _pozos, ...original } = fila;
    await tx.save(
      tx.create(RegistroOrigen, {
        lote,
        entidadTipo: ENTIDAD,
        idNuevo: concesion.id,
        idOrigen: clave,
        tablaOrigen: opciones.tablaOrigen ?? opciones.archivo ?? null,
        datosOrigen: original,
        observaciones: avisos.length ? avisos.join(' | ') : null,
      }),
    );

    return {
      fila: numeroFila,
      clave,
      resultado: 'importada',
      conPoligono,
      pozos,
      avisos,
    };
  }

  /**
   * Pozos de la fila, vinculados a la concesión. Origen MIGRACION (sin expediente).
   * Un pozo con coordenadas fuera de Tucumán se descarta con aviso; uno que cae fuera del
   * polígono de su concesión se carga igual y se avisa (puede estar mal el pozo o el polígono).
   * Devuelve cuántos se cargaron.
   */
  /** Departamento, localidad, distrito y cuenca de la fila, traducidos al catálogo (con avisos). */
  private ubicacionDelCatalogo(fila: FilaPadron, indice: IndiceUbicaciones, avisos: string[]) {
    const nombres = {
      departamento: N.textoConDato(fila.departamento),
      localidad: N.localidad(fila.departamento, fila.localidad),
      distrito: N.distrito(fila.distrito),
      cuenca: N.textoConDato(fila.cuenca),
    };
    const departamento = indice.departamento(nombres.departamento);
    const localidad = indice.localidad(departamento, nombres.localidad);
    const distrito = indice.distrito(nombres.distrito);
    const cuenca = indice.cuenca(nombres.cuenca);

    if (nombres.departamento && !departamento) avisos.push(`Departamento «${nombres.departamento}» no está en el catálogo: quedó sin departamento.`);
    if (nombres.localidad && departamento && !localidad) avisos.push(`Localidad «${nombres.localidad}» no está en el catálogo de ${departamento.nombre}: quedó sin localidad.`);
    if (nombres.distrito && !distrito) avisos.push(`Distrito «${nombres.distrito}» no está en el catálogo: quedó sin distrito.`);
    if (nombres.cuenca && !cuenca) avisos.push(`Cuenca «${nombres.cuenca}» no está en el catálogo: quedó sin cuenca.`);
    return { departamento, localidad, distrito, cuenca };
  }

  private async importarPozos(tx: EntityManager, fila: FilaPadron, clave: string, concesion: Concesion, avisos: string[]): Promise<number> {
    const { oeste, sur, este, norte } = LIMITES_TUCUMAN;
    const estados = Object.values(EstadoPozo).filter((e) => e !== EstadoPozo.ANULADO) as string[];
    let cargados = 0;
    for (const [i, p] of (fila.pozos ?? []).entries()) {
      const nombre = N.texto(p.alias) ?? `pozo ${i + 1}`;
      const lat = Number(p.latitud);
      const lon = Number(p.longitud);
      if (!(lat >= sur && lat <= norte && lon >= oeste && lon <= este)) {
        avisos.push(`Pozo «${nombre}» con coordenadas fuera de Tucumán (${p.latitud}, ${p.longitud}): no se cargó.`);
        continue;
      }
      const estado = N.texto(p.estado)?.toUpperCase();
      const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : String(v));
      const { identifiers } = await tx.insert(Pozo, {
        // id_interno: «P» + número de concesión + orden (único porque el número lo es).
        idInterno: `P${clave}-${i + 1}`.slice(0, 20),
        origen: OrigenPozo.MIGRACION,
        expediente: null,
        alias: N.texto(p.alias),
        estado: estado && estados.includes(estado) ? (estado as EstadoPozo) : EstadoPozo.EN_USO,
        tipoPozo: N.texto(p.tipo),
        geom: () => `ST_Transform(ST_SetSRID(ST_MakePoint(${lon}, ${lat}), ${SRID_WGS84}), ${SRID_POSGAR})`,
        profundidadReal: num(p.profundidad),
        nivelEstatico: num(p.nivelEstatico),
        nivelDinamico: num(p.nivelDinamico),
        caudalBombeoM3h: num(p.caudalM3h),
        concesion,
        migradoEn: new Date().toISOString().slice(0, 10),
        creadoUsuarioId: USUARIO_SISTEMA,
      });
      cargados++;
      const [control] = await tx.query(
        `SELECT bool_or(ST_Within(z.geom, p.geom)) AS dentro, count(p.id) AS poligonos
           FROM poz_pozo z LEFT JOIN con_poligono p ON p.concesion_id = z.concesion_id AND p.vigente
          WHERE z.id = $1`,
        [identifiers[0].id],
      );
      if (Number(control.poligonos) > 0 && !control.dentro) avisos.push(`Pozo «${nombre}» cae fuera del polígono de la concesión.`);
    }
    return cargados;
  }

  /**
   * Borra un lote de PRUEBA con todo lo que creó. Los lotes reales no se borran:
   * en producción no hay eliminación física (los errores se corrigen con trámites).
   */
  async borrarLote(loteId: number): Promise<number> {
    return this.dataSource.transaction(async (tx) => {
      const lote = await tx.findOneBy(LoteMigracion, { id: loteId });
      if (!lote) throw new BadRequestException(`No existe el lote ${loteId}.`);
      if (!lote.demo)
        throw new BadRequestException(
          `El lote ${loteId} no es de prueba: no se puede borrar.`,
        );

      const registros = await tx.find(RegistroOrigen, {
        where: { lote: { id: loteId }, entidadTipo: ENTIDAD },
      });
      const ids = registros.map((r) => r.idNuevo);
      if (ids.length) {
        // Personas de estas concesiones: se borran después las que queden sin ninguna.
        const personas: { persona_id: string }[] = await tx.query(
          `SELECT DISTINCT persona_id FROM con_titular WHERE concesion_id = ANY($1)`,
          [ids],
        );
        // Pozos del lote: los vinculados a estas concesiones y los que se desvincularon al
        // darlos de baja (la baja guarda la concesión anterior). Sus bajas son trámites de
        // prueba sobre datos de prueba: se borran con su expediente.
        const pozos: { id: string }[] = await tx.query(
          `SELECT id FROM poz_pozo WHERE concesion_id = ANY($1)
           UNION SELECT pozo_id FROM poz_baja WHERE concesion_anterior_id = ANY($1)`,
          [ids],
        );
        const pozoIds = pozos.map((p) => p.id);
        const expedientes: { expediente_id: string }[] = await tx.query(`SELECT expediente_id FROM poz_baja WHERE pozo_id = ANY($1)`, [pozoIds]);
        const expedienteIds = expedientes.map((e) => e.expediente_id);
        await tx.query(`DELETE FROM poz_baja WHERE pozo_id = ANY($1)`, [pozoIds]);
        for (const tabla of ['exp_resolucion', 'exp_actuacion', 'exp_movimiento']) {
          await tx.query(`DELETE FROM ${tabla} WHERE expediente_id = ANY($1)`, [expedienteIds]);
        }
        await tx.query(`DELETE FROM exp_expediente WHERE id = ANY($1)`, [expedienteIds]);
        await tx.query(`DELETE FROM poz_pozo WHERE id = ANY($1)`, [pozoIds]);

        // Primero lo que cuelga de la concesión, después la concesión.
        for (const entidad of [
          Poligono,
          Uso,
          Condicion,
          Punto,
          Suministro,
          Inmueble,
          Titular,
          Domicilio,
        ]) {
          await tx.delete(entidad, { concesion: { id: In(ids) } });
        }
        await tx.delete(RegistroOrigen, { lote: { id: loteId } });
        await tx.delete(Concesion, { id: In(ids) });
        await tx.query(
          `DELETE FROM per_persona p
            WHERE p.id = ANY($1)
              AND NOT EXISTS (SELECT 1 FROM con_titular t WHERE t.persona_id = p.id)
              AND NOT EXISTS (SELECT 1 FROM rec_deuda d WHERE d.persona_id = p.id)`,
          [personas.map((p) => p.persona_id)],
        );
      }
      await tx.delete(LoteMigracion, { id: loteId });
      return ids.length;
    });
  }

  async borrarLotesDemo(): Promise<number> {
    const lotes = await this.dataSource
      .getRepository(LoteMigracion)
      .findBy({ demo: true });
    let total = 0;
    for (const lote of lotes) total += await this.borrarLote(lote.id);
    return total;
  }

  /** Lotes importados, del más nuevo al más viejo (sin el informe, que puede ser largo). */
  listarLotes(): Promise<LoteMigracion[]> {
    return this.dataSource.getRepository(LoteMigracion).find({
      order: { id: 'DESC' },
      select: {
        id: true,
        nombre: true,
        archivo: true,
        demo: true,
        filas: true,
        importadas: true,
        omitidas: true,
        conError: true,
        conPoligono: true,
        creadoEn: true,
      },
    });
  }
}
