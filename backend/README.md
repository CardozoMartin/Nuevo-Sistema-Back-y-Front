# Backend DRH — NestJS + PostgreSQL/PostGIS

API del Sistema Integrado DRH. Reemplaza de a poco al `json-server` de `Proyecto En React - Full/mock-server`.

- **NestJS 12** (ESM, TypeScript strict)
- **TypeORM** + **PostgreSQL 17 / PostGIS 3.6** en Docker (imagen `postgis/postgis`)
- Validación con `class-validator` (los errores vuelven en 400 con el detalle)
- Las tablas siguen los nombres de `Documentacion/esquema_drh.sql` (`emp_`, `exp_`, `poz_`…), adaptado de MySQL a PostgreSQL

## Puesta en marcha

```bash
cp .env.example .env        # una sola vez
docker compose up -d        # levanta PostgreSQL + PostGIS en localhost:5433
npm install                 # .npmrc ya trae legacy-peer-deps
npm run start:dev           # API en http://localhost:3000/api
```

> El puerto de la base es **5433** porque el 5432 lo usa un PostgreSQL instalado en la PC.

Comandos útiles:

```bash
docker compose down         # detener la base (los datos quedan en el volumen)
docker compose down -v      # detener y BORRAR los datos
docker exec -it drh-postgres psql -U drh -d drh_sistema   # consola SQL
npm run test:e2e            # pruebas e2e (con la base levantada)
npm run db:tablas           # docs/tablas.md: estructura de cada tabla (columnas, claves, índices, CHECKs)
npm run db:sql              # docs/esquema.sql: el SQL exacto de la base
```

Cómo se generan las tablas a partir de las entidades: sección 8 de [PROCESOS_BACKEND.md](../PROCESOS_BACKEND.md).

## Endpoints

