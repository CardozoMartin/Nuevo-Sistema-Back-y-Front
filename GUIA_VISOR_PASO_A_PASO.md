# Guía paso a paso: cómo está conectado el visor cartográfico

Esta guía explica, archivo por archivo, cómo llega un polígono desde un KML hasta el mapa del
visor (`/visor`). Se recorre en el mismo orden en que viajan los datos:

```
 KML / GeoJSON del titular
        │  (Alta de Concesión, paso 3 — o «Comparar archivo» en el visor)
        ▼
 BACKEND (NestJS)  ── lee el archivo, reconoce el sistema de coordenadas,
        │             PostGIS lo valida, lo mide y lo guarda
        ▼
 BASE (PostgreSQL + PostGIS)  ── tabla con_poligono (POSGAR 2007, EPSG:5345)
        │                        vista sig.v_concesiones (polígono + datos de la concesión)
        ▼
 BACKEND  ── GET /api/sig/concesiones: PostGIS arma un GeoJSON en lat/long (WGS84)
        ▼
 FRONT (React + Leaflet)  ── pide el GeoJSON y lo dibuja con L.geoJSON
```

---

## La pregunta clave: ¿el visor usa GeoJSON o las coordenadas reales de los KML?

**Las dos cosas, en momentos distintos:**

1. **Las coordenadas reales salen de los KML.** Cuando Catastro carga un KML en el Alta de Concesión,
   el backend lee las coordenadas del archivo (las verdaderas, las que dibujó el titular) y las
   guarda en PostGIS. El archivo original también se guarda en el disco, sin tocarlo, como respaldo.
2. **GeoJSON es solo el «formato de transporte»** entre el backend y el mapa. No hay ningún
   archivo `.geojson` fijo que el visor lea: cada vez que se abre el visor, PostGIS arma el GeoJSON
   en el momento a partir de lo que hay en la base. Si mañana se carga un KML nuevo, aparece en el
   visor sin hacer nada más.

Hoy, en la base `drh_nuevo`, hay **169 polígonos**:

| Origen | Cantidad | De dónde vienen las coordenadas |
|---|---|---|
| `ALTA` | 15 | KML subidos en el Alta de Concesión (coordenadas reales del archivo) |
| `MIGRACION` | 154 | El padrón demo (`npm run demo:cargar`), que trae la geometría dentro del JSON |

Todos se guardan en **POSGAR 2007 faja 3 (EPSG:5345)**, el sistema oficial, y al mapa le llegan en
**latitud/longitud (WGS84)**, que es lo que usa Leaflet.

**¿Qué archivos acepta el sistema?**

| Archivo | ¿Se acepta? | Detalle |
|---|---|---|
| `.kml` en latitud/longitud | Sí | Es el estándar de Google Earth. |
| `.kml` con X/Y POSGAR faja 3 | Sí | No es estándar, pero la oficina lo usa: se reconoce por el tamaño de los números (X ≈ 3.500.000, Y ≈ 7.000.000). |
| `.geojson` / `.json` | Sí | Si declara su sistema (`crs`, ej. lo que exporta QGIS) se respeta, incluso Campo Inchauspe. |
| `.kmz` (KML comprimido) | **No** | Hay que exportarlo como `.kml`. |
| Coordenadas invertidas (Y,X o lat,lon) | Sí, se corrigen | Se avisa al usuario. |

Las dos pruebas del paso 9 lo confirman: el mismo cuadrado cargado en lat/long y en POSGAR da
el mismo resultado.

---

## PARTE 1 — La base de datos

### Paso 1. PostgreSQL con PostGIS

**Archivo:** [backend/docker-compose.yml](backend/docker-compose.yml)

- Usa la imagen `postgis/postgis:17-3.6-alpine`: PostgreSQL ya con la extensión **PostGIS**, que es la
  que sabe de geometrías (áreas, distancias, superposiciones, cambio de sistema de coordenadas).
- Escucha en el puerto **5433** de la PC (el 5432 ya lo usa otro PostgreSQL instalado).
- La base que usa el backend es la de `DB_NAME` en `backend/.env` (hoy: `drh_nuevo`).

Para levantarla: `docker compose --env-file .env up -d` dentro de `backend/`.

### Paso 2. La tabla donde se guarda el polígono: `con_poligono`

**Archivo:** [backend/src/concesiones/entities/poligono.entity.ts](backend/src/concesiones/entities/poligono.entity.ts)

