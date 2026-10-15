import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { UbicacionesService } from './../src/catalogos/ubicaciones.service.js';

// Catálogo de ubicación (cat_departamento, cat_localidad, cat_distrito, cat_cuenca).
// Necesita la base levantada (docker compose up -d).
describe('Catálogo de ubicación (e2e)', () => {
  let app: INestApplication<App>;
  let ubicaciones: UbicacionesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    ubicaciones = app.get(UbicacionesService);
  });

  it('GET /catalogos/ubicaciones devuelve el árbol departamento → localidad → distritos', () => {
    return request(app.getHttpServer())
      .get('/catalogos/ubicaciones')
      .set('X-Usuario-Id', '1')
      .expect(200)
      .expect((res) => {
        expect(Object.keys(res.body)).toHaveLength(17);
        expect(res.body.CAPITAL).toEqual({ 'SAN MIGUEL DE TUCUMAN': ['III'] });
      });
  });

  it('GET /catalogos/cuencas devuelve las cuencas', () => {
    return request(app.getHttpServer())
      .get('/catalogos/cuencas')
      .set('X-Usuario-Id', '1')
      .expect(200)
      .expect((res) => expect(res.body).toContainEqual(expect.objectContaining({ nombre: 'CUENCA RIO SALI' })));
  });

  it('acepta una ubicación válida aunque venga en minúsculas o con espacios', async () => {
    const ubicacion = await ubicaciones.exigirUbicacion({ departamento: ' capital ', localidad: 'San Miguel de Tucuman', distrito: 'iii' });
    expect(ubicacion.departamento.nombre).toBe('CAPITAL');
    expect(ubicacion.localidad.nombre).toBe('SAN MIGUEL DE TUCUMAN');
    expect(ubicacion.distrito.codigo).toBe('III');
  });

  it('rechaza un departamento que no existe', async () => {
    await expect(ubicaciones.exigirUbicacion({ departamento: 'MENDOZA', localidad: 'X', distrito: 'I' })).rejects.toThrow(
      new BadRequestException('El departamento «MENDOZA» no existe.'),
    );
  });

  it('rechaza una localidad de otro departamento', async () => {
    await expect(ubicaciones.exigirUbicacion({ departamento: 'BURRUYACU', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'III' })).rejects.toThrow(
      'no pertenece al departamento BURRUYACU',
    );
  });

  it('rechaza un distrito que no es el de la localidad', async () => {
    await expect(ubicaciones.exigirUbicacion({ departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'II' })).rejects.toThrow(
      'pertenece al distrito III',
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
