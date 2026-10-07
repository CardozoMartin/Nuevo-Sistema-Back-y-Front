import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Condicion } from '../../../concesiones/entities/condicion.entity.js';
import { Suministro } from '../../../concesiones/entities/suministro.entity.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { SuministroDto } from '../dto/suministro.dto.js';
import { exigirCascadaEnOrden } from '../validaciones/suministro.validaciones.js';

/**
 * Paso 6 del alta: suministro de agua, en cascada
 *   fuente → sistema de distribución → canal principal → secundario → terciario → cuarto → quinto
 * y el caudal asignado, que Catastro puede corregir (si no lo manda, queda la suma de los usos).
 */
@Injectable()
export class SuministroAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
  ) {}

  async guardar(expedienteId: string, datos: SuministroDto, usuarioId: string): Promise<RespuestaAlta> {
    //1.- Se valida que la cascada esté completa en orden (no hay secundario sin principal…).
    exigirCascadaEnOrden(datos);

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Se guarda el suministro vigente: la primera fuente es la principal y los canales
      //    después del secundario son el terciario, el cuarto y el quinto.
      const [fuentePrincipal, ...fuentesAdicionales] = datos.fuentes;
      const [canalTerciario, canalCuarto, canalQuinto] = datos.canalesAdicionales ?? [];
      await this.alta.guardarEnVigente(tx, Suministro, editable, {
        fuentePrincipal,
        fuentesAdicionales,
        sistemaDistribucion: datos.sistemaDistribucion ?? null,
        canalPrincipal: datos.canalPrincipal ?? null,
        canalSecundario: datos.canalSecundario ?? null,
        canalTerciario: canalTerciario ?? null,
        canalCuarto: canalCuarto ?? null,
        canalQuinto: canalQuinto ?? null,
        desague: datos.desague ?? null,
        observacion: datos.observacion ?? null,
      });

      //4.- Caudal asignado: si Catastro lo corrige, se guarda en las condiciones del derecho.
      if (datos.caudalAsignado !== undefined) {
        await this.alta.guardarEnVigente(tx, Condicion, editable, { caudalLps: String(datos.caudalAsignado) });
      }
      await this.alta.marcarModificado(tx, editable);
    });

    //5.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }
}
