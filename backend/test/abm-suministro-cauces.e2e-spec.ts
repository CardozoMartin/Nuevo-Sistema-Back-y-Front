import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

const SISTEMA = '1';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { SuministroCatalogoService } from './../src/catalogos/suministro/suministro-catalogo.service.js';

// ABM del árbol de suministro de riego por distrito (fuente → sistema → canales → desagüe) y de
// los ríos y canales (sig.cauce). Necesita la base levantada (docker compose up -d).
// Como nada se borra físicamente, cada corrida usa nombres propios y deja sus filas dadas de baja.
describe('ABM del catálogo de suministro y de los cauces (e2e)', () => {
  let app: INestApplication<App>;
  let catalogo: SuministroCatalogoService;
  let dataSource: DataSource;
  const CATASTRO = '2';
  const RECAUDACION = '3';
  const sufijo = Date.now().toString(36).toUpperCase();
  // Sin sesión todo da 401: por defecto se actúa como «Sistema» (encabezado de pruebas); los
  // pedidos de una oficina lo cambian con .set('X-Usuario-Id', …).
  const api = () => request.agent(app.getHttpServer()).set('X-Usuario-Id', SISTEMA);
  const MOTIVO = 'Cargado para la prueba automática.';

  let distritoIII: { id: number };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
    await app.init();
    catalogo = app.get(SuministroCatalogoService);
    dataSource = app.get(DataSource);
    distritoIII = (await api().get('/catalogos/distritos')).body.find((d: { codigo: string }) => d.codigo === 'III');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('árbol de suministro del distrito', () => {
    const FUENTE = `RIO PRUEBA ${sufijo}`;
    const ids: Record<string, number> = {};
    const ubicacion = () => ({ distrito: { id: distritoIII.id, codigo: 'III' } });
    const alta = (cuerpo: object, usuario = CATASTRO) => api().post('/catalogos/suministro/nodos').set('X-Usuario-Id', usuario).send({ distritoId: distritoIII.id, ...cuerpo });
    const crear = async (clave: string, nivel: string, nombre: string, padre: string) => (ids[clave] = (await alta({ nivel, nombre, padreId: ids[padre] }).expect(201)).body.id);
    /** La fuente de la prueba tal como la recibe el formulario (undefined si no se ofrece). */
    const ofrecida = async () => ((await api().get('/catalogos/suministro').query({ distrito: 'III' }).expect(200)).body as { nombre: string; hijos: any[] }[]).find((f) => f.nombre === FUENTE);

    it('solo Catastro (o un administrador) modifica el árbol', () => alta({ nivel: 'FUENTE', nombre: FUENTE }, RECAUDACION).expect(403));

    it('agrega una fuente (normalizada, sin repetir, sin textos ajenos)', async () => {
      const res = await alta({ nivel: 'FUENTE', nombre: `  rio   prueba ${sufijo.toLowerCase()} ` }).expect(201);
      ids.fuente = res.body.id;
      expect(res.body).toMatchObject({ nivel: 'FUENTE', nombre: FUENTE, padre: null, camino: [FUENTE], activo: true });

      await alta({ nivel: 'FUENTE', nombre: FUENTE }).expect(409);
      await alta({ nivel: 'FUENTE', nombre: '6. E-MAIL: CATASTRO@DRH' }).expect(400);
      await alta({ nivel: 'OTRO', nombre: 'X' }).expect(400);
    });

    it('arma la rama: cada tramo cuelga de un nivel anterior, aunque no sea el inmediato', async () => {
      await crear('dique', 'SISTEMA', 'DIQUE PRUEBA', 'fuente');
      await crear('matriz', 'CANAL_PRINCIPAL', 'MATRIZ', 'dique');
      await crear('norte', 'CANAL_SECUNDARIO', 'DVDO. NORTE', 'matriz');
      await crear('ralos', 'CANAL_TERCIARIO', 'LOS RALOS', 'norte');
      // Un terciario directo del principal (la rama no tiene secundario) y un desagüe del principal.
      const salteado = await alta({ nivel: 'CANAL_TERCIARIO', nombre: 'PROPIO', padreId: ids.matriz }).expect(201);
      expect(salteado.body).toMatchObject({ nivelNombre: 'canal terciario', camino: [FUENTE, 'DIQUE PRUEBA', 'MATRIZ', 'PROPIO'] });
      await crear('desague', 'DESAGUE', 'MISMA PROPIEDAD', 'matriz');

      // No puede colgar de un nivel igual o posterior; una fuente no tiene padre y lo demás sí.
      await alta({ nivel: 'CANAL_PRINCIPAL', nombre: 'X', padreId: ids.norte }).expect(400);
      await alta({ nivel: 'FUENTE', nombre: 'X', padreId: ids.fuente }).expect(400);
      await alta({ nivel: 'SISTEMA', nombre: 'X' }).expect(400);
      // El nombre no se repite entre los hermanos del mismo nivel.
      await alta({ nivel: 'CANAL_SECUNDARIO', nombre: 'dvdo.  norte', padreId: ids.matriz }).expect(409);
    });

    it('el formulario recibe el árbol del distrito', async () => {
      const fuente = await ofrecida();
      expect(fuente).toMatchObject({ nivel: 'FUENTE', hijos: [{ nombre: 'DIQUE PRUEBA', hijos: [{ nombre: 'MATRIZ', nivel: 'CANAL_PRINCIPAL' }] }] });
      const deMatriz = fuente!.hijos[0].hijos[0].hijos.map((h: { nombre: string; nivel: string }) => `${h.nivel} ${h.nombre}`);
      expect(deMatriz).toEqual(['CANAL_SECUNDARIO DVDO. NORTE', 'DESAGUE MISMA PROPIEDAD', 'CANAL_TERCIARIO PROPIO']);
    });

    it('la baja de un tramo se lleva lo que cuelga de él, y la reactivación lo devuelve', async () => {
      const baja = await api().delete(`/catalogos/suministro/nodos/${ids.norte}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect(baja.body).toMatchObject({ activo: false, baja: { motivo: MOTIVO } });

      // El paso 6 ya no acepta ese camino.
      const camino = { fuentes: [FUENTE], sistemaDistribucion: 'DIQUE PRUEBA', canalPrincipal: 'MATRIZ', canalSecundario: 'DVDO. NORTE', canalTerciario: 'LOS RALOS' };
      await expect(catalogo.exigirValido(dataSource.manager, ubicacion(), camino)).rejects.toThrow('no sale de «MATRIZ»');

      // Dado de baja no se edita; lo que cuelga no se reactiva solo mientras el padre esté de baja.
      await api().put(`/catalogos/suministro/nodos/${ids.norte}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'OTRO' }).expect(409);
      await api().post(`/catalogos/suministro/nodos/${ids.ralos}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(409);

      await api().post(`/catalogos/suministro/nodos/${ids.norte}/reactivar`).set('X-Usuario-Id', CATASTRO).expect(201);
      await expect(catalogo.exigirValido(dataSource.manager, ubicacion(), camino)).resolves.toBeUndefined();
      // También el camino que saltea el secundario.
      const salteado = { fuentes: [FUENTE], sistemaDistribucion: 'DIQUE PRUEBA', canalPrincipal: 'MATRIZ', canalTerciario: 'PROPIO' };
      await expect(catalogo.exigirValido(dataSource.manager, ubicacion(), salteado)).resolves.toBeUndefined();
    });

    it('renombra un tramo', async () => {
      const res = await api().put(`/catalogos/suministro/nodos/${ids.dique}`).set('X-Usuario-Id', CATASTRO).send({ nombre: 'dique prueba nuevo' }).expect(200);
      expect(res.body).toMatchObject({ nombre: 'DIQUE PRUEBA NUEVO', derivaciones: 1 });
    });

    it('el árbol del ABM trae todo con ids, también lo dado de baja', async () => {
      await api().delete(`/catalogos/suministro/nodos/${ids.desague}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      const { nodos } = (await api().get(`/catalogos/suministro/distritos/${distritoIII.id}/arbol`).expect(200)).body;
      const fuente = nodos.find((n: { id: number }) => n.id === ids.fuente);
      expect(fuente).toMatchObject({ nombre: FUENTE, activo: true, hijos: [{ id: ids.dique, nivel: 'SISTEMA' }] });
      expect(fuente.hijos[0].hijos[0].hijos.find((n: { id: number }) => n.id === ids.desague)).toMatchObject({ activo: false, baja: { motivo: MOTIVO } });
      const distritos = (await api().get('/catalogos/suministro/distritos').expect(200)).body;
      expect(distritos.find((d: { id: number }) => d.id === distritoIII.id).fuentes).toBeGreaterThan(0);
    });

    it('limpieza: la fuente queda dada de baja y deja de ofrecerse', async () => {
      await api().delete(`/catalogos/suministro/nodos/${ids.fuente}`).set('X-Usuario-Id', CATASTRO).send({ motivo: MOTIVO }).expect(200);
      expect(await ofrecida()).toBeUndefined();
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
