import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { normalizarValor } from '../../../catalogos/suministro/arbol-suministro.js';
import { SuministroCatalogoService } from '../../../catalogos/suministro/suministro-catalogo.service.js';
import { Condicion } from '../../../concesiones/entities/condicion.entity.js';
import { Inmueble } from '../../../concesiones/entities/inmueble.entity.js';
import { Suministro } from '../../../concesiones/entities/suministro.entity.js';
import { Etapa } from '../../../expedientes/expedientes.constantes.js';
import { AltaConcesionService, type AltaEditable } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { SuministroDto } from '../dto/suministro.dto.js';
import { exigirSinCambios, exigirSoloCompletar } from '../validaciones/cierre.validaciones.js';

/** Texto opcional normalizado como el catálogo (mayúsculas, sin espacios de más), o null. */
const valor = (v: string | null | undefined) => (v?.trim() ? normalizarValor(v) : null);

/**
 * Paso 6 del alta: suministro de agua, un camino del árbol del distrito
 *   fuente → sistema de distribución → canal principal → secundario → terciario → cuarto → quinto → desagüe
 * y el caudal asignado, que Catastro puede corregir (si no lo manda, queda la suma de los usos).
 *
 * Todo lo que se elige tiene que salir del árbol de suministro del distrito de la concesión
 * (paso 3); un nivel que la rama no tiene queda vacío. Si el distrito no tiene árbol cargado,
 * solo se cargan la observación y el caudal.
 */

@Injectable()
export class SuministroAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly catalogo: SuministroCatalogoService,
  ) {}

  /**
   * Con `motivo`: corrección de un error material por fuera del circuito (queda en el historial con
   * el antes y el después). El caudal asignado no se corrige: es lo que otorgó la resolución.
   */
  async guardar(expedienteId: string, datos: SuministroDto, usuarioId: string, motivo?: string): Promise<RespuestaAlta> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId, !!motivo);
      const antes = motivo ? await this.alta.instantanea(tx, expedienteId, 'suministro') : null;

      //2.- Se valida contra el árbol de suministro del distrito de la concesión.
      const inmueble = await tx.findOne(Inmueble, {
        where: { concesion: { id: editable.concesion.id }, vigente: true },
        relations: { distrito: true },
      });
      await this.catalogo.exigirValido(tx, inmueble, datos);

      //3.- Lo que se guarda, con los nombres tal como están en el árbol. La primera fuente es la principal.
      const [fuentePrincipal = null, ...fuentesAdicionales] = datos.fuentes.map(normalizarValor);
      const suministro = {
        fuentePrincipal,
        fuentesAdicionales,
        sistemaDistribucion: valor(datos.sistemaDistribucion),
        canalPrincipal: valor(datos.canalPrincipal),
        canalSecundario: valor(datos.canalSecundario),
        canalTerciario: valor(datos.canalTerciario),
        canalCuarto: valor(datos.canalCuarto),
        canalQuinto: valor(datos.canalQuinto),
        desague: valor(datos.desague),
        observacion: datos.observacion ?? null,
      };

      //4.- En el cierre solo se completa: lo que ya tenía valor y el caudal quedaron aprobados.
      if (editable.expediente.etapa === Etapa.CIERRE && !editable.correccion) await this.exigirSoloCompletar(tx, editable, suministro, datos.caudalAsignado);

      //4.1.- En una corrección el caudal no cambia (modificarlo es una ampliación o reducción).
      if (editable.correccion && datos.caudalAsignado !== undefined) {
        const condicion = await tx.findOneBy(Condicion, { concesion: { id: editable.concesion.id }, vigente: true });
        if (Number(condicion?.caudalLps ?? 0) !== datos.caudalAsignado) {
          throw new ConflictException('En una corrección no se modifica el caudal asignado: es lo que otorgó la resolución. Cambiarlo corresponde a un trámite de ampliación o reducción.');
        }
      }

      //5.- Se guarda el suministro vigente.
      await this.alta.guardarEnVigente(tx, Suministro, editable, suministro);

      //6.- Caudal asignado: si Catastro lo corrige, se guarda en las condiciones del derecho.
      if (datos.caudalAsignado !== undefined) {
        await this.alta.guardarEnVigente(tx, Condicion, editable, { caudalLps: String(datos.caudalAsignado) });
      }
      await this.alta.marcarModificado(tx, editable);

      //7.- Corrección: el motivo y el antes / después, en el historial y la auditoría.
      if (motivo && antes) await this.alta.registrarCorreccion(tx, editable, 'suministro', antes, motivo);
    });

    //8.- Se devuelve el alta actualizada.
    return this.alta.obtener(expedienteId);
  }

  /** Cierre: cada campo del suministro solo se completa si estaba vacío; el caudal no cambia. */
  private async exigirSoloCompletar(tx: EntityManager, { concesion }: AltaEditable, nuevo: Partial<Suministro>, caudal: number | undefined): Promise<void> {
    const actual = await tx.findOneBy(Suministro, { concesion: { id: concesion.id }, vigente: true });
    exigirSoloCompletar('el suministro', [
      { nombre: 'fuentes', actual: actual && [actual.fuentePrincipal, ...actual.fuentesAdicionales].filter(Boolean), nuevo: [nuevo.fuentePrincipal, ...(nuevo.fuentesAdicionales ?? [])].filter(Boolean) },
      { nombre: 'sistema de distribución', actual: actual?.sistemaDistribucion, nuevo: nuevo.sistemaDistribucion },
      { nombre: 'canal principal', actual: actual?.canalPrincipal, nuevo: nuevo.canalPrincipal },
      { nombre: 'canal secundario', actual: actual?.canalSecundario, nuevo: nuevo.canalSecundario },
      { nombre: 'canal terciario', actual: actual?.canalTerciario, nuevo: nuevo.canalTerciario },
      { nombre: 'canal cuarto', actual: actual?.canalCuarto, nuevo: nuevo.canalCuarto },
      { nombre: 'canal quinto', actual: actual?.canalQuinto, nuevo: nuevo.canalQuinto },
      { nombre: 'desagüe', actual: actual?.desague, nuevo: nuevo.desague },
      { nombre: 'observación', actual: actual?.observacion, nuevo: nuevo.observacion },
    ]);
    if (caudal !== undefined) {
      const condicion = await tx.findOneBy(Condicion, { concesion: { id: concesion.id }, vigente: true });
      exigirSinCambios('el caudal asignado', [{ nombre: 'caudal', actual: condicion?.caudalLps, nuevo: caudal }]);
    }
  }
}
