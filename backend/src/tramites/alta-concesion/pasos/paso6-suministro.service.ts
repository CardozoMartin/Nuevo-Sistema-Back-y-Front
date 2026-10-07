import { Injectable } from '@nestjs/common';
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
import { exigirCascadaEnOrden } from '../validaciones/suministro.validaciones.js';

/** Texto opcional normalizado como el catálogo (mayúsculas, sin espacios de más), o null. */
const valor = (v: string | null | undefined) => (v?.trim() ? normalizarValor(v) : null);

/**
 * Paso 6 del alta: suministro de agua, en cascada
 *   fuente → sistema de distribución → canal principal → secundario → terciario → cuarto → quinto
 * y el caudal asignado, que Catastro puede corregir (si no lo manda, queda la suma de los usos).
 *
 * Todo lo que se elige tiene que estar en el catálogo de suministro de la DRH para la ubicación
 * de la concesión (paso 3), y los canales tienen que ser un camino de su árbol. Si la ubicación
 * no tiene catálogo, solo se cargan la observación y el caudal.
 */
@Injectable()
export class SuministroAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly catalogo: SuministroCatalogoService,
  ) {}

  async guardar(expedienteId: string, datos: SuministroDto, usuarioId: string): Promise<RespuestaAlta> {
    //1.- Se valida que la cascada esté completa en orden (no hay secundario sin principal…).
    exigirCascadaEnOrden(datos);

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId);

      //3.- Se valida contra el catálogo de suministro de la ubicación de la concesión.
      const inmueble = await tx.findOne(Inmueble, {
        where: { concesion: { id: editable.concesion.id }, vigente: true },
        relations: { departamento: true, localidad: true, distrito: true },
      });
      await this.catalogo.exigirValido(tx, inmueble, datos);

      //4.- Lo que se guarda, con los nombres tal como están en el catálogo. La primera fuente es
      //    la principal y los canales después del secundario son el terciario, el cuarto y el quinto.
      const [fuentePrincipal = null, ...fuentesAdicionales] = datos.fuentes.map(normalizarValor);
      const [canalTerciario, canalCuarto, canalQuinto] = (datos.canalesAdicionales ?? []).map(normalizarValor);
      const suministro = {
        fuentePrincipal,
        fuentesAdicionales,
        sistemaDistribucion: valor(datos.sistemaDistribucion),
        canalPrincipal: valor(datos.canalPrincipal),
        canalSecundario: valor(datos.canalSecundario),
        canalTerciario: canalTerciario ?? null,
        canalCuarto: canalCuarto ?? null,
        canalQuinto: canalQuinto ?? null,
        desague: valor(datos.desague),
        observacion: datos.observacion ?? null,
      };

      //5.- En el cierre solo se completa: lo que ya tenía valor y el caudal quedaron aprobados.
      if (editable.expediente.etapa === Etapa.CIERRE) await this.exigirSoloCompletar(tx, editable, suministro, datos.caudalAsignado);

      //6.- Se guarda el suministro vigente.
      await this.alta.guardarEnVigente(tx, Suministro, editable, suministro);

      //7.- Caudal asignado: si Catastro lo corrige, se guarda en las condiciones del derecho.
      if (datos.caudalAsignado !== undefined) {
        await this.alta.guardarEnVigente(tx, Condicion, editable, { caudalLps: String(datos.caudalAsignado) });
      }
      await this.alta.marcarModificado(tx, editable);
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