| Método | Ruta                | Qué hace |
|--------|---------------------|----------|
| GET    | `/api/health`       | Estado de la API, versión de la base y de PostGIS |
| GET    | `/api/empresas`     | Padrón de empresas perforadoras con sus máquinas |
| GET    | `/api/empresas/:id` | Una empresa con sus máquinas |
| POST   | `/api/empresas`     | Alta de empresa + máquinas en una transacción. 409 si el CUIT o un código de máquina ya existen |
| GET    | `/api/catalogos/situaciones-legales` | Situaciones legales con la documentación que exige cada una |
| POST   | `/api/tramites/alta-concesion` | Paso 1 del alta: registra el expediente en papel |
| GET    | `/api/tramites/alta-concesion/:id` | Todo lo cargado del alta y qué pasos están completos |
| PUT    | `/api/tramites/alta-concesion/:id/titulares` | Paso 2: titulares y domicilios |
| PUT    | `/api/tramites/alta-concesion/:id/ubicacion` | Paso 3: departamento/localidad/distrito + KML/GeoJSON (multipart; optativo en la carga, obligatorio para la verificación final) |
| PUT    | `/api/tramites/alta-concesion/:id/inmueble` | Paso 4: parcela (catastro + dominio) |
| PUT    | `/api/tramites/alta-concesion/:id/usos` | Paso 5: usos, magnitudes, desagüe y punto de entrega (avisa si los puntos quedan lejos del polígono) |
| PUT    | `/api/tramites/alta-concesion/:id/suministro` | Paso 6: fuentes, canales y caudal asignado, validados contra el catálogo de suministro de la ubicación |
| GET    | `/api/catalogos/tipos-uso` | Tipos de uso con su dotación |
| GET    | `/api/catalogos/ubicaciones` | Departamento → localidad → distritos activos (mismo formato que `/catalogoLocalidades` del mock) |
| GET    | `/api/catalogos/suministro` | Catálogo de suministro de riego (mismo formato que `/catalogoSuministro` del mock). Con `?departamento=&localidad=&distrito=`, solo esa ubicación |
| GET    | `/api/catalogos/suministro/zonas?sinVincular=true&todas=true` | Zonas del catálogo de suministro y la localidad a la que están vinculadas |
| GET    | `/api/catalogos/suministro/zonas/:id` | Ficha de la zona: fuentes, sistemas, desagües y árbol de canales, con ids (también lo dado de baja) |
| POST / PUT | `/api/catalogos/suministro/zonas`, `/zonas/:id` | Alta de una zona (`{ departamentoId, distritoId, localidadId?, localidadOrigen? }`) / corrige su nombre de origen |
| PUT    | `/api/catalogos/suministro/zonas/:id/localidad` | Vincula una zona a una localidad (`{ "localidadId" }`, null la desvincula). Catastro o administrador |
| POST / PUT | `/api/catalogos/suministro/zonas/:id/opciones`, `/opciones/:id` | Alta (`{ tipo: FUENTE \| SISTEMA \| DESAGUE, nombre }`) / corrige el nombre |
| POST / PUT | `/api/catalogos/suministro/zonas/:id/canales`, `/canales/:id` | Alta de un canal (`{ nombre, padreId? }`: sin padre es principal; hasta el quinto) / corrige el nombre |
| DELETE / POST | `/api/catalogos/suministro/{zonas, opciones, canales}/:id`, `…/:id/reactivar` | **Baja lógica** con `{ "motivo" }` (un canal se lleva sus derivaciones) / reactivación |
| GET / POST | `/api/catalogos/{departamentos, localidades, distritos, cuencas}` | ABM del catálogo de ubicación: listado (`?todas=true`, `?q=`; localidades también `?departamentoId=`, `?distritoId=`) y alta |
| GET / PUT | `/api/catalogos/{…}/:id` | Uno / modificación |
| DELETE | `/api/catalogos/{…}/:id` | **Baja lógica** con `{ "motivo" }` (mínimo 10 caracteres). Nunca se borra la fila |
| POST   | `/api/catalogos/{…}/:id/reactivar` | Reactiva lo dado de baja |
| POST   | `/api/tramites/alta-concesion/:id/{enviar, reenviar, recaudacion, distrito, juridico, numero-concesion, resolucion, verificacion-final, padron}` | Circuito por las oficinas (ver el README del trámite). `numero-concesion` **pide** el número a Catastro |
| POST   | `/api/tramites/alta-concesion/:id/recaudacion/notificar-deuda` | Recaudación avisa la deuda por correo a los titulares |
| GET    | `/api/solicitudes-numero?estado=PENDIENTE` | Bandeja de Catastro: pedidos de número de concesión |
| POST   | `/api/solicitudes-numero/:id/asignar` | Catastro carga el número de concesión (de su libro) |
| GET    | `/api/solicitudes-numero/ultimo-numero` | Último número de concesión registrado (referencia) |
| GET    | `/api/expedientes/:id/emails` | Correos que se mandaron por el expediente |
| GET    | `/api/expedientes/bandeja/:oficina` | Expedientes en una oficina |
| GET    | `/api/expedientes/:id/historial` | Pases y actuaciones, con quién y cuándo |
| POST   | `/api/expedientes/:id/tomar` | La oficina recibe el expediente |
| GET    | `/api/personas?documento=` | Titular ya cargado: datos, concesiones y deudas |
| GET / POST | `/api/deudas`, `/api/deudas/:id/cancelar` | Deudas de los titulares (Recaudación) |
| GET    | `/api/usuarios` | Usuarios (de prueba, hasta que haya login) |
| GET    | `/api/sig/concesiones?bbox=o,s,e,n` | Concesiones con polígono, GeoJSON WGS84 (para el visor) |
| GET    | `/api/sig/concesiones/:id` | Una concesión como Feature GeoJSON |
| GET    | `/api/sig/concesiones/:id/kml` | El polígono vigente como KML, para Google Earth o un GPS |
| GET    | `/api/sig/poligonos/:id/archivo` | El archivo original (KML/GeoJSON) tal como se presentó; se comprueba con su hash |
| GET    | `/api/sig/cauces?bbox=o,s,e,n` | Ríos y canales activos, líneas simplificadas en GeoJSON WGS84 (para el visor) |
| GET / POST | `/api/catalogos/cauces` | ABM de ríos y canales: listado sin trazado (`?todas=true`, `?q=`, `?tipo=RIO\|CANAL`, `?fuente=`) / alta `{ nombre, tipo, linea: [[x, y]…], sistema?: WGS84\|POSGAR, fuente? }` |
| GET / PUT | `/api/catalogos/cauces/:id` | Uno con su trazado completo / modificación (solo lo que cambia; con `linea`, el trazado nuevo) |
| DELETE / POST | `/api/catalogos/cauces/:id`, `…/:id/reactivar` | **Baja lógica** con `{ "motivo" }` (sale del visor y de los avisos) / reactivación |
| POST   | `/api/sig/kml/analizar` | Vista previa de un KML/GeoJSON: valida, mide y detecta superposiciones sin guardar |

