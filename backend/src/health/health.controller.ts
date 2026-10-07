import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** GET /api/health: confirma que la API está arriba, llega a la base y tiene PostGIS. */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const [{ version, postgis }] = await this.dataSource.query('SELECT version() AS version, postgis_lib_version() AS postgis');
    return { estado: 'ok', baseDeDatos: version as string, postgis: postgis as string };
  }
}
