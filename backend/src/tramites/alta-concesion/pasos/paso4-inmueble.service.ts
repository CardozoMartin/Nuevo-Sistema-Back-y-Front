import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { matriculaEnUso } from '../../../concesiones/duplicados.js';
import { Inmueble } from '../../../concesiones/entities/inmueble.entity.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { DatosInmuebleDto } from '../dto/datos-inmueble.dto.js';
import { exigirAnioDominioNoFuturo } from '../validaciones/inmueble.validaciones.js';

/**
 * Paso 4 del alta: la parcela. Junta las pestañas «Catastral» (padrón, matrícula,
 * circunscripción, sección, parcela, lámina, orden) y «Registral» (libro, folio, año,
 * matrícula, serie). Se guarda en el mismo inmueble vigente que la ubicación del paso 3.
 *
 * El padrón no se carga acá: lo informa Rentas al final del trámite.
 */
@Injectable()
export class InmuebleAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
  ) {}

  async guardar(expedienteId: string, datos: DatosInmuebleDto, usuarioId: string): Promise<RespuestaAlta> {
    const { catastral, registral } = datos;

    //1.- Se valida que el año de dominio no sea futuro.
    exigirAnioDominioNoFuturo(registral.anio);

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Concesión duplicada: la matrícula catastral no puede tener otra concesión activa.
      const enUso = await matriculaEnUso(tx, catastral.matricula, editable.concesion.id);
      if (enUso) throw new ConflictException(enUso);

      //4.- Se guardan los datos en el inmueble vigente (se crea si el paso 3 todavía no lo hizo).
      await this.alta.guardarEnVigente(tx, Inmueble, editable, {
        matriculaCatastral: catastral.matricula,
        circunscripcion: catastral.circunscripcion ?? null,
        seccion: catastral.seccion ?? null,
        parcela: catastral.parcela,
        lamina: catastral.lamina ?? null,
        orden: catastral.orden ?? null,
        libro: registral.libro ?? null,
        folio: registral.folio ?? null,
        anioDominio: registral.anio ?? null,
        matriculaDominio: registral.matricula ?? null,
        serie: registral.serie ?? null,
      });
      await this.alta.marcarModificado(tx, editable);
    });

    //5.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }
}