**Catálogo de ubicación (ABM).** Lo modifican usuarios de Catastro o administradores. Los nombres se guardan en
mayúsculas y sin espacios de más, y no se repiten (aunque el otro esté dado de baja: en ese caso se reactiva).
No se da de baja un departamento o un distrito que tenga localidades activas. Una localidad o cuenca dada de
baja deja de ofrecerse en las cargas nuevas, pero las concesiones que ya la usan la conservan (el listado de
localidades informa `concesionesVigentes`). Por ejemplo, para agregar una localidad que falta:

```bash
curl -H "Content-Type: application/json" -H "X-Usuario-Id: 2" \
     -d '{"departamentoId": 9, "nombre": "Bella Vista", "distritoId": 3}' localhost:3000/api/catalogos/localidades
```

El detalle del Alta de Concesión (reglas paso a paso, tablas y diferencias con el esquema)
está en [src/tramites/alta-concesion/README.md](src/tramites/alta-concesion/README.md).

Ejemplo de carga: `requests/empresa-alta.json`

```bash
curl -H "Content-Type: application/json" -d @requests/empresa-alta.json localhost:3000/api/empresas
```

## Datos geográficos (PostGIS)

**Recorrido de un polígono:** KML (WGS84) → `leerKml` (todos los polígonos del archivo, en 2D) →
PostGIS valida y mide (`GeometriaService`) → se guarda en `con_poligono` en POSGAR 07, con el KML
original en `STORAGE_DIR` → se publica en la vista `sig.v_concesiones` → la leen QGIS
([docs/qgis.md](docs/qgis.md)) y el visor web (`/api/sig/concesiones`, en WGS84).

- Cada concesión tiene **un polígono vigente**. Los trámites que lo cambian (ampliación,
  reducción, reubicación) cierran el anterior (`vigente = false`, `hasta`) y conservan el histórico.
- Las **superposiciones** con otras concesiones se informan; no bloquean la carga.
- El usuario de solo lectura para QGIS y servidores de mapas se crea con `sql/rol-lector-sig.sql`.

Sistema de referencia: **POSGAR 2007 / Argentina faja 3 — EPSG:5345** (Tucumán). Es el mismo de las
columnas `coord_x` / `coord_y` del esquema: X (este) empieza con 3 e Y (norte) con 7. El visor Leaflet
trabaja en WGS84 (EPSG:4326); la conversión la hace la base con `ST_Transform`.

Cómo se declara una columna geográfica con TypeORM (la lee y la escribe como GeoJSON):

```ts
import type { Point, Polygon } from 'typeorm';

@Index({ spatial: true })            // índice GIST
@Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 5345 })
ubicacion: Point;                     // { type: 'Point', coordinates: [x, y] }

@Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 5345, nullable: true })
poligono: Polygon | null;             // polígonos KML de las concesiones
```

Consultas espaciales con el QueryBuilder, por ejemplo los pozos a menos de 500 m de un punto:

```ts
repo.createQueryBuilder('p')
  .where('ST_DWithin(p.ubicacion, ST_SetSRID(ST_MakePoint(:x, :y), 5345), :metros)', { x, y, metros: 500 })
  .getMany();
```

Para devolverle WGS84 al frontend: `ST_AsGeoJSON(ST_Transform(p.ubicacion, 4326))`.

## Estructura

```
src/
├── main.ts                  prefijo /api, CORS, ValidationPipe global
├── app.module.ts            Config (.env) + conexión TypeORM
├── config/database.config.ts
├── health/                  GET /api/health
├── comun/                   validadores (CUIT, documento, fechas, textos) y helpers compartidos
│
│   Módulos base (datos, sin reglas de trámite)
├── seguridad/               seg_: oficinas y usuarios (login pendiente)
├── personas/                per_: titulares, únicos por documento
├── recaudacion/             rec_: deudas de los titulares
├── notificaciones/          not_: correos del sistema (nodemailer; sin SMTP_HOST, modo prueba)
├── catalogos/               cat_: situaciones legales, tipos de uso, ubicación (con ABM) y el árbol de suministro de riego
├── expedientes/             exp_: expediente y su circuito (tomar, pasar, actuaciones, historial, bandejas)
├── concesiones/             con_: concesión y, con historial (vigente/desde/hasta), titulares, domicilios,
│                            inmueble, condiciones, usos, puntos, suministro y polígonos
│
│   Trámites (orquestan los módulos base)
├── sig/                     PostGIS: lectura de KML, validación, capas GeoJSON, vistas sig.v_concesiones y sig.v_pozos
├── tramites/circuito/       Oficinas comunes a todos los trámites: envío, Recaudación, Distrito/Jurídico,
│                            número de concesión, resolución, cierre (cada trámite aporta su ConfigTramite)
├── tramites/alta-concesion/ Alta de Concesión (con su README)
├── empresas/                Empresas perforadoras
└── pozos/                   Pozos (poz_pozo): por ahora la tabla, la importación y la capa del mapa
```

