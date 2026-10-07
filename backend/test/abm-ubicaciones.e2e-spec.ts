import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { UbicacionesService } from './../src/catalogos/ubicaciones.service.js';

// ABM del catálogo de ubicación. Necesita la base levantada (docker compose up -d).
// Como nada se borra físicamente, cada corrida usa nombres propios y deja sus filas dadas de baja.
describe('ABM del catálogo de ubicación (e2e)', () => {
  let app: INestApplication<App>;
  let ubicaciones: UbicacionesService;
  const CATASTRO = '2';
  const RECAUDACION = '3';
  const sufijo = Date.now().toString(36).toUpperCase();
  const api = () => request(app.getHttpServer());

  let leales: { id: number; nombre: string };
  let distritoIII: { id: number; codigo: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    // Igual que main.ts: valida y transforma los DTO.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
    await app.init();
    ubicaciones = app.get(UbicacionesService);

    leales = (await api().get('/catalogos/departamentos?q=leales')).body[0];
    distritoIII = (await api().get('/catalogos/distritos')).body.find((d: { codigo: string }) => d.codigo === 'III');
  });

  describe('localidades', () => {
    const nombre = `BELLA VISTA PRUEBA ${sufijo}`;
    let id: number;

    it('Catastro agrega una localidad que faltaba (el nombre se normaliza)', async () => {
      const res = await api()
        .post('/catalogos/localidades')
        .set('X-Usuario-Id', CATASTRO)
        .send({ departamentoId: leales.id, nombre: `  bella   vista prueba ${sufijo.toLowerCase()} `, distritoId: distritoIII.id })
        .expect(201);
      id = res.body.id;
      expect(res.body).toMatchObject({ nombre, departamento: { nombre: 'LEALES' }, distrito: { codigo: 'III' }, activo: true, concesionesVigentes: 0 });
    });

    it('queda disponible en la cascada del formulario y la validación la acepta', async () => {
      const catalogo = (await api().get('/catalogos/ubicaciones')).body;
      expect(catalogo.LEALES[nombre]).toEqual(['III']);
      await expect(ubicaciones.exigirUbicacion({ departamento: 'LEALES', localidad: nombre, distrito: 'III' })).resolves.toBeTruthy();
    });

    it('no se repite en el mismo departamento', () =>
      api().post('/catalogos/localidades').set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, nombre, distritoId: distritoIII.id }).expect(409));

    it('solo Catastro (o un administrador) modifica el catálogo', () =>
      api().post('/catalogos/localidades').set('X-Usuario-Id', RECAUDACION).send({ departamentoId: leales.id, nombre: `OTRA ${sufijo}`, distritoId: distritoIII.id }).expect(403));

    it('la baja exige motivo', () => api().delete(`/catalogos/localidades/${id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'corto' }).expect(400));

    it('baja lógica: deja de ofrecerse pero la fila sigue', async () => {
      const res = await api().delete(`/catalogos/localidades/${id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Cargada para la prueba automática.' }).expect(200);
      expect(res.body).toMatchObject({ activo: false, baja: { motivo: 'Cargada para la prueba automática.', usuarioId: CATASTRO } });

      expect((await api().get('/catalogos/ubicaciones')).body.LEALES[nombre]).toBeUndefined();
      await expect(ubicaciones.exigirUbicacion({ departamento: 'LEALES', localidad: nombre, distrito: 'III' })).rejects.toThrow('no pertenece');

      const todas = (await api().get(`/catalogos/localidades?departamentoId=${leales.id}&todas=true&q=${encodeURIComponent(nombre)}`)).body;
      expect(todas).toHaveLength(1);
    });

    it('dada de baja no se edita ni se vuelve a crear: se reactiva', async () => {
      await api().put(`/catalogos/localidades/${id}`).set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, nombre, distritoId: distritoIII.id }).expect(409);
      const otra = await api().post('/catalogos/localidades').set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, nombre, distritoId: distritoIII.id }).expect(409);
      expect(otra.body.message).toContain('reactívelo');

      const res = await api().post(`/catalogos/localidades/${id}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      expect(res.body).toMatchObject({ activo: true, baja: null, ultimaBaja: { motivo: 'Cargada para la prueba automática.' } });
    });

    it('se puede renombrar y al final queda dada de baja', async () => {
      const nuevo = `${nombre} BIS`;
      const res = await api().put(`/catalogos/localidades/${id}`).set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, nombre: nuevo, distritoId: distritoIII.id }).expect(200);
      expect(res.body.nombre).toBe(nuevo);
      await api().delete(`/catalogos/localidades/${id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Fin de la prueba automática.' }).expect(200);
    });
  });

  describe('departamentos y distritos', () => {
    it('no se da de baja un departamento con localidades activas', async () => {
      const res = await api().delete(`/catalogos/departamentos/${leales.id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Prueba de la regla.' }).expect(409);
      expect(res.body.message).toContain('localidad(es) activa(s)');
    });

    it('no se da de baja un distrito con localidades activas', () =>
      api().delete(`/catalogos/distritos/${distritoIII.id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Prueba de la regla.' }).expect(409));

    it('alta, baja y reactivación de un departamento sin localidades', async () => {
      const nombre = `DEPARTAMENTO PRUEBA ${sufijo}`;
      const { body } = await api().post('/catalogos/departamentos').set('X-Usuario-Id', CATASTRO).send({ nombre }).expect(201);
      expect(body).toMatchObject({ nombre, localidadesActivas: 0, activo: true });
      await api().delete(`/catalogos/departamentos/${body.id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Fin de la prueba automática.' }).expect(200);
      expect((await api().get('/catalogos/departamentos')).body.some((d: { id: number }) => d.id === body.id)).toBe(false);
      expect((await api().get('/catalogos/departamentos?todas=true')).body.some((d: { id: number }) => d.id === body.id)).toBe(true);
    });
  });

  describe('cuencas', () => {
    it('alta, renombre y baja', async () => {
      const { body } = await api().post('/catalogos/cuencas').set('X-Usuario-Id', CATASTRO).send({ nombre: `cuenca prueba ${sufijo}` }).expect(201);
      expect(body.nombre).toBe(`CUENCA PRUEBA ${sufijo}`);
      await api().put(`/catalogos/cuencas/${body.id}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'CUENCA RIO SALI' }).expect(409);
      await api().delete(`/catalogos/cuencas/${body.id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: 'Fin de la prueba automática.' }).expect(200);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
