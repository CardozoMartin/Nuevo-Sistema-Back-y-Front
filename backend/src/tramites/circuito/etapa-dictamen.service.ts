import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dictamen, EstadoExpediente, Etapa, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import type { DictamenDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { exigirMotivoSiNoEsApto } from './validaciones/circuito.validaciones.js';

/** Oficinas que dictaminan apto / observado / no apto. */
export type EtapaDictamen = Etapa.DISTRITO | Etapa.JURIDICO;

/** Qué actuación deja cada una: Distrito, el informe técnico; Jurídico, el dictamen. */
const TIPO_DE_DICTAMEN: Record<EtapaDictamen, TipoActuacion> = {
  [Etapa.DISTRITO]: TipoActuacion.INFORME_TECNICO,
  [Etapa.JURIDICO]: TipoActuacion.DICTAMEN_JURIDICO,
};

/**
 * Distrito (¿se le puede dar agua?) y Jurídico (¿papeles y requisitos legales?):
 *   APTO       pasa a la oficina siguiente.
 *   OBSERVADO  vuelve a Catastro para corregir (motivo obligatorio); después se le reenvía.
 *   NO_APTO    el trámite termina: expediente RECHAZADO y lo que defina el trámite (alta:
 *              concesión DENEGADA). Motivo obligatorio. Ya no se puede finalizar.
 */
@Injectable()
export class EtapaDictamenService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly registro: RegistroTramitesService,
  ) {}

  async dictaminar(tipo: TipoTramite, expedienteId: string, etapa: EtapaDictamen, datos: DictamenDto, usuarioId: string): Promise<void> {
    //1.- Se valida que observado y no apto traigan el motivo.
    exigirMotivoSiNoEsApto(datos.resultado, datos.observaciones);

    await this.dataSource.transaction(async (tx) => {
      //2.- La oficina tiene que tener tomado el expediente, en su etapa.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [etapa], usuarioId);

      //3.- Queda el dictamen en el historial.
      await this.expedientes.actuar(tx, expediente, { tipo: TIPO_DE_DICTAMEN[etapa], resultado: ResultadoActuacion[datos.resultado], usuario, observaciones: datos.observaciones });

      //4.- Apto: pasa a la oficina siguiente.
      if (datos.resultado === 'APTO') {
        await this.expedientes.pasar(tx, expediente, { etapa: SIGUIENTE_ETAPA[etapa]!, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones });
        return;
      }

      //5.- Observado: vuelve a Catastro para corregir.
      if (datos.resultado === 'OBSERVADO') {
        await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.OBSERVADO, usuario);
        await this.expedientes.pasar(tx, expediente, { etapa: Etapa.CORRECCION, usuario, dictamen: Dictamen.OBSERVADO, observaciones: datos.observaciones, esDevolucion: true });
        return;
      }

      //6.- No apto: lo que defina el trámite (alta: concesión DENEGADA) y el expediente queda RECHAZADO.
      await this.registro.de(tipo).alRechazar(tx, expediente, usuario);
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.RECHAZADO, usuario, true);
    });
  }
}
