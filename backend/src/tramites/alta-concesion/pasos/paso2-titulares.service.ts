import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { UbicacionesService, type UbicacionValidada } from '../../../catalogos/ubicaciones.service.js';
import { Domicilio } from '../../../concesiones/entities/domicilio.entity.js';
import { Titular } from '../../../concesiones/entities/titular.entity.js';
import { Expediente } from '../../../expedientes/entities/expediente.entity.js';
import { Etapa } from '../../../expedientes/expedientes.constantes.js';
import { nombrePersona } from '../../../personas/entities/persona.entity.js';
import { PersonasService } from '../../../personas/personas.service.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { GuardarTitularesDto } from '../dto/guardar-titulares.dto.js';
import type { Concesion } from '../../../concesiones/entities/concesion.entity.js';
import { exigirSinCambios, exigirSoloCompletar, type CampoCierre } from '../validaciones/cierre.validaciones.js';
import { exigirDocumentosSinRepetir } from '../validaciones/titulares.validaciones.js';

/**
 * Paso 2 del alta: titulares y domicilios legales.
 *
 * - Cada titular es una PERSONA única por documento (per_persona): la misma persona puede
 *   ser titular única de una concesión y cotitular de otra.
 * - Los domicilios son los domicilios legales del titular (no la ubicación de la concesión).
 * - Se manda siempre la lista completa: reemplaza lo cargado antes en este expediente.
 * - En el cierre (después de la resolución) los titulares y los domicilios no cambian; solo se
 *   completan los datos vacíos de cada persona y se pueden actualizar su correo y teléfono.
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

      //3.1.- En el cierre, lo aprobado en la resolución no cambia.
      if (expediente.etapa === Etapa.CIERRE) await this.exigirSoloCompletar(tx, concesion, datos, ubicaciones);

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

  /**
   * Cierre: mismos titulares (mismos documentos, en el mismo orden) y mismos domicilios. De cada
   * persona solo se completa lo vacío; correo y teléfono son de contacto y se pueden actualizar.
   */
  private async exigirSoloCompletar(tx: EntityManager, concesion: Concesion, datos: GuardarTitularesDto, ubicaciones: UbicacionValidada[]): Promise<void> {
    const vigentes = { concesion: { id: concesion.id }, vigente: true };
    const titulares = await tx.find(Titular, { where: vigentes, order: { orden: 'ASC' } });
    const domicilios = await tx.find(Domicilio, { where: vigentes, order: { orden: 'ASC' }, relations: { departamento: true, localidad: true, distrito: true } });

    //1.- Los mismos titulares, en el mismo orden (el primero es el principal).
    exigirSinCambios('los titulares', [{ nombre: 'documentos', actual: titulares.map((t) => t.persona.documento), nuevo: datos.titulares.map((t) => t.documento) }]);

    //2.- De cada persona, solo se completa lo que falta.
    titulares.forEach(({ persona }, i) => {
      const nuevo = datos.titulares[i];
      const campos: CampoCierre[] = [
        { nombre: 'tipo de persona', actual: persona.tipoPersona, nuevo: nuevo.tipoPersona },
        { nombre: 'apellido', actual: persona.apellido, nuevo: nuevo.apellido },
        { nombre: 'nombre', actual: persona.nombre, nuevo: nuevo.nombre },
        { nombre: 'fecha de nacimiento', actual: persona.fechaNacimiento, nuevo: nuevo.fechaNacimiento },
        { nombre: 'razón social', actual: persona.razonSocial, nuevo: nuevo.razonSocial },
        { nombre: 'fecha de constitución', actual: persona.fechaConstitucion, nuevo: nuevo.fechaConstitucion },
      ];
      exigirSoloCompletar(`el titular ${persona.documento}`, campos);
    });

    //3.- Los mismos domicilios legales.
    const comoTexto = (calle: string, numero: string | null | undefined, u: { departamento: { id: number | string }; localidad: { id: number | string } | null; distrito: { id: number | string } | null }) =>
      [calle, numero ?? '', u.departamento.id, u.localidad?.id ?? '', u.distrito?.id ?? ''].join('|');
    exigirSinCambios('los domicilios legales', [
      {
        nombre: 'domicilios',
        actual: domicilios.map((d) => comoTexto(d.calle, d.numero, d)),
        nuevo: datos.domicilios.map((d, i) => comoTexto(d.calle, d.numero, ubicaciones[i])),
      },
    ]);
  }
}
