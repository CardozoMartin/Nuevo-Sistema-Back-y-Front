import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { USUARIO_SISTEMA } from '../comun/usuario-sistema.js';
import { soloDigitos } from '../comun/validadores/cuit.js';
import { CrearEmpresaDto } from './dto/crear-empresa.dto.js';
import { Empresa, EstadoEmpresa } from './entities/empresa.entity.js';
import { Maquina } from './entities/maquina.entity.js';

const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase();

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
    private readonly dataSource: DataSource,
  ) {}

  listar(): Promise<Empresa[]> {
    return this.empresas.find({ relations: { maquinas: true }, order: { creadoEn: 'DESC' } });
  }

  async obtener(id: string): Promise<Empresa> {
    const empresa = await this.empresas.findOne({ where: { id }, relations: { maquinas: true } });
    if (!empresa) throw new NotFoundException('No se encontró la empresa.');
    return empresa;
  }

  /** Alta: la empresa y sus máquinas en una sola transacción. Entra al circuito en Jurídico. */
  async crear(dto: CrearEmpresaDto): Promise<Empresa> {
    const cuit = soloDigitos(dto.cuit);
    const codigos = dto.maquinas.map((m) => normalizarCodigo(m.codigo));
    if (new Set(codigos).size !== codigos.length) throw new ConflictException('Hay códigos de máquina repetidos en la carga.');

    const id = await this.dataSource.transaction(async (tx) => {
      // Flujo alterno 10.1 del CU: el CUIT es único.
      if (await tx.existsBy(Empresa, { cuit })) throw new ConflictException('La empresa ya se encuentra registrada con esta CUIT.');
      // El código de máquina es único en todo el sistema (aunque la máquina esté de baja).
      const usada = await tx.findOneBy(Maquina, { codigo: In(codigos) });
      if (usada) throw new ConflictException(`El código ${usada.codigo} ya está asignado a otra máquina.`);

      const { maquinas, ...datos } = dto;
      const empresa = tx.create(Empresa, {
        ...datos,
        cuit,
        razonSocial: dto.personaJuridica ? dto.razonSocial : null,
        nombre: dto.personaJuridica ? null : dto.nombre,
        apellido: dto.personaJuridica ? null : dto.apellido,
        estado: EstadoEmpresa.EN_TRAMITE,
        creadoUsuarioId: USUARIO_SISTEMA,
        maquinas: maquinas.map((m, i) =>
          tx.create(Maquina, {
            ...m,
            codigo: codigos[i],
            capacidadProfundidad: m.capacidadProfundidad?.toString(),
            alturaTorre: m.alturaTorre?.toString(),
            creadoUsuarioId: USUARIO_SISTEMA,
          }),
        ),
      });
      return (await tx.save(empresa)).id;
    });
    return this.obtener(id);
  }
}
