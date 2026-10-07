# Ver las concesiones en QGIS

Las concesiones dibujadas (los KML que carga Catastro) se guardan en PostGIS. QGIS se
conecta **directo a la base** y las muestra como una capa más, siempre actualizada: no hay
que exportar nada.

## 1. Datos de conexión

| Campo | Valor (desarrollo) |
|-------|--------------------|
| Host | `localhost` (o la IP del servidor) |
| Puerto | `5433` |
| Base de datos | `drh_sistema` |
| Usuario | `drh_lector_sig` |
| Clave | la que se definió al crear el usuario (en desarrollo: `lector_dev`) |

El usuario `drh_lector_sig` **solo puede leer** el esquema `sig`. No ve las tablas internas
ni puede modificar nada. Se crea o actualiza con:

```bash
docker exec -i drh-postgres psql -U drh -d drh_sistema -v clave="'LA_CLAVE'" < sql/rol-lector-sig.sql
```

## 2. Conectar QGIS (una sola vez)

1. **Capa → Administrador de fuentes de datos → PostgreSQL → Nueva**.
2. Completar nombre (ej: `DRH`), host, puerto y base. En **Autenticación → Básica**, el usuario y la clave.
3. **Probar conexión → Aceptar**.
4. En el árbol de la conexión, abrir el esquema **sig** y agregar **v_concesiones**.
   Si QGIS pide la clave única, elegir **`poligono_id`**.

## 3. La capa `sig.v_concesiones`

Una fila por concesión con polígono vigente (no incluye las anuladas).

| Campo | Qué es |
|-------|--------|
| `poligono_id` | Clave única de la fila |
| `concesion_id`, `numero` | Concesión (el número queda vacío mientras está en trámite) |
| `estado` | `EN_TRAMITE`, `VIGENTE`, `MODIFICADA`… |
| `expediente`, `oficina_actual` | Expediente que la tramita y dónde está ahora |
| `titular`, `documento`, `cantidad_titulares` | Titulares vigentes (si hay varios, separados por " / ") |
| `departamento`, `localidad`, `distrito` | Ubicación administrativa |
| `padron`, `matricula_catastral`, `parcela` | Datos catastrales |
| `superficie_ha` | Superficie calculada por PostGIS sobre el polígono |
| `caudal_lps`, `caracter`, `usos` | Caudal asignado y usos |
| `origen_poligono`, `poligono_desde` | Qué trámite cargó el polígono y cuándo |

**Sistema de referencia: POSGAR 2007 / Argentina 3 (EPSG:5345).** Es el oficial para Tucumán:
las mediciones de QGIS (áreas, distancias) dan en metros reales. QGIS reproyecta solo si el
proyecto está en otro sistema (por ejemplo, para superponer Google Satellite en EPSG:3857).

## 3 bis. La capa `sig.v_pozos`

Un punto por pozo (no incluye los anulados). Clave única: **`pozo_id`**.

| Campo | Qué es |
|-------|--------|
| `id_interno`, `alias` | Identificación del pozo |
| `estado`, `origen`, `tipo_pozo` | `EN_USO`, `PARADO`…; `AUTORIZACION`, `OFICIO` o `MIGRACION` |
| `profundidad_m`, `nivel_estatico_m`, `nivel_dinamico_m` | Datos técnicos (niveles negativos: bajo el suelo) |
| `caudal_m3h`, `caudal_lps` | Caudal de bombeo (l/s lo calcula la base: m³/h ÷ 3,6) |
| `coord_x`, `coord_y` | Coordenadas POSGAR 07 (las de los papeles) |
| `concesion_id`, `concesion_numero`, `titular` | Concesión que abastece |
| `dentro_de_concesion` | `false` si el pozo cae fuera del polígono de su concesión: hay que revisar la carga |

Para encontrar los pozos a revisar: filtro `"dentro_de_concesion" = false`.

## 3 ter. La capa `sig.cauce`

Ríos y canales (líneas, EPSG:5345): `nombre` (vacío en arroyos y acequias sin nombre), `tipo`
(`RIO` o `CANAL`), `fuente` (hoy `OpenStreetMap`) y `largo_km`. Se carga con `npm run sig:cauces`.

## 4. Sugerencias de uso

- **Simbología por estado:** Propiedades → Simbología → *Categorizado* por `estado`.
- **Etiquetas:** `coalesce("numero", 'Exp. ' || "expediente")`.
- **Fondo:** XYZ Tiles de Argenmap (IGN):
  `https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png`
- **Cruces con otras capas** (catastro provincial, cuencas, canales): cargarlas en el mismo
  proyecto. Los cruces que tengan que estar en el sistema (por ejemplo, "en qué distrito cae")
  se agregan como vistas nuevas en el esquema `sig`.

## 5. Qué pasa si se edita en QGIS

La capa es una **vista de solo lectura**. Los polígonos se cargan y modifican desde el
sistema (Alta, Ampliación/Reducción, Reubicación), que valida la geometría, guarda el KML
original y conserva el histórico. Así QGIS, el visor web y los trámites muestran siempre lo mismo.

## 6. Otros sistemas web

La misma vista se puede publicar con estándares OGC sin tocar el backend:

- **GeoServer:** almacén PostGIS con el usuario `drh_lector_sig` → publica WMS/WFS (los usan
  IDERA, ArcGIS y cualquier visor OGC).
- **pg_featureserv / pg_tileserv** (Crunchy Data): exponen `sig.*` como OGC API Features y
  vector tiles, con un ejecutable y sin configuración.

El visor de la aplicación usa la API propia: `GET /api/sig/concesiones?bbox=…`, que devuelve GeoJSON en WGS84.
