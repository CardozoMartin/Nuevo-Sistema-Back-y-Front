import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogosService } from '../../../catalogos/catalogos.service.js';
import { DocumentoRequerido } from '../../../catalogos/entities/documento-requerido.entity.js';
import { EstadoConcesion, TipoDerecho } from '../../../concesiones/concesiones.constantes.js';
import { Concesion } from '../../../concesiones/entities/concesion.entity.js';
import { DocumentacionPresentada } from '../../../expedientes/entities/documentacion-presentada.entity.js';
import { Oficina, TipoTramite } from '../../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../../expedientes/expedientes.service.js';
import { UsuariosService } from '../../../seguridad/usuarios.service.js';
import { AltaConcesionService } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { IniciarAltaDto } from '../dto/iniciar-alta.dto.js';
import { exigirAnioEnCurso, exigirDocumentosDeLaSituacion } from '../validaciones/inicio.validaciones.js';

/**
 * Paso 1 del alta: Catastro registra el expediente en papel y comienza el trámite.
 *
 * Datos: número / repartición / año del expediente, situación legal del solicitante
 * (titular de dominio, poseedor o tenedor: una por expediente) y el checklist de los
 * papeles que trae.
 */
@Injectable()
export class InicioAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly expedientes: ExpedientesService,
    private readonly usuarios: UsuariosService,
    private readonly catalogos: CatalogosService,
  ) {}

  async iniciar(datos: IniciarAltaDto, usuarioId: string): Promise<RespuestaAlta> {
    const { numero, reparticion, anio } = datos.expediente;

    //1.- Comienza el trámite: lo registra un usuario de Catastro.
    const usuario = await this.usuarios.exigirDeOficina(usuarioId, Oficina.CATASTRO);

    //2.- Se valida que el expediente sea del año en curso.
    exigirAnioEnCurso(anio);

    //3.- Se valida que la situación legal exista: de ella sale el checklist de documentación.
    const situacion = await this.catalogos.obtenerSituacionLegal(datos.situacionLegal).catch(() => {
      throw new BadRequestException(`La situación legal ${datos.situacionLegal} no existe.`);
    });

    //4.- Se valida que los papeles marcados sean del checklist de ESA situación legal.
    exigirDocumentosDeLaSituacion(situacion, datos.documentacionPresentada);

    //5.- Se crea todo junto en una transacción: si algo falla no queda un expediente a medias.
    const expedienteId = await this.dataSource.transaction(async (tx) => {
      //5.1.- El expediente (409 si el número ya existe) con su movimiento de apertura en Catastro.
      const expediente = await this.expedientes.abrir(tx, { numero, reparticion, anio, tipoTramite: TipoTramite.ALTA_CONCESION, asunto: 'Alta de concesión', usuario });

      //5.2.- La concesión nace EN_TRAMITE y sin número; los pasos 2 a 6 le van cargando los datos.
      await tx.save(
        tx.create(Concesion, {
          expediente,
          tipoDerecho: TipoDerecho.CONCESION,
          estado: EstadoConcesion.EN_TRAMITE,
          situacionLegal: situacion,
          creadoUsuarioId: usuario.id,
        }),
      );

      //5.3.- El checklist: una fila por papel presentado.
      await tx.save(datos.documentacionPresentada.map((id) => tx.create(DocumentacionPresentada, { expediente, documento: { id } as DocumentoRequerido })));
      return expediente.id;
    });

    //6.- Se devuelve el alta recién creada.
    return this.alta.obtener(expedienteId);
  }
}