- La columna `geom` es de tipo `geometry(MultiPolygon, 5345)`: **se guarda en POSGAR**, así las
  superficies y distancias salen en metros reales.
- Tiene un **índice espacial** (`idx_poligono_geom`), que permite buscar rápido «qué polígonos hay en
  esta zona».
- Guarda también los datos del archivo original: `archivo_nombre`, `archivo_ruta`, `archivo_sha256`,
  `archivo_bytes` (el archivo en sí no va a la base, va al disco: ver paso 7).
- `vigente`: una concesión puede tener varios polígonos en el tiempo, pero uno solo vigente.

**Por qué MultiPolygon:** una concesión puede tener varias partes separadas, así que siempre se
guarda como «varios polígonos», aunque sea uno solo.

### Paso 3. La vista que «publica» la capa: `sig.v_concesiones`

**Archivo:** [backend/src/sig/entities/vista-concesion.entity.ts](backend/src/sig/entities/vista-concesion.entity.ts)

Es una vista SQL que junta, en una sola fila por concesión:

- el polígono vigente (`p.geom`),
- los datos de la concesión (número, estado, expediente),
- el titular, la ubicación (departamento, localidad, distrito), los usos, el caudal, etc.

Está en el esquema `sig` a propósito: es lo único que se expone para mapas. La leen:

- el visor web (a través del backend, ver Parte 3),
- QGIS conectado directo a la base (ver [backend/docs/qgis.md](backend/docs/qgis.md)),
- y más adelante Argenmap / GeoServer.

Hay dos vistas hermanas con la misma idea: `sig.v_pozos` (puntos de pozos) y `sig.v_puntos`
(desagües y puntos de entrega), y una tabla `sig.cauce` (ríos y canales).

---

## PARTE 2 — Backend: cómo entra un KML

### Paso 4. Recibir el archivo

**Archivo:** [backend/src/sig/kml/archivo-kml.ts](backend/src/sig/kml/archivo-kml.ts)

- `RecibirKml()`: interceptor de Nest que toma el archivo del campo **`archivo`** del formulario
  (multipart), en memoria, con un tope de 5 MB.
- `exigirKml()`: controla que haya archivo, que sea `.kml`, `.geojson` o `.json`, y que no esté vacío.
  Rechaza `.kmz`.
- `leerArchivoGeografico()`: según la extensión, llama al lector de KML o al de GeoJSON.

### Paso 5. Leer las coordenadas del archivo

**KML → [backend/src/sig/kml/leer-kml.ts](backend/src/sig/kml/leer-kml.ts)**

1. Se lee el XML (`@xmldom/xmldom`). Si está roto → error «el archivo no es un KML válido».
2. La librería `@tmcw/togeojson` convierte cada `<Placemark>` del KML en un objeto GeoJSON
   (es una conversión **en memoria**, solo para poder trabajar las coordenadas; no se guarda un
   archivo GeoJSON).
3. Se juntan todos los polígonos en un solo `MultiPolygon`.
4. Se descarta la altura (el `,0` del final de cada coordenada del KML).
5. Los puntos y líneas se ignoran, y se avisa.

**GeoJSON → [backend/src/sig/kml/leer-geojson.ts](backend/src/sig/kml/leer-geojson.ts)**

Hace lo mismo, y además:
- lee el `crs` si el archivo declara su sistema de coordenadas;
- toma el número de concesión de la propiedad `concesion` (así vienen las capas de la DRH).

Los dos devuelven lo mismo (`KmlLeido`): el `MultiPolygon`, los nombres, los avisos.

### Paso 6. Reconocer el sistema de coordenadas y validar con PostGIS

**Reconocer:** [backend/src/sig/kml/sistema-coordenadas.ts](backend/src/sig/kml/sistema-coordenadas.ts)

Se mira el tamaño de los números de cada vértice:

```
POSGAR faja 3   X ≈ 3.400.000 a 3.750.000     Y ≈ 6.800.000 a 7.200.000
WGS84           longitud ≈ -66 a -64          latitud ≈ -28 a -26
```

No se pueden confundir. Si vienen al revés (Y primero, o latitud primero), se dan vuelta y se avisa.

**Validar y medir:** [backend/src/sig/geometria.service.ts](backend/src/sig/geometria.service.ts)

- `normalizar()`: lleva todo a WGS84. Si vino en POSGAR, PostGIS lo transforma
  (`ST_Transform(..., 5345 → 4326)`). Si el archivo declaró otro sistema (Campo Inchauspe), también.
