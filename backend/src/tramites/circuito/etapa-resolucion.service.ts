import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/errores-db.js';
import { Resolucion } from '../../expedientes/entities/resolucion.entity.js';
import { Dictamen, Etapa, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { ResolucionDto } from './dto/circuito.dto.js';
import { NumeroConcesionService } from './numero-concesion.service.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { exigirFechaDelAnio } from './validaciones/circuito.validaciones.js';

/**
 * Secretaría General: con el visto bueno del director, carga la resolución (número que lleva
 * Secretaría, año y fecha). En los trámites que piden número de concesión (alta) lo necesita ya
 * cargado por Catastro: así, cuando el expediente vuelve a Catastro para el cierre, ya tiene
 * número de concesión y resolución.
 */
@Injectable()
export class EtapaResolucionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly numeros: NumeroConcesionService,
    private readonly registro: RegistroTramitesService,
  ) {}

  async registrar(tipo: TipoTramite, expedienteId: string, datos: ResolucionDto, usuarioId: string): Promise<void> {
    //1.- Se valida que la fecha sea del año de la resolución.
    exigirFechaDelAnio(datos.fecha, datos.anio);

    await this.dataSource.transaction(async (tx) => {
      //2.- Secretaría tiene que tener tomado el expediente, en su etapa.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.SECRETARIA_GENERAL], usuarioId);

      //3.- Si el trámite pide número de concesión (alta), Catastro ya lo tiene que haber cargado:
      //    va en la resolución. Un cambio de titularidad no lo pide (la concesión ya lo tiene).
      const numeros = await this.numeros.asignadosA(tx, expediente.id);
      if (this.registro.de(tipo).pideNumeroConcesion && !numeros.length) {
        throw new ConflictException('Primero pida el número de concesión y espere a que Catastro lo cargue: va en la resolución.');
      }

      //4.- La resolución (número + año único).
      let resolucion: Resolucion;
      try {
        resolucion = await tx.save(
          tx.create(Resolucion, { numero: String(Number(datos.numero)), anio: datos.anio, fecha: datos.fecha, expediente, observaciones: datos.observaciones ?? null, creadoPor: usuario }),
        );
      } catch (error) {
        if (esViolacionDeUnicidad(error, 'uk_resolucion')) throw new ConflictException(`La resolución ${Number(datos.numero)}/${datos.anio} ya está registrada.`);
        throw error;
      }

      //5.- El trámite la enlaza (alta: a la concesión, con la fecha de otorgamiento).
      const detalle = await this.registro.de(tipo).alRegistrarResolucion(tx, expediente, resolucion, usuario);

      //6.- Queda en el historial y pasa a Catastro para el cierre.
      const texto = `Resolución ${resolucion.numero}/${resolucion.anio}. ${detalle}`;
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.RESOLUCION,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: datos.observaciones,
        datos: { resolucion: `${resolucion.numero}/${resolucion.anio}`, fecha: datos.fecha, ...(numeros.length ? { numerosConcesion: numeros } : {}) },
      });
      await this.expedientes.pasar(tx, expediente, { etapa: SIGUIENTE_ETAPA[Etapa.SECRETARIA_GENERAL]!, usuario, dictamen: Dictamen.APTO, observaciones: texto });
    });
  }
}
