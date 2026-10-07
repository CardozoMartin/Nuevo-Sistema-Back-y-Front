import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { TipoTramite } from '../../expedientes/expedientes.constantes.js';
import type { ConfigTramite } from './config-tramite.js';

/**
 * Registro de las configuraciones de los trámites. Cada trámite anota la suya al arrancar
 * (onModuleInit). Lo necesitan las acciones que no entran por la ruta de un trámite: por
 * ejemplo Catastro asigna un número de concesión desde su bandeja, y el pedido puede ser de un
 * alta, de una subdivisión…
 */
@Injectable()
export class RegistroTramitesService {
  private readonly configuraciones = new Map<TipoTramite, ConfigTramite>();

  registrar(config: ConfigTramite): void {
    this.configuraciones.set(config.tipoTramite, config);
  }

  de(tipo: TipoTramite): ConfigTramite {
    const config = this.configuraciones.get(tipo);
    if (!config) throw new InternalServerErrorException(`El trámite ${tipo} no tiene configurado el circuito.`);
    return config;
  }
}
