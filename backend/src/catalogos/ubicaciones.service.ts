import { BadRequestException, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { leerCuencasIniciales, leerUbicacionesIniciales, type CatalogoUbicaciones } from './catalogos.seed.js';
import { Cuenca } from './entities/cuenca.entity.js';
import { Departamento } from './entities/departamento.entity.js';
import { Distrito } from './entities/distrito.entity.js';
import { Localidad } from './entities/localidad.entity.js';
import { SuministroCatalogoService } from './suministro/suministro-catalogo.service.js';

/** Lo que manda el formulario en el domicilio y en la ubicación de la concesión: los nombres. */
export interface NombresUbicacion {
  departamento: string;
  localidad: string;
  distrito: string;
}

/** La misma ubicación ya validada contra el catálogo (para guardar los ids). */
export interface UbicacionValidada {
  departamento: Departamento;
  localidad: Localidad;
  distrito: Distrito;
}

/** Búsqueda en memoria del catálogo: devuelve la fila o null si el nombre no está. */
export interface IndiceUbicaciones {
  departamento(nombre: string | null): Departamento | null;
  localidad(departamento: Departamento | null, nombre: string | null): Localidad | null;
  distrito(codigo: string | null): Distrito | null;
  cuenca(nombre: string | null): Cuenca | null;
}

/** Mismo criterio que el frontend: sin espacios de más y en mayúsculas. */
const normalizar = (texto: string) => texto.trim().toUpperCase();

/** Orden alfabético en español, el mismo que usa el frontend (Intl.Collator('es')). */
const alfabetico = new Intl.Collator('es');

/**
 * Catálogo de ubicación de Tucumán: departamento → localidad → distrito, y cuencas.
 *
 * La API recibe y devuelve los NOMBRES (como hoy el frontend); este service los traduce a
 * las filas del catálogo y avisa con precisión qué nivel no existe.
 */
@Injectable()
export class UbicacionesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UbicacionesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly suministro: SuministroCatalogoService,
  ) {}

  /** Al arrancar la API: carga los catálogos que estén vacíos. */
  async onApplicationBootstrap() {
    //1.- Departamentos, localidades y distritos (van juntos: dependen unos de otros).
    if (!(await this.dataSource.manager.count(Departamento))) {
      await this.dataSource.transaction((tx) => this.cargarUbicaciones(tx, leerUbicacionesIniciales()));
      this.logger.log('Catálogo de departamentos, localidades y distritos cargado.');
    }

    //2.- Cuencas.
    if (!(await this.dataSource.manager.count(Cuenca))) {
      await this.dataSource.manager.save(leerCuencasIniciales().map((nombre) => this.dataSource.manager.create(Cuenca, { nombre })));
      this.logger.log('Catálogo de cuencas cargado.');
    }

    //3.- Catálogo de suministro (fuentes y árbol de canales): necesita las localidades ya cargadas.
    await this.suministro.cargarSiFalta();
  }

  /**
   * Catálogo completo en el formato del frontend: { DEPARTAMENTO: { LOCALIDAD: ['II'] } },
   * ordenado alfabéticamente. Es lo que hoy sirve json-server en /catalogoLocalidades.
   */
  async obtenerCatalogo(): Promise<CatalogoUbicaciones> {
    //1.- Se traen las localidades activas con su departamento y su distrito.
    const localidades = await this.dataSource.manager.find(Localidad, {
      where: { activo: true, departamento: { activo: true }, distrito: { activo: true } },
      relations: { departamento: true, distrito: true },
    });

    //2.- Se ordenan como el frontend (alfabeto español: la Ñ después de la N, sin mirar acentos).
    //    No se usa el ORDER BY de la base porque su intercalación ordena distinto.
    localidades.sort((a, b) => alfabetico.compare(a.departamento.nombre, b.departamento.nombre) || alfabetico.compare(a.nombre, b.nombre));

    //3.- Se arma el árbol departamento → localidad → distritos.
    const catalogo: CatalogoUbicaciones = {};
    for (const localidad of localidades) {
      const departamento = (catalogo[localidad.departamento.nombre] ??= {});
      departamento[localidad.nombre] = [localidad.distrito.codigo];
    }
    return catalogo;
  }

  /**
   * Valida un departamento / localidad / distrito contra el catálogo y devuelve las filas.
   * 400 con el nivel que falla: departamento inexistente, localidad que no es de ese
   * departamento, o distrito que no corresponde a esa localidad.
   */
  async exigirUbicacion(nombres: NombresUbicacion, tx: EntityManager = this.dataSource.manager): Promise<UbicacionValidada> {
    //1.- El departamento tiene que existir.
    const departamento = await tx.findOneBy(Departamento, { nombre: normalizar(nombres.departamento), activo: true });
    if (!departamento) throw new BadRequestException(`El departamento «${nombres.departamento}» no existe.`);

    //2.- La localidad tiene que ser de ese departamento.
    const localidad = await tx.findOne(Localidad, {
      where: { departamento: { id: departamento.id }, nombre: normalizar(nombres.localidad), activo: true },
      relations: { distrito: true },
    });
    if (!localidad) throw new BadRequestException(`La localidad «${nombres.localidad}» no pertenece al departamento ${departamento.nombre}.`);

    //3.- El distrito tiene que ser el de esa localidad.
    if (localidad.distrito.codigo !== normalizar(nombres.distrito)) {
      throw new BadRequestException(`La localidad ${localidad.nombre} pertenece al distrito ${localidad.distrito.codigo}, no al «${nombres.distrito}».`);
    }
    return { departamento, localidad, distrito: localidad.distrito };
  }

  /**
   * El catálogo entero en memoria, para traducir muchos nombres sin una consulta por fila
   * (lo usa el importador del padrón). A diferencia de exigirUbicacion, no rechaza: el
   * padrón anterior trae localidades que no están en el catálogo, y esas quedan sin localidad.
   */
  async cargarIndice(): Promise<IndiceUbicaciones> {
    const [departamentos, localidades, distritos, cuencas] = [
      await this.dataSource.manager.find(Departamento),
      await this.dataSource.manager.find(Localidad, { relations: { departamento: true, distrito: true } }),
      await this.dataSource.manager.find(Distrito),
      await this.dataSource.manager.find(Cuenca),
    ];
    const porDepartamento = (departamento: string, localidad: string) => `${departamento}|${localidad}`;
    const mapaDepartamentos = new Map(departamentos.map((d) => [d.nombre, d]));
    const mapaLocalidades = new Map(localidades.map((l) => [porDepartamento(l.departamento.nombre, l.nombre), l]));
    const mapaDistritos = new Map(distritos.map((d) => [d.codigo, d]));
    const mapaCuencas = new Map(cuencas.map((c) => [c.nombre, c]));

    return {
      departamento: (nombre) => (nombre ? (mapaDepartamentos.get(normalizar(nombre)) ?? null) : null),
      localidad: (departamento, nombre) => (departamento && nombre ? (mapaLocalidades.get(porDepartamento(departamento.nombre, normalizar(nombre))) ?? null) : null),
      distrito: (codigo) => (codigo ? (mapaDistritos.get(normalizar(codigo)) ?? null) : null),
      cuenca: (nombre) => (nombre ? (mapaCuencas.get(normalizar(nombre)) ?? null) : null),
    };
  }

  /** Inserta el catálogo inicial: primero los distritos, después cada departamento con sus localidades. */
  private async cargarUbicaciones(tx: EntityManager, catalogo: CatalogoUbicaciones) {
    //1.- Distritos: los códigos que aparecen en el archivo (I a VII).
    const codigos = [...new Set(Object.values(catalogo).flatMap((localidades) => Object.values(localidades).flat()))].sort();
    const distritos = new Map<string, Distrito>();
    for (const codigo of codigos) distritos.set(codigo, await tx.save(tx.create(Distrito, { codigo, nombre: `Distrito ${codigo}` })));

    //2.- Cada departamento con sus localidades (cada localidad con su único distrito).
    for (const [nombreDepartamento, localidades] of Object.entries(catalogo)) {
      const departamento = await tx.save(tx.create(Departamento, { nombre: nombreDepartamento }));
      await tx.save(
        Object.entries(localidades).map(([nombre, [codigoDistrito]]) =>
          tx.create(Localidad, { departamento, nombre, distrito: distritos.get(codigoDistrito)! }),
        ),
        { chunk: 200 },
      );
    }
  }
}
