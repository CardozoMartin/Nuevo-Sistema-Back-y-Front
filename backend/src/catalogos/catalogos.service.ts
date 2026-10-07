import { Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SITUACIONES_LEGALES_INICIALES, TIPOS_USO_INICIALES } from './catalogos.seed.js';
import { SituacionLegal } from './entities/situacion-legal.entity.js';
import { TipoUso } from './entities/tipo-uso.entity.js';

@Injectable()
export class CatalogosService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogosService.name);

  constructor(
    @InjectRepository(SituacionLegal) private readonly situaciones: Repository<SituacionLegal>,
    @InjectRepository(TipoUso) private readonly tiposUso: Repository<TipoUso>,
  ) {}

  /** Al arrancar la API: carga los datos iniciales de cada catálogo que esté vacío. */
  async onApplicationBootstrap() {
    if (!(await this.situaciones.count())) {
      await this.situaciones.save(
        SITUACIONES_LEGALES_INICIALES.map((s, i) =>
          this.situaciones.create({
            ...s,
            orden: i,
            documentos: s.documentos.map((descripcion, j) => ({ descripcion, orden: j })),
          }),
        ),
      );
      this.logger.log('Catálogo de situaciones legales cargado.');
    }

    if (!(await this.tiposUso.count())) {
      await this.tiposUso.save(TIPOS_USO_INICIALES.map((t, i) => this.tiposUso.create({ ...t, dotacion: String(t.dotacion), orden: i })));
      this.logger.log('Catálogo de tipos de uso cargado.');
    }
  }

  // --- Situaciones legales -------------------------------------------------------

  /** Situaciones legales activas con su documentación, en el orden del checklist. */
  listarSituacionesLegales(): Promise<SituacionLegal[]> {
    return this.situaciones.find({
      where: { activo: true, documentos: { activo: true } },
      relations: { documentos: true },
      order: { orden: 'ASC', documentos: { orden: 'ASC' } },
    });
  }

  async obtenerSituacionLegal(codigo: string): Promise<SituacionLegal> {
    const situacion = await this.situaciones.findOne({
      where: { codigo, activo: true },
      relations: { documentos: true },
    });
    if (!situacion) throw new NotFoundException(`No existe la situación legal ${codigo}.`);
    return situacion;
  }

  // --- Tipos de uso ---------------------------------------------------------------

  /** Tipos de uso activos con su dotación (para el selector y el cálculo de caudal). */
  listarTiposUso(): Promise<TipoUso[]> {
    return this.tiposUso.find({ where: { activo: true }, order: { orden: 'ASC' } });
  }

  /** Los tipos de uso activos con esos códigos (los que no existen simplemente no vienen). */
  buscarTiposUso(codigos: string[]): Promise<TipoUso[]> {
    return this.tiposUso.findBy({ codigo: In(codigos), activo: true });
  }
}