Cada módulo sigue el mismo orden: `entities` → `dto` → `service` → `controller`. Los comentarios
del código están en español y explican el proceso paso a paso.

## Coordenadas: POSGAR 2007 faja 3

Todo se guarda en **POSGAR 2007 / Argentina faja 3 (EPSG:5345)**, el sistema de la oficina.
Los KML/GeoJSON se aceptan en POSGAR (X ≈ 3.500.000, Y ≈ 7.000.000) o en latitud/longitud: el
sistema se reconoce solo y, si vienen con los ejes invertidos, se corrigen con aviso
(`src/sig/kml/sistema-coordenadas.ts`). Un GeoJSON que **declara** su sistema (`crs`, lo agrega
QGIS) se transforma desde ese sistema: un archivo en Campo Inchauspe (EPSG:22193) queda bien
ubicado, a unos 225 m de donde quedaría si se lo tomara como POSGAR 2007. Los puntos de desagüe y de entrega se cargan como X/Y
POSGAR; PostGIS calcula la latitud/longitud que usa el mapa web.

## Capa de ríos y canales

```bash
npm run sig:cauces      # carga recursos/sig/cauces-osm.json (OpenStreetMap) en sig.cauce
```

Es la capa «Ríos y canales» del visor y se ve también en QGIS. Cuando la DRH tenga su propia
capa de cauces y canales de riego, se carga con otra fuente
(`npm run migracion -- cargar-cauces <archivo.json> --fuente DRH`). La carga de un archivo
**da de baja** los cauces anteriores de esa misma fuente (no los borra).

Un río o canal suelto se agrega, corrige o da de baja por la API (`/api/catalogos/cauces`, ver la
tabla de endpoints). Si no se indica `fuente`, queda como `DRH`: una carga posterior de un archivo
con `--fuente DRH` también lo da de baja.

## Datos de prueba y padrón

```bash
npm run demo:cargar     # ~160 concesiones ficticias con polígono y sus pozos (formato de la planilla real)
npm run demo:borrar     # las borra (con sus pozos)
```

Las parcelas de prueba se agrupan en colonias a la vera de ríos y canales reales
(`recursos/sig/cauces-osm.json`, de OpenStreetMap): fincas grandes con pozos adentro y chacras
chicas contiguas, que comparten los linderos sin superponerse. Para actualizar los cauces,
ver el encabezado de `scripts/demo/preparar-cauces.mjs`.

El importador (`src/migracion/`) es el mismo que se va a usar con el padrón real. Formato,
reglas y comandos en [docs/migracion.md](docs/migracion.md).

## Pendiente

- **Migraciones**: hoy `DB_SYNCHRONIZE=true` crea las tablas a partir de las entidades (solo sirve en desarrollo).
  Ya dio dos problemas: no crea esquemas para las vistas (se resolvió en `crearDataSource`) y no
  actualiza un CHECK que cambia de expresión pero conserva el nombre.
- **Usuarios y login** (`seg_`): el usuario de autoría está fijo en `1` (`TODO(login)` en los services).
  Una base creada con una versión anterior de las entidades ya no se actualiza sola (pasó con `con_condicion`):
  hay que crearla de nuevo. Mientras no haya migraciones, para probar se puede usar otra base en el mismo
  contenedor (`CREATE DATABASE …` + `CREATE EXTENSION postgis` y `DB_NAME` en el `.env`).
- Catálogos (`cat_`) y sus FKs; resto del circuito de empresas (dictamen, resolución, observar, bajas, historial).
- Catálogo de suministro: 78 zonas de la DRH sin vincular a una localidad (`GET /api/catalogos/suministro/zonas?sinVincular=true`).
- Pantallas de administración de catálogos (ubicación, suministro, cauces): hoy solo por la API.
- Conectar el frontend: apuntar `VITE_API_URL` a `http://localhost:3000/api` cuando los endpoints cubran lo que usa cada pantalla.
