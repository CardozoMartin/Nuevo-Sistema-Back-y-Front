import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, Not, type EntityManager } from 'typeorm';
import { UbicacionesService, type UbicacionValidada } from '../../../catalogos/ubicaciones.service.js';
import { OrigenPoligono, PublicacionMapa } from '../../../concesiones/concesiones.constantes.js';
import { poligonoDuplicado } from '../../../concesiones/duplicados.js';
import { Concesion } from '../../../concesiones/entities/concesion.entity.js';
import { Inmueble } from '../../../concesiones/entities/inmueble.entity.js';
import { PoligonosService } from '../../../concesiones/poligonos.service.js';
import { Etapa } from '../../../expedientes/expedientes.constantes.js';
import type { CambioCorregido } from '../../../expedientes/expedientes.service.js';
import { ArchivosService } from '../../../sig/archivos.service.js';
import { avisoLejosDelCauce, GeometriaService } from '../../../sig/geometria.service.js';
import { exigirKml, extensionDe, leerArchivoGeografico, type ArchivoSubido } from '../../../sig/kml/archivo-kml.js';
import type { KmlLeido } from '../../../sig/kml/leer-kml.js';
import { AltaConcesionService, type AltaEditable } from '../alta-concesion.service.js';
import type { RespuestaAlta } from '../alta-concesion.respuesta.js';
import type { UbicacionDto } from '../dto/ubicacion.dto.js';
import { exigirSinCambios } from '../validaciones/cierre.validaciones.js';

/**
 * Paso 3 del alta: ubicación de la concesión.
 *
 * - Departamento, localidad y distrito: obligatorios, del catálogo.
 * - El archivo con la concesión dibujada (KML o GeoJSON) es OPTATIVO en la carga (decisión D6)
 *   y OBLIGATORIO para la verificación final del cierre. Si viene, PostGIS lo valida, lo mide
 *   y controla que no sea una concesión duplicada.
 * - Sistema de coordenadas: POSGAR 2007 faja 3 o latitud/longitud (se reconocen solos); un
 *   GeoJSON que declara otro sistema (ej: Campo Inchauspe) se transforma desde ese sistema.
 * - En el cierre (después de la resolución) la ubicación no cambia y el polígono solo se
 *   puede cargar si todavía no estaba.
 *
 * Llega como multipart/form-data: «archivo» + los campos de texto.
 */
