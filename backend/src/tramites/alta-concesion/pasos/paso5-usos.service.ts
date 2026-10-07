import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { CatalogosService } from '../../../catalogos/catalogos.service.js';
import { caudalDeUso, caudalTotal } from '../../../concesiones/caudal.js';
import { TipoPunto } from '../../../concesiones/concesiones.constantes.js';
import { Condicion } from '../../../concesiones/entities/condicion.entity.js';
import { Punto } from '../../../concesiones/entities/punto.entity.js';
import { Uso } from '../../../concesiones/entities/uso.entity.js';
import { SRID_POSGAR, SRID_WGS84 } from '../../../sig/sig.constantes.js';
import { AltaConcesionService, type AltaEditable } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { CoordenadaDto, UsosDto } from '../dto/usos.dto.js';
import { exigirPeriodoValido, exigirPuntoEntregaSiCorresponde, exigirUsosDelCatalogo, exigirUsosSinRepetir } from '../validaciones/usos.validaciones.js';

/**
 * Paso 5 del alta: usos y magnitudes.
 *
 * - Condiciones (con_condicion): carácter, código de servicio, período y el caudal asignado,
 *   que se propone con la suma de los caudales de los usos (en el paso 6 se puede corregir).
 * - Usos (con_uso): cada uno con su magnitud y su caudal = magnitud × dotación del catálogo.
 * - Puntos (con_punto): el desagüe siempre; el punto de entrega si algún uso lo exige.
 */
@Injectable()
export class UsosAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly catalogos: CatalogosService,
  ) {}

  async guardar(expedienteId: string, datos: UsosDto, usuarioId: string): Promise<RespuestaAlta> {
    const codigos = datos.items.map((i) => i.uso);

    //1.- Se valida que el fin del período no sea anterior al inicio.
    exigirPeriodoValido(datos.periodoInicio, datos.periodoFin);

    //2.- Se valida que cada tipo de uso esté una sola vez y exista en el catálogo.
    exigirUsosSinRepetir(codigos);
    const tipos = new Map((await this.catalogos.buscarTiposUso(codigos)).map((t) => [t.codigo, t]));
    exigirUsosDelCatalogo(codigos, tipos);

    //3.- Se valida que, si algún uso lo exige (ej: pecuario), venga el punto de entrega.
    const exigenEntrega = exigirPuntoEntregaSiCorresponde([...tipos.values()], !!datos.puntoEntrega);

    //4.- Se calcula el caudal de cada uso (magnitud × dotación) y el total.
    const usos = datos.items.map((item) => {
      const tipo = tipos.get(item.uso)!;
      return { item, tipo, caudal: caudalDeUso(item.magnitud, Number(tipo.dotacion)) };
    });
    const total = caudalTotal(usos.map((u) => u.caudal));

    await this.dataSource.transaction(async (tx) => {
      //5.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId);
      const { expediente, concesion } = editable;

      //6.- Condiciones del derecho, con el caudal asignado propuesto (la suma de los usos).
      await this.alta.guardarEnVigente(tx, Condicion, editable, {
        caracter: datos.caracter ?? null,
        codigoServicio: datos.codigoServicio ?? null,
        periodoInicio: datos.periodoInicio ?? null,
        periodoFin: datos.periodoFin ?? null,
        caudalLps: String(total),
      });

      //7.- Usos: mientras el alta no está otorgada, se reemplazan los vigentes por los nuevos.
      await tx.delete(Uso, { concesion: { id: concesion.id }, vigente: true });
      await tx.save(
        usos.map(({ item, tipo, caudal }, orden) =>
          tx.create(Uso, { concesion, orden, tipoUso: tipo, magnitud: String(item.magnitud), caudalLps: String(caudal), expediente, vigente: true }),
        ),
      );

      //8.- Puntos: el desagüe siempre; la entrega solo si algún uso la exige.
      await tx.delete(Punto, { concesion: { id: concesion.id }, vigente: true });
      await this.guardarPunto(tx, editable, TipoPunto.DESAGUE, datos.desague);
      if (exigenEntrega.length && datos.puntoEntrega) {
        const { referencia, ...coordenada } = datos.puntoEntrega;
        await this.guardarPunto(tx, editable, TipoPunto.ENTREGA, coordenada, referencia);
      }
      await this.alta.marcarModificado(tx, editable);
    });

    //9.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }

  /**
   * Un punto en POSGAR 2007 faja 3 (lo que carga la oficina): se guarda X/Y tal cual, como
   * geometría, y con la latitud/longitud WGS84 que calcula PostGIS para el mapa web.
   */
  private async guardarPunto(tx: EntityManager, { expediente, concesion }: AltaEditable, tipo: TipoPunto, { x, y }: CoordenadaDto, referencia?: string) {
    //1.- PostGIS pasa X/Y (POSGAR) a latitud/longitud (WGS84).
    const [fila] = await tx.query(
      `SELECT ST_Y(p) AS lat, ST_X(p) AS lon FROM ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), ${SRID_POSGAR}), ${SRID_WGS84}) AS p`,
      [x, y],
    );

    //2.- Se guarda el punto con las dos coordenadas y la geometría.
    await tx.save(
      tx.create(Punto, {
        concesion,
        tipo,
        coordX: String(x),
        coordY: String(y),
        geom: { type: 'Point', coordinates: [x, y] },
        latitud: Number(fila.lat).toFixed(6),
        longitud: Number(fila.lon).toFixed(6),
        referencia: referencia ?? null,
        expediente,
        vigente: true,
      }),
    );
  }
}