- `analizar()`, todo hecho por PostGIS (no por JavaScript):
  1. ¿Es un polígono válido? (`ST_IsValidDetail`: que no se cruce, que esté cerrado…). Si no, el
     error dice el motivo y el lugar.
  2. ¿Cae dentro de Tucumán? (si no, casi seguro las coordenadas están mal).
  3. Superficie y perímetro, **calculados en POSGAR** (`ST_Area`, `ST_Perimeter`).
  4. Superposiciones con otras concesiones (`ST_Intersects`, `ST_Intersection`).
  5. Río o canal más cercano (si está a más de 2 km, avisa).

Las constantes (sistemas, límites de Tucumán, distancias) están en
[backend/src/sig/sig.constantes.ts](backend/src/sig/sig.constantes.ts).

### Paso 7. Guardar (solo en el Alta de Concesión)

**Archivo:** [backend/src/tramites/alta-concesion/pasos/paso3-ubicacion.service.ts](backend/src/tramites/alta-concesion/pasos/paso3-ubicacion.service.ts), método `guardarPoligono`

1. Normaliza y analiza (paso 6).
2. Guarda el **archivo original** en el disco con
   [backend/src/sig/archivos.service.ts](backend/src/sig/archivos.service.ts): el nombre del archivo es
   su hash SHA-256 (`storage/kml/ab/abcdef….kml`). Así se puede comprobar después que nadie lo modificó.
3. Inserta la fila en `con_poligono` con la geometría (que se pasa a POSGAR al guardarse).
4. Si el polígono es prácticamente igual al de otra concesión activa → rechaza (concesión duplicada).

Todo dentro de una **transacción**: si algo falla, no queda nada a medias.

> El visor **no guarda** nada. Su opción «Comparar archivo» usa el endpoint de análisis (paso 8),
> que hace los pasos 4 a 6 y devuelve el resultado sin tocar la base.

---

## PARTE 3 — Backend: cómo sale la capa para el mapa

### Paso 8. Los endpoints `/api/sig/*`

**Archivo:** [backend/src/sig/sig.controller.ts](backend/src/sig/sig.controller.ts)

| Endpoint | Qué devuelve |
|---|---|
| `GET /api/sig/concesiones?bbox=oeste,sur,este,norte` | Todas las concesiones con polígono (FeatureCollection GeoJSON). Sin `bbox`, todas. |
| `GET /api/sig/concesiones/:id` | Una concesión (Feature). |
| `GET /api/sig/concesiones/:id/kml` | El polígono como KML, para Google Earth o un GPS. |
| `GET /api/sig/poligonos/:id/archivo` | El archivo **original** que se subió (comprobando el hash). |
| `GET /api/sig/pozos`, `/api/sig/puntos`, `/api/sig/cauces` | Las otras capas. |
| `POST /api/sig/kml/analizar` | Vista previa de un KML/GeoJSON sin guardar (paso 6). |

El módulo que los registra es [backend/src/sig/sig.module.ts](backend/src/sig/sig.module.ts).

### Paso 9. PostGIS arma el GeoJSON

**Archivo:** [backend/src/sig/capas.service.ts](backend/src/sig/capas.service.ts)

Lo importante es que **el GeoJSON lo arma PostgreSQL**, no JavaScript:

```sql
SELECT json_build_object(
         'type', 'FeatureCollection',
         'features', json_agg(
            json_build_object(
              'type', 'Feature',
              'id', v.concesion_id,
              'geometry', ST_AsGeoJSON(ST_Transform(v.geom, 4326), 7)::json,  -- POSGAR → lat/long
              'properties', json_build_object('numero', v.numero, 'titular', v.titular, ...)
            )))
  FROM sig.v_concesiones v
 WHERE v.geom && ST_Transform(ST_MakeEnvelope(oeste, sur, este, norte, 4326), 5345)  -- solo la zona pedida
```

- `ST_Transform(v.geom, 4326)`: pasa de POSGAR (como está guardado) a lat/long (lo que entiende Leaflet).
- `ST_AsGeoJSON(..., 7)`: 7 decimales ≈ 1 cm de precisión.
- `&&` con `ST_MakeEnvelope`: usa el índice espacial para traer solo lo que cae en el recuadro.

**Probalo vos mismo** (con el backend levantado):

```bash
# Una concesión, en GeoJSON (cambiar el 2 por otro id)
curl http://localhost:3000/api/sig/concesiones/2

# La misma, en KML
curl http://localhost:3000/api/sig/concesiones/2/kml

# Analizar un KML sin guardarlo
curl -F "archivo=@prueba.kml" http://localhost:3000/api/sig/kml/analizar
```