@Injectable()
export class UbicacionAltaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alta: AltaConcesionService,
    private readonly ubicaciones: UbicacionesService,
    private readonly geometria: GeometriaService,
    private readonly poligonos: PoligonosService,
    private readonly archivos: ArchivosService,
  ) {}

  /** Devuelve el alta y los avisos de la lectura del archivo (sistema, elementos ignorados, río lejano…). */
  /**
   * Con `motivo`: corrección de un error material por fuera del circuito (la ubicación y/o el
   * polígono; ver corregirPoligono). Queda en el historial con el antes y el después.
   */
  async guardar(expedienteId: string, datos: UbicacionDto, usuarioId: string, archivo?: ArchivoSubido, motivo?: string): Promise<RespuestaAlta & { avisos: string[] }> {
    //1.- Si viene archivo, se valida que sea KML/GeoJSON y se lee (antes de abrir la
    //    transacción: es trabajo de CPU que no necesita la base).
    const subido = archivo ? exigirKml(archivo) : undefined;
    const leido = subido ? leerArchivoGeografico(subido) : undefined;

    await this.dataSource.transaction(async (tx) => {
      //2.- Se valida que Catastro pueda editar: etapa editable y expediente tomado por quien guarda.
      const editable = await this.alta.exigirEditable(tx, expedienteId, usuarioId, !!motivo);
      const antes = motivo ? await this.alta.instantanea(tx, expedienteId, 'ubicacion') : null;

      //3.- Se valida la ubicación contra el catálogo (departamento → localidad → distrito).
      const ubicacion = await this.ubicaciones.exigirUbicacion(datos, tx);

      //4.- En el cierre solo se completa: la ubicación aprobada no cambia y el polígono, si ya estaba, tampoco.
      if (editable.expediente.etapa === Etapa.CIERRE && !editable.correccion) await this.exigirSoloCompletar(tx, editable, ubicacion, !!subido);

      //5.- Si vino el polígono, se valida, se guarda y se controla que no esté duplicado.
      //    En una corrección no se pisa: queda el anterior en el histórico (o propuesto, si estaba publicado).
      let cambioPoligono: CambioCorregido | null = null;
      if (subido && leido) {
        if (editable.correccion) cambioPoligono = await this.corregirPoligono(tx, editable, subido, leido);
        else await this.guardarPoligono(tx, editable, subido, leido);
      }

      //6.- Se guarda la ubicación en el inmueble vigente (se crea si todavía no existe).
      await this.alta.guardarEnVigente(tx, Inmueble, editable, ubicacion);
      await this.alta.marcarModificado(tx, editable);

      //7.- Corrección: el motivo y el antes / después, en el historial y la auditoría.
      if (motivo && antes) await this.alta.registrarCorreccion(tx, editable, 'ubicacion', antes, motivo, cambioPoligono ? [cambioPoligono] : []);
    });

    //8.- Se devuelve el alta actualizada con los avisos del archivo.
    return { ...(await this.alta.obtener(expedienteId)), avisos: leido?.avisos ?? [] };
  }

  /** Cierre: la ubicación tiene que ser la misma y el polígono se carga solo si faltaba. */
  private async exigirSoloCompletar(tx: EntityManager, { concesion }: AltaEditable, nueva: UbicacionValidada, vinoPoligono: boolean): Promise<void> {
    //1.- La ubicación aprobada (si ya estaba cargada) no cambia.
    const actual = await tx.findOne(Inmueble, { where: { concesion: { id: concesion.id }, vigente: true }, relations: { departamento: true, localidad: true, distrito: true } });
    if (actual?.departamento) {
      exigirSinCambios('la ubicación de la concesión', [
        { nombre: 'departamento', actual: actual.departamento.id, nuevo: nueva.departamento.id },
        { nombre: 'localidad', actual: actual.localidad?.id, nuevo: nueva.localidad.id },
        { nombre: 'distrito', actual: actual.distrito?.id, nuevo: nueva.distrito.id },
      ]);
    }

    //2.- El polígono aprobado no se reemplaza (si faltaba, se puede cargar ahora).
    if (vinoPoligono && (await this.poligonos.vigente(tx, concesion.id))) {
      throw new ConflictException('En el cierre no se puede reemplazar el polígono: quedó aprobado en la resolución. Si está mal, corresponde un trámite de reubicación o de modificación de superficie.');
    }
  }

  /** Polígono: coordenadas → PostGIS (validar y medir) → archivo original → con_poligono → duplicados. */
  private async guardarPoligono(tx: EntityManager, { expediente, concesion, usuario }: AltaEditable, archivo: ArchivoSubido, leido: KmlLeido): Promise<void> {
    //1-4.- Coordenadas, medición, avisos y archivo original.
    const { sistemaOrigen, guardado } = await this.prepararPoligono(tx, concesion, archivo, leido);

    //5.- Mientras no está otorgada, el polígono es un borrador: reemplaza al anterior.
    await this.poligonos.borrarBorrador(tx, concesion.id);
    await this.poligonos.insertar(tx, {
      concesionId: concesion.id,
      expedienteId: expediente.id,
      origen: OrigenPoligono.ALTA,
      geometria: leido.geometria,
      archivo: { nombre: archivo.originalname, ...guardado },
      sistemaOrigen,
      usuarioId: usuario.id,
    });

    //6.- Concesión duplicada: si el polígono coincide casi entero con otra concesión activa,
    //    se rechaza (se deshace todo). Las superposiciones parciales solo se informan.
    const duplicado = await poligonoDuplicado(tx, concesion.id);
    if (duplicado) throw new ConflictException(duplicado);

    //7.- Si los puntos de desagüe / entrega (paso 5) ya estaban, se avisa si quedan lejos del polígono.
    leido.avisos.push(...(await this.geometria.avisosPuntosLejanos(concesion.id, tx)));
  }

  /**
   * Corrección del polígono (KML mal cargado), con el anterior conservado:
   *   - si el vigente está PUBLICADO en Argenmap, el corregido entra PROPUESTO: afuera se sigue viendo
   *     el publicado hasta que quien publica en el mapa apruebe el nuevo (y recién ahí se reemplaza);
   *   - si todavía no se publicó, el corregido pasa a ser el vigente (pendiente de publicar) y el
   *     anterior queda en el histórico.
   * Devuelve el cambio para el historial.
   */
  private async corregirPoligono(tx: EntityManager, { expediente, concesion, usuario }: AltaEditable, archivo: ArchivoSubido, leido: KmlLeido): Promise<CambioCorregido> {
    //1-4.- Coordenadas, medición, avisos y archivo original.
    const { sistemaOrigen, guardado, superficieHa } = await this.prepararPoligono(tx, concesion, archivo, leido);
    const anterior = await this.poligonos.vigente(tx, concesion.id);
    const estado = await this.poligonos.estadoVigente(tx, concesion.id);
    const publicado = estado?.publicacion === PublicacionMapa.PUBLICADO;

    //5.- Una corrección anterior que todavía esperaba aprobación queda reemplazada por esta.
    await this.poligonos.descartarPropuesto(tx, concesion.id);
    if (!publicado) await this.poligonos.cerrarVigente(tx, concesion.id);

    //6.- El corregido: propuesto (si el anterior está publicado) o vigente. Rige desde la misma fecha.
    const id = await this.poligonos.insertar(tx, {
      concesionId: concesion.id,
      expedienteId: expediente.id,
      origen: OrigenPoligono.ALTA,
      geometria: leido.geometria,
      archivo: { nombre: archivo.originalname, ...guardado },
      sistemaOrigen,
      desde: estado?.desde ?? null,
      propuesto: publicado,
      usuarioId: usuario.id,
    });

    //7.- Concesión duplicada: se rechaza como en la carga.
    const duplicado = await poligonoDuplicado(tx, concesion.id, id);
    if (duplicado) throw new ConflictException(duplicado);
    if (publicado) leido.avisos.push('El polígono publicado sigue en el mapa público hasta que quien publica en el mapa apruebe el corregido (Catastro → Publicación en el mapa).');
    else leido.avisos.push(...(await this.geometria.avisosPuntosLejanos(concesion.id, tx)));

    const ha = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`;
    return {
      campo: 'Polígono',
      antes: anterior ? `${anterior.archivo?.nombre ?? 'sin archivo'} (${ha(anterior.superficieHa)})` : null,
      despues: `${archivo.originalname} (${ha(superficieHa)})${publicado ? ' · pendiente de aprobación para el mapa público' : ''}`,
    };
  }

  /** Lo común de cargar un polígono: coordenadas → WGS84 validadas, medición, avisos y archivo original guardado. */
  private async prepararPoligono(tx: EntityManager, concesion: Concesion, archivo: ArchivoSubido, leido: KmlLeido) {
    //1.- Coordenadas: el sistema que declara el archivo, o POSGAR 2007 faja 3 / lat-long
    //    reconocidos por los números → WGS84. PostGIS valida el polígono (400 si es inválido
    //    o cae fuera de Tucumán).
    const normalizada = await this.geometria.normalizar(leido.geometria, tx, leido.sridDeclarado);
    leido.geometria = normalizada.geometria;
    leido.avisos.unshift(`Coordenadas en ${normalizada.sistemaOrigenNombre}.`, ...normalizada.avisos);

    //2.- Se mide y se avisa si queda lejos de los ríos y canales.
    const analisis = await this.geometria.analizar(leido.geometria, concesion.id, tx);
    const lejos = avisoLejosDelCauce(analisis);
    if (lejos) leido.avisos.push(lejos);

    //3.- Si el archivo dice de qué concesión es (capas de la DRH), se compara.
    leido.avisos.push(...(await this.avisosNumeroDelArchivo(tx, concesion, leido.numerosConcesion ?? [])));

    //4.- Se guarda el archivo original (respaldo de lo que presentó el titular).
    const guardado = await this.archivos.guardar('kml', archivo.buffer, extensionDe(archivo));
    return { sistemaOrigen: normalizada.sistemaOrigen, guardado, superficieHa: analisis.superficieHa };
  }

  /**
   * Las capas de la DRH traen el número de concesión en cada polígono (propiedad «concesion»).
   * Si no coincide con esta concesión, o es el de otra ya registrada, se avisa (no se rechaza:
   * puede ser una capa de referencia reutilizada).
   */
  private async avisosNumeroDelArchivo(tx: EntityManager, concesion: Concesion, numeros: string[]): Promise<string[]> {
    const avisos: string[] = [];
    for (const numero of numeros) {
      if (concesion.numero) {
        if (numero !== concesion.numero) avisos.push(`El archivo dice ser de la concesión ${numero}, pero esta es la concesión ${concesion.numero}: verifique que sea el polígono correcto.`);
        continue;
      }
      const otra = await tx.findOneBy(Concesion, { numero, id: Not(concesion.id) });
      if (otra) avisos.push(`El archivo dice ser de la concesión ${numero}, que ya está registrada (${otra.estado.toLowerCase()}): verifique que no sea el polígono de otra concesión.`);
    }
    return avisos;
  }
}
