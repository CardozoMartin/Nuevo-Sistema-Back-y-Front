import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { SuministroCatalogoService } from './../src/catalogos/suministro/suministro-catalogo.service.js';

// ABM del catálogo de suministro de riego (zonas, fuentes/sistemas/desagües, árbol de canales) y
// de los ríos y canales (sig.cauce). Necesita la base levantada (docker compose up -d).
// Como nada se borra físicamente, cada corrida usa nombres propios y deja sus filas dadas de baja.
describe('ABM del catálogo de suministro y de los cauces (e2e)', () => {
  let app: INestApplication<App>;
  let catalogo: SuministroCatalogoService;
  let dataSource: DataSource;
  const CATASTRO = '2';
  const RECAUDACION = '3';
  const sufijo = Date.now().toString(36).toUpperCase();
  const api = () => request(app.getHttpServer());
  const MOTIVO = 'Cargado para la prueba automática.';

  let leales: { id: number };
  let distritoIII: { id: number };
  let localidad: { id: number; nombre: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
    await app.init();
    catalogo = app.get(SuministroCatalogoService);
    dataSource = app.get(DataSource);

    leales = (await api().get('/catalogos/departamentos?q=leales')).body[0];
    distritoIII = (await api().get('/catalogos/distritos')).body.find((d: { codigo: string }) => d.codigo === 'III');
    // Una localidad nueva (sin zona de suministro) para armarle la suya.
    localidad = (
      await api().post('/catalogos/localidades').set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, nombre: `RIEGO PRUEBA ${sufijo}`, distritoId: distritoIII.id }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await api().delete(`/catalogos/localidades/${localidad.id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO });
    await app.close();
  });

  /** Lo que el formulario recibe para la localidad de la prueba (null si no hay catálogo). */
  const ofrecido = async () =>
    (await api().get('/catalogos/suministro').query({ departamento: 'LEALES', localidad: localidad.nombre, distrito: 'III' }).expect(200)).body;

  describe('zonas, listas y canales', () => {
    let zonaId: number;
    const canales: Record<string, number> = {};
    let fuenteId: number;

    it('Catastro crea la zona de la localidad (el nombre de origen sale de la localidad)', async () => {
      const res = await api().post('/catalogos/suministro/zonas').set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, distritoId: distritoIII.id, localidadId: localidad.id }).expect(201);
      zonaId = res.body.id;
      expect(res.body).toMatchObject({ localidadOrigen: localidad.nombre, localidad: { id: localidad.id }, distrito: 'III', activo: true, fuentesAgua: [], canales: [] });
    });

    it('una localidad tiene una sola zona por distrito', () =>
      api().post('/catalogos/suministro/zonas').set('X-Usuario-Id', CATASTRO).send({ departamentoId: leales.id, distritoId: distritoIII.id, localidadId: localidad.id, localidadOrigen: `OTRA ${sufijo}` }).expect(409));

    it('solo Catastro (o un administrador) modifica el catálogo', () =>
      api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', RECAUDACION).send({ tipo: 'FUENTE', nombre: 'RIO SALI' }).expect(403));

    it('agrega fuente, sistema y desagüe (normalizados, sin repetir, sin textos ajenos)', async () => {
      const fuente = await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'FUENTE', nombre: '  rio   sali ' }).expect(201);
      fuenteId = fuente.body.id;
      expect(fuente.body).toMatchObject({ tipo: 'FUENTE', nombre: 'RIO SALI', activo: true });
      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'SISTEMA', nombre: 'DIQUE NIVELADOR' }).expect(201);
      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'DESAGUE', nombre: 'MISMA PROPIEDAD' }).expect(201);

      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'FUENTE', nombre: 'RIO SALI' }).expect(409);
      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'FUENTE', nombre: '6. E-MAIL: CATASTRO@DRH' }).expect(400);
      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'OTRO', nombre: 'X' }).expect(400);
    });

    it('arma el árbol de canales hasta el quinto; el quinto no admite derivaciones', async () => {
      const crear = async (nombre: string, padre?: string) =>
        (canales[nombre] = (
          await api().post(`/catalogos/suministro/zonas/${zonaId}/canales`).set('X-Usuario-Id', CATASTRO).send({ nombre, padreId: padre ? canales[padre] : undefined }).expect(201)
        ).body.id);

      await crear('MATRIZ');
      await crear('DVDO. NORTE', 'MATRIZ');
      await crear('LOS RALOS', 'DVDO. NORTE');
      await crear('COMPUERTA 27', 'LOS RALOS');
      await crear('PROPIO', 'COMPUERTA 27');
      // «PROPIO» se repite en otra rama: vale.
      await crear('DVDO. SUR', 'MATRIZ');
      const otro = await api().post(`/catalogos/suministro/zonas/${zonaId}/canales`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'PROPIO', padreId: canales['DVDO. SUR'] }).expect(201);
      expect(otro.body).toMatchObject({ nivel: 3, nivelNombre: 'canal terciario', camino: ['MATRIZ', 'DVDO. SUR', 'PROPIO'] });

      await api().post(`/catalogos/suministro/zonas/${zonaId}/canales`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'MAS ABAJO', padreId: canales.PROPIO }).expect(400);
      await api().post(`/catalogos/suministro/zonas/${zonaId}/canales`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'dvdo.  norte', padreId: canales.MATRIZ }).expect(409);
    });

    it('el formulario recibe la zona en el formato de siempre', async () => {
      expect(await ofrecido()).toEqual({
        fuentesAgua: ['RIO SALI'],
        sistemasDistribucion: ['DIQUE NIVELADOR'],
        desagues: ['MISMA PROPIEDAD'],
        canalesPrincipales: { MATRIZ: ['DVDO. NORTE', 'DVDO. SUR'] },
        cascada: { MATRIZ: { 'DVDO. NORTE': { 'LOS RALOS': { 'COMPUERTA 27': ['PROPIO'] } }, 'DVDO. SUR': { PROPIO: {} } } },
      });
    });

    it('la baja de un canal se lleva sus derivaciones, y la reactivación las devuelve', async () => {
      const baja = await api().delete(`/catalogos/suministro/canales/${canales['DVDO. NORTE']}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect(baja.body).toMatchObject({ activo: false, baja: { motivo: MOTIVO } });
      expect((await ofrecido()).canalesPrincipales).toEqual({ MATRIZ: ['DVDO. SUR'] });

      // El paso 6 ya no acepta ese camino.
      const ubicacion = { departamento: { nombre: 'LEALES' }, localidad, distrito: { id: distritoIII.id, codigo: 'III' } };
      await expect(
        catalogo.exigirValido(dataSource.manager, ubicacion, { fuentes: ['RIO SALI'], canalPrincipal: 'MATRIZ', canalSecundario: 'DVDO. NORTE' }),
      ).rejects.toThrow('no está en el catálogo');

      // Dado de baja no se edita; su derivación tampoco se reactiva sola mientras el padre esté de baja.
      await api().put(`/catalogos/suministro/canales/${canales['DVDO. NORTE']}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'OTRO' }).expect(409);
      await api().post(`/catalogos/suministro/canales/${canales['LOS RALOS']}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(409);

      await api().post(`/catalogos/suministro/canales/${canales['DVDO. NORTE']}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      expect((await ofrecido()).cascada.MATRIZ['DVDO. NORTE']).toEqual({ 'LOS RALOS': { 'COMPUERTA 27': ['PROPIO'] } });
      await expect(
        catalogo.exigirValido(dataSource.manager, ubicacion, { fuentes: ['RIO SALI'], canalPrincipal: 'MATRIZ', canalSecundario: 'DVDO. NORTE', canalesAdicionales: ['LOS RALOS'] }),
      ).resolves.toBeUndefined();
    });

    it('renombra un canal y una fuente', async () => {
      const canal = await api().put(`/catalogos/suministro/canales/${canales['DVDO. SUR']}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'dvdo. sur nuevo' }).expect(200);
      expect(canal.body).toMatchObject({ nombre: 'DVDO. SUR NUEVO', derivaciones: 1 });
      await api().put(`/catalogos/suministro/opciones/${fuenteId}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'RIO SALI (TRAMO NORTE)' }).expect(200);
      expect((await ofrecido()).fuentesAgua).toEqual(['RIO SALI (TRAMO NORTE)']);
    });

    it('la baja de una opción deja de ofrecerla; se reactiva', async () => {
      await api().delete(`/catalogos/suministro/opciones/${fuenteId}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect((await ofrecido()).fuentesAgua).toEqual([]);
      await api().post(`/catalogos/suministro/zonas/${zonaId}/opciones`).set('X-Usuario-Id', CATASTRO).send({ tipo: 'FUENTE', nombre: 'RIO SALI (TRAMO NORTE)' }).expect(409);
      await api().post(`/catalogos/suministro/opciones/${fuenteId}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      expect((await ofrecido()).fuentesAgua).toEqual(['RIO SALI (TRAMO NORTE)']);
    });

    it('la ficha de la zona trae todo con ids, también lo dado de baja', async () => {
      const ficha = (await api().get(`/catalogos/suministro/zonas/${zonaId}`).expect(200)).body;
      expect(ficha.fuentesAgua[0]).toMatchObject({ id: fuenteId, activo: true });
      expect(ficha.canales[0]).toMatchObject({ nombre: 'MATRIZ', nivel: 1, hijos: expect.any(Array) });
    });

    it('baja lógica de la zona: la localidad se queda sin catálogo; se reactiva', async () => {
      await api().delete(`/catalogos/suministro/zonas/${zonaId}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect(await ofrecido()).toEqual({});
      await api().post(`/catalogos/suministro/zonas/${zonaId}/canales`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'NUEVO' }).expect(409);
      const todas = (await api().get('/catalogos/suministro/zonas?todas=true').expect(200)).body;
      expect(todas.find((z: { id: number }) => z.id === zonaId)).toMatchObject({ activo: false });
      expect((await api().get('/catalogos/suministro/zonas').expect(200)).body.find((z: { id: number }) => z.id === zonaId)).toBeUndefined();

      await api().post(`/catalogos/suministro/zonas/${zonaId}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      expect((await ofrecido()).fuentesAgua).toEqual(['RIO SALI (TRAMO NORTE)']);

      // Limpieza: la zona queda dada de baja.
      await api().delete(`/catalogos/suministro/zonas/${zonaId}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
    });
  });

  describe('ríos y canales (sig.cauce)', () => {
    const nombre = `CANAL PRUEBA ${sufijo}`;
    // Un tramo corto al este de San Miguel de Tucumán, en latitud/longitud.
    const linea = [
      [-65.15, -26.83],
      [-65.14, -26.835],
      [-65.13, -26.84],
    ];
    let id: number;

    it('Catastro carga un canal en latitud/longitud (fuente DRH, largo calculado)', async () => {
      const res = await api().post('/catalogos/cauces').set('X-Usuario-Id', CATASTRO).send({ nombre: nombre.toLowerCase(), tipo: 'CANAL', linea }).expect(201);
      id = res.body.id;
      expect(res.body).toMatchObject({ nombre, tipo: 'CANAL', fuente: 'DRH', activo: true, linea: { type: 'LineString' } });
      expect(res.body.largoKm).toBeGreaterThan(2);
      expect(res.body.largoKm).toBeLessThan(3);
    });

    it('aparece en la capa del visor', async () => {
      const capa = (await api().get('/sig/cauces').expect(200)).body;
      expect(capa.features.some((f: { id: number }) => f.id === id)).toBe(true);
    });

    it('rechaza líneas mal georreferenciadas', async () => {
      const enviar = (cuerpo: object) => api().post('/catalogos/cauces').set('X-Usuario-Id', CATASTRO).send({ nombre, tipo: 'CANAL', ...cuerpo });
      // Latitud y longitud invertidas: cae fuera de Tucumán.
      expect((await enviar({ linea: linea.map(([x, y]) => [y, x]) }).expect(400)).body.message).toContain('fuera de Tucumán');
      // Números POSGAR declarados como WGS84.
      expect((await enviar({ linea: [[3580000, 7030000], [3581000, 7031000]] }).expect(400)).body.message).toContain('POSGAR');
      await enviar({ linea: [[-65.15, -26.83]] }).expect(400);
      await enviar({ linea: [[-65.15, 'x'], [-65.14, -26.83]] }).expect(400);
      await enviar({ linea, tipo: 'ACEQUIA' }).expect(400);
      await api().post('/catalogos/cauces').set('X-Usuario-Id', RECAUDACION).send({ nombre, tipo: 'CANAL', linea }).expect(403);
    });

    it('modifica el nombre y el trazado (en POSGAR, como los papeles de la oficina)', async () => {
      const [{ posgar }] = await dataSource.query(
        `SELECT ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 5345), 2)::json -> 'coordinates' AS posgar`,
        [JSON.stringify({ type: 'LineString', coordinates: linea.slice(0, 2) })],
      );
      const res = await api().put(`/catalogos/cauces/${id}`).set('X-Usuario-Id', CATASTRO).send({ nombre: `${nombre} BIS`, linea: posgar, sistema: 'POSGAR' }).expect(200);
      expect(res.body).toMatchObject({ nombre: `${nombre} BIS`, tipo: 'CANAL' });
      expect(res.body.largoKm).toBeGreaterThan(1);
      expect(res.body.largoKm).toBeLessThan(1.5);
      expect(res.body.linea.coordinates[0][0]).toBeCloseTo(-65.15, 5);
    });

    it('baja lógica: sale del visor pero sigue en el listado con todas=true; se reactiva', async () => {
      await api().delete(`/catalogos/cauces/${id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect((await api().get('/sig/cauces').expect(200)).body.features.some((f: { id: number }) => f.id === id)).toBe(false);
      expect((await api().get(`/catalogos/cauces?q=${encodeURIComponent(nombre)}`).expect(200)).body).toHaveLength(0);
      expect((await api().get(`/catalogos/cauces?todas=true&q=${encodeURIComponent(nombre)}`).expect(200)).body).toHaveLength(1);
      await api().put(`/catalogos/cauces/${id}`).set('X-Usuario-Id', CATASTRO).send({ nombre }).expect(409);

      await api().post(`/catalogos/cauces/${id}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      // Limpieza: queda dado de baja.
      await api().delete(`/catalogos/cauces/${id}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
    });
  });
});
