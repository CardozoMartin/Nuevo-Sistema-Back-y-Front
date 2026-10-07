import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UbicacionesService, type UbicacionValidada } from '../../../catalogos/ubicaciones.service.js';
import { Domicilio } from '../../../concesiones/entities/domicilio.entity.js';
import { Titular } from '../../../concesiones/entities/titular.entity.js';
import { Expediente } from '../../../expedientes/entities/expediente.entity.js';
import { nombrePersona } from '../../../personas/entities/persona.entity.js';
import { PersonasService } from '../../../personas/personas.service.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { GuardarTitularesDto } from '../dto/guardar-titulares.dto.js';
import { exigirDocumentosSinRepetir } from '../validaciones/titulares.validaciones.js';

/**
 * Paso 2 del alta: titulares y domicilios legales.
 *
 * - Cada titular es una PERSONA única por documento (per_persona): la misma persona puede
 *   ser titular única de una concesión y cotitular de otra.
 * - Los domicilios son los domicilios legales del titular (no la ubicación de la concesión).
 * - Se manda siempre la lista completa: reemplaza lo cargado antes en este expediente.
 */
@Injectable()
export class TitularesAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly personas: PersonasService,
    private readonly ubicaciones: UbicacionesService,
  ) {}

  async guardar(expedienteId: string, datos: GuardarTitularesDto, usuarioId: string): Promise<RespuestaAlta> {
    //1.- Se valida que un mismo documento no figure dos veces como titular.
    exigirDocumentosSinRepetir(datos.titulares);

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const { expediente, concesion, usuario } = await this.alta.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Se valida cada domicilio contra el catálogo (departamento → localidad → distrito).
      const ubicaciones: UbicacionValidada[] = [];
      for (const domicilio of datos.domicilios) ubicaciones.push(await this.ubicaciones.exigirUbicacion(domicilio, tx));

      //4.- Cada titular se busca por documento: si ya existe se reutiliza (y se actualizan sus
      //    datos), si no, se crea. Para precargar el formulario: GET /api/personas?documento=…
      const personas = [];
      for (const titular of datos.titulares) personas.push(await this.personas.guardar(tx, titular, usuario.id));

      //5.- Mientras el alta no está otorgada, lo cargado es una propuesta de este expediente:
      //    se reemplazan los titulares y domicilios vigentes por los nuevos.
      const deLaConcesion = { concesion: { id: concesion.id }, vigente: true };
      await tx.delete(Titular, deLaConcesion);
      await tx.delete(Domicilio, deLaConcesion);

      //6.- Se guardan los titulares (el orden 0 es el principal) con el expediente que los cargó.
      await tx.save(personas.map((persona, orden) => tx.create(Titular, { concesion, persona, orden, expediente, vigente: true })));

      //7.- Se guardan los domicilios con los ids del catálogo.
      await tx.save(
        datos.domicilios.map((d, orden) =>
          tx.create(Domicilio, { concesion, orden, calle: d.calle, numero: d.numero ?? null, ...ubicaciones[orden], expediente, vigente: true }),
        ),
      );

      //8.- El titular principal pasa a ser el «solicitante» del expediente (bandejas y búsquedas).
      await tx.update(Expediente, expediente.id, {
        solicitanteNombre: nombrePersona(personas[0]),
        solicitanteDocumento: personas[0].documento,
        modificadoUsuarioId: usuario.id,
      });
    });

    //9.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }
}
