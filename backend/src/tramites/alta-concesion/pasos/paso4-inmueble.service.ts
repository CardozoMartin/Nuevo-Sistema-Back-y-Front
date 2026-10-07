import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { matriculaEnUso } from '../../../concesiones/duplicados.js';
import { Inmueble } from '../../../concesiones/entities/inmueble.entity.js';
import { Etapa } from '../../../expedientes/expedientes.constantes.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { DatosInmuebleDto } from '../dto/datos-inmueble.dto.js';
import { exigirSoloCompletar } from '../validaciones/cierre.validaciones.js';
import { exigirAnioDominioNoFuturo } from '../validaciones/inmueble.validaciones.js';

/**
 * Paso 4 del alta: la parcela. Junta las pestañas «Catastral» (padrón, matrícula,
 * circunscripción, sección, parcela, lámina, orden) y «Registral» (libro, folio, año,
 * matrícula, serie). Se guarda en el mismo inmueble vigente que la ubicación del paso 3.
 *
 * El padrón no se carga acá: lo informa Rentas al final del trámite.
 * En el cierre solo se completan los campos vacíos (la matrícula y la parcela quedaron aprobadas).
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

      //3.- En el cierre solo se completa lo que falta.
      if (editable.expediente.etapa === Etapa.CIERRE) {
        const actual = await tx.findOneBy(Inmueble, { concesion: { id: editable.concesion.id }, vigente: true });
        exigirSoloCompletar('el inmueble', [
          { nombre: 'matrícula catastral', actual: actual?.matriculaCatastral, nuevo: catastral.matricula },
          { nombre: 'circunscripción', actual: actual?.circunscripcion, nuevo: catastral.circunscripcion },
          { nombre: 'sección', actual: actual?.seccion, nuevo: catastral.seccion },
          { nombre: 'parcela', actual: actual?.parcela, nuevo: catastral.parcela },
          { nombre: 'lámina', actual: actual?.lamina, nuevo: catastral.lamina },
          { nombre: 'orden', actual: actual?.orden, nuevo: catastral.orden },
          { nombre: 'libro', actual: actual?.libro, nuevo: registral.libro },
          { nombre: 'folio', actual: actual?.folio, nuevo: registral.folio },
          { nombre: 'año de dominio', actual: actual?.anioDominio, nuevo: registral.anio },
          { nombre: 'matrícula de dominio', actual: actual?.matriculaDominio, nuevo: registral.matricula },
          { nombre: 'serie', actual: actual?.serie, nuevo: registral.serie },
        ]);
      }

      //4.- Concesión duplicada: la matrícula catastral no puede tener otra concesión activa.
      const enUso = await matriculaEnUso(tx, catastral.matricula, editable.concesion.id);
      if (enUso) throw new ConflictException(enUso);

      //5.- Se guardan los datos en el inmueble vigente (se crea si el paso 3 todavía no lo hizo).
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

    //6.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }
}