Un `prueba.kml` para esa última prueba (un cuadrado cerca de San Miguel de Tucumán):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Parcela de prueba</name>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>
        -65.2600,-26.9000,0 -65.2560,-26.9000,0 -65.2560,-26.9040,0 -65.2600,-26.9040,0 -65.2600,-26.9000,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
  </Document>
</kml>
```

Responde `"sistemaOrigen": "WGS84"`, `"superficieHa": 17.6138` y un aviso de que está a 2,9 km del
Canal Sur. Si en `<coordinates>` se ponen las coordenadas en POSGAR:

```
3573500,7025200 3573900,7025200 3573900,7024800 3573500,7024800 3573500,7025200
```

responde `"sistemaOrigen": "POSGAR_FAJA3"` y `"superficieHa": 16` (un cuadrado de 400 × 400 m = 16 ha
exactas). Es la prueba de que **las coordenadas reales del KML se leen en cualquiera de los dos sistemas**.

Y en la base, directamente:

```bash
docker exec -it drh-postgres psql -U drh -d drh_nuevo
```
```sql
-- De dónde salió cada polígono
SELECT origen, sistema_origen, archivo_nombre, superficie_ha FROM con_poligono WHERE vigente;

-- Las coordenadas guardadas (POSGAR) y en lat/long
SELECT concesion_id, ST_AsText(geom), ST_AsText(ST_Transform(geom, 4326)) FROM con_poligono LIMIT 1;
```

---

## PARTE 4 — Front: cómo llega al mapa

### Paso 10. El proxy de Vite

**Archivo:** [Proyecto En React - Full/vite.config.ts](Proyecto%20En%20React%20-%20Full/vite.config.ts)

El front siempre llama a `/api/...`. Vite reparte:

| Ruta | Va a |
|---|---|
| `/api/sig/*` | **Backend real** (NestJS, puerto 3000) ← el visor |
| `/backend/*` | Backend real (Alta de Concesión, expedientes…) |
| `/api/events` | Eventos en vivo (puerto 3002) |
| `/api/*` (lo demás) | json-server (puerto 3001, los módulos que todavía no migraron) |

El orden importa: `/api/sig` va **antes** que `/api`, si no se lo llevaría json-server.

### Paso 11. El cliente HTTP

**Archivo:** [Proyecto En React - Full/src/services/api/client.ts](Proyecto%20En%20React%20-%20Full/src/services/api/client.ts)

Un `axios` con base `/api`. En **modo demo** (`npm run demo`) las rutas `/sig/*` las responde un
emulador del navegador ([src/services/demo/servidor/sig.ts](Proyecto%20En%20React%20-%20Full/src/services/demo/servidor/sig.ts))
en vez del backend. Con `npm run dev` van al backend real.

### Paso 12. Las funciones que piden cada capa

**Archivo:** [Proyecto En React - Full/src/features/visor/api.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/api.ts)

```ts
async concesiones(recuadro?: Recuadro): Promise<CapaConcesiones> {
  const { data } = await api.get<CapaConcesiones>('/sig/concesiones', { params: ... })
  return data
}
```

Los tipos (qué propiedades trae cada concesión) están en
[src/features/visor/types.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/types.ts):
`CapaConcesiones = FeatureCollection<MultiPolygon, AtributosConcesion>`.

Para el análisis de un archivo (comparar / alta):
[src/services/sig.ts](Proyecto%20En%20React%20-%20Full/src/services/sig.ts) → `analizarArchivoGeografico(archivo)`
arma un `FormData` con el campo `archivo` y hace `POST /sig/kml/analizar`.

### Paso 13. Los hooks de React Query

**Archivo:** [Proyecto En React - Full/src/features/visor/hooks.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/hooks.ts)

`useCapaConcesiones()`, `useCapaPozos()`, `useCapaPuntos()`, `useCapaCauces()`:
- guardan la respuesta en caché 1 minuto (`staleTime: 60_000`);
- **vuelven a pedir la capa al volver a la pestaña** (`refetchOnWindowFocus`): si otro usuario cargó un
  KML, aparece solo.
- Los cauces casi no cambian: `staleTime: Infinity`.

### Paso 14. La página del visor

**Archivo:** [Proyecto En React - Full/src/features/visor/pages/VisorPage.tsx](Proyecto%20En%20React%20-%20Full/src/features/visor/pages/VisorPage.tsx)

- Llama a los hooks y obtiene las capas.
- Aplica los filtros ([filtros.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/filtros.ts)) y
  los colores ([colores.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/colores.ts)).
- La concesión seleccionada queda en la URL (`/visor?concesion=2`), así el enlace se puede compartir.
- `comparar(archivo)`: manda el KML a analizar y guarda el resultado para dibujarlo en rojo.
- Arma los paneles (capas, fondos, resultados, ficha, comparar archivo).

La ruta `/visor` se registra en [src/config/routes.ts](Proyecto%20En%20React%20-%20Full/src/config/routes.ts)
y el menú en [src/config/navigation.ts](Proyecto%20En%20React%20-%20Full/src/config/navigation.ts).

### Paso 15. El mapa (Leaflet)

**Archivo:** [Proyecto En React - Full/src/features/visor/components/MapaConcesiones.tsx](Proyecto%20En%20React%20-%20Full/src/features/visor/components/MapaConcesiones.tsx)

Está organizado en bloques `useEffect` numerados:

1. **Crear el mapa** (línea ~176):
   `L.map(contenedor, { preferCanvas: true }).setView(CENTRO_TUCUMAN, 9)`.
   `preferCanvas` dibuja todo en un solo `<canvas>`: con miles de polígonos es mucho más rápido.
   También muestra la posición del cursor en lat/long y en POSGAR.
2. **Dibujar las concesiones** (línea ~227): acá está la conexión final.
   ```ts
   const geo = L.geoJSON(concesiones, {
     style: (f) => ({ color: colorDe(f.properties), fillOpacity: 0.3, ... }),
     onEachFeature: (f, layer) => { layer.bindTooltip(...).on('click', ...) },
   })
   ```
   `L.geoJSON` recibe **directamente** el GeoJSON que mandó el backend: como ya viene en lat/long,
   no hay que convertir nada.
3. Pozos, puntos, cauces, etiquetas, el polígono de comparación (en rojo), el mapa base
   ([src/components/map/fondos.ts](Proyecto%20En%20React%20-%20Full/src/components/map/fondos.ts)),
   mediciones e «Ir a coordenada», cada uno en su bloque.

La conversión lat/long ↔ POSGAR que se hace en el navegador (cursor, «Ir a coordenada») está en
[src/lib/posgar.ts](Proyecto%20En%20React%20-%20Full/src/lib/posgar.ts) (librería `proj4`).

---

## PARTE 5 — Receta: agregar una capa nueva al visor

Por ejemplo, «parcelas de catastro». Siguiendo los mismos pasos:

1. **Base:** tabla con columna `geometry(..., 5345)` e índice espacial.
2. **Vista** `sig.v_parcelas` con la geometría y los datos que se quieran mostrar (como el paso 3).
3. **Backend:** método en `CapasService` que arme el FeatureCollection con `json_build_object` +
   `ST_Transform(geom, 4326)` (paso 9), y un `@Get('parcelas')` en `SigController` (paso 8).
4. **Front:** función en `visor/api.ts`, hook en `visor/hooks.ts`, tipo en `visor/types.ts`
   (pasos 12 y 13).
5. **Mapa:** un bloque `useEffect` en `MapaConcesiones.tsx` con `L.geoJSON(...)` (paso 15) y la capa en
   la sección que corresponda del catálogo ([catalogo.ts](Proyecto%20En%20React%20-%20Full/src/features/visor/catalogo.ts));
   el panel ([PanelCapas.tsx](Proyecto%20En%20React%20-%20Full/src/features/visor/components/PanelCapas.tsx)) la muestra sola.
   Si la capa ya está en el GeoServer de la DRH, alcanza con sumarla a `capasDrh.ts` y al catálogo
   (sin pasos 1 a 4): sale de la copia local que arma `npm run sig:copiar`.
6. **Modo demo:** sumar la ruta al emulador ([src/services/demo/servidor/sig.ts](Proyecto%20En%20React%20-%20Full/src/services/demo/servidor/sig.ts)).

El proxy no se toca: `/api/sig/*` ya va al backend.

---

## Pendiente: Argenmap

El visor de producción de la DRH es **Argenmap**. Las vistas del esquema `sig` (`v_concesiones`,
`v_pozos`, `v_puntos`) están pensadas para publicarse como capas WMS/WFS (por ejemplo con GeoServer)
y que Argenmap las lea directo de PostGIS, igual que hoy las lee QGIS. Falta definir cómo está
instalado Argenmap para hacer esa vinculación.
