# Importar el padrón de concesiones

El importador carga las concesiones **ya otorgadas** (las anteriores al sistema) como
concesiones `VIGENTE` con origen `MIGRACION`. Sirve igual para los datos de prueba y para
los reales: el formato es el de la planilla `BASE_DE_DATOS_LA_AGUADITA.xlsx`.

## Comandos

Se corren desde `backend/`, con la base levantada (`docker compose up -d`).

```bash
npm run demo:cargar                 # genera 154 concesiones ficticias con polígono y las importa
npm run demo:borrar                 # borra todos los lotes de prueba (y solo esos)

npm run migracion -- lotes          # lista los lotes importados
npm run migracion -- importar <archivo.json> --nombre "Padrón La Aguadita" --tabla "Procesado"
npm run migracion -- borrar <loteId>   # solo lotes de prueba
```

Cada importación queda registrada como un **lote** (`mig_lote`), con el detalle de errores y
avisos. Cada concesión importada guarda su **fila original completa** en
`mig_registro_origen`; ahí está la fuente si mañana aparece una discrepancia.

## Formato del archivo

Un arreglo JSON con una fila por concesión. Las columnas son las de la planilla, en camelCase:

| Planilla | JSON | Qué se hace |
|----------|------|-------------|
| Año | `anio` | Año de otorgamiento |
| Monto | `monto` | Se guarda en la fila original (todavía sin columna propia) |
| Otorg. | `otorgamiento` | **Número de concesión y clave de importación** (único) |
| Tipo Otorg. | `tipoOtorgamiento` | CONCESIÓN / DERECHO TRADICIONAL |
| Titulares | `titulares` | Separados por «\|». Se infiere física/jurídica por el nombre (S.A., S.R.L., cooperativa…) |
| Propietarios actuales | `propietariosActuales` | Queda como observación de la concesión |
| Documento / CUIT/ CUIL | `documento` / `cuit` | Solo si hay **un** titular; se valida el dígito verificador |
| Caracter, Cod. Serv. | `caracter`, `codigoServicio` | Código 0 a 5 |
| Uso, Cantidad | `uso`, `cantidad` | Uso con su caudal (cantidad × dotación) |
| Localidad, Departamento, Distrito, Cuenca | ídem | «(SIN LOCALIDAD)» y similares quedan vacíos; «DISTRITO III» → «III» |
| Fuente … Desague | `fuente`, `sistema`, `canalPrincipal` … `desague` | Suministro |
| — | `geometria` | **Opcional**: polígono GeoJSON en WGS84 |

## Reglas

- **Repetible:** una fila que ya se importó se omite (no se duplica). Se puede volver a correr
  el mismo archivo después de corregir errores.
- **Una fila con error no frena al resto:** cada fila va en su propia transacción.
- **Ubicación contra el catálogo:** departamento, localidad, distrito y cuenca se traducen al catálogo
  (`cat_departamento`, `cat_localidad`…). Lo que no está en el catálogo queda vacío y con un aviso
  («Localidad «LULES» no está en el catálogo de LULES: quedó sin localidad»); el texto original sigue
  en `mig_registro_origen`. Antes de importar el padrón real hay que resolver esas diferencias.
- **Un polígono inválido no impide importar la concesión:** se importa sin polígono y queda
  el aviso con el lugar del error (PostGIS lo valida igual que en el alta).
- **Los lotes reales no se borran.** En producción no hay eliminación física: los errores se
  corrigen con trámites. Solo los lotes marcados `--demo` se pueden borrar.

## Datos reales (próximo paso)

La planilla real **no tiene polígonos**. El plan es:

1. **Convertir la planilla a JSON** (hoja «Procesado») e importarla. Las 4.553 concesiones
   quedan con titulares, uso, caudal, ubicación y suministro, sin geometría.
2. **Asociar los polígonos** a medida que estén: KML por concesión (por número de
   otorgamiento), una capa de QGIS o un relevamiento.
3. **Concesiones sin polígono:** mientras tanto se pueden ubicar aproximadamente en el
   centro de su localidad, marcadas como "ubicación aproximada".
