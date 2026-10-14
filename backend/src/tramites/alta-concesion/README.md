# Trámite: Alta de Concesión

Registro de una concesión nueva de uso de agua. El trámite **empieza con un expediente en
papel**: Catastro lo registra en el sistema, carga sus datos y lo hace circular por las
oficinas. Recién con el visto bueno de todas, y con el padrón de Rentas, el trámite finaliza.

```
        ┌──────── CORRECCIÓN (Catastro) ◄──── observado ────┐
        ▼                                                   │
CARGA (Catastro) → RECAUDACIÓN → DISTRITO → JURÍDICO → SECRETARÍA GENERAL → CIERRE (Catastro) → ESPERA DEL PADRÓN → FINALIZADO
                       │             │          │              │  ▲
                 con deuda:      no apto:   no apto:     pide N° │  │ Catastro lo carga
                 EN ESPERA       RECHAZADO  RECHAZADO    de concesión (libro «Petete»)
                 (+ aviso por correo)
```

Fuentes: `infotecnica.md` §6.2, `Documentacion/esquema_drh.sql` y lo que contó la oficina.

## Cómo se modela

| Tabla | Qué guarda |
|-------|------------|
| `exp_expediente` | La carátula: número, **etapa**, **estado**, oficina actual y **quién lo tiene tomado** |
| `exp_movimiento` | Cada **pase**: de qué oficina a cuál, quién lo envió y cuándo, **quién lo tomó y cuándo** |
| `exp_actuacion` | Lo que **resolvió cada oficina**: con/sin deuda, apto/no apto/observado, resolución, padrón |
| `exp_resolucion` | Resoluciones de Secretaría General (número/año único) |
| `exp_solicitud_numero` | Pedido del número de concesión: Secretaría lo pide, Catastro lo carga |
| `not_email` | Cada correo enviado (ej: aviso de deuda), con su resultado |
| `per_persona` | **Titulares únicos por documento**: si ya existe, se reutiliza |
| `rec_deuda` | Deudas **de la persona** (no del expediente) |
| `seg_oficina`, `seg_usuario` | Oficinas y usuarios: firman cada pase y cada actuación |
| `con_concesion` | Lo que identifica a la concesión y no cambia: número, estado, expediente, resolución, situación legal |
| `con_titular`, `con_domicilio` | Titulares (personas) y domicilios legales del titular |
| `con_inmueble` + `con_poligono` | Ubicación de la concesión (catálogo) + parcela (catastral y registral) y el polígono dibujado |
| `con_condicion` | Caudal asignado, carácter, código de servicio y período |
| `con_uso`, `con_punto`, `con_suministro` | Usos con su caudal, desagüe / punto de entrega y la cascada de suministro |
| `cat_departamento`, `cat_localidad`, `cat_distrito` | Catálogo de ubicación: el domicilio y la ubicación guardan los ids |
| `cat_suministro_zona`, `_opcion`, `_canal` | Catálogo de suministro de la DRH: fuentes, sistemas, desagües y el **árbol de canales** de cada ubicación. El paso 6 se valida contra él |

**Historial de la concesión.** Todas las tablas `con_*` que un trámite posterior puede cambiar guardan
versiones (`vigente`, `desde`, `hasta`, `expediente_id`): nada se pisa. Mientras el alta está en carga, lo
cargado es una propuesta del mismo expediente y se reemplaza al guardar; cuando se otorga, todo pasa a
regir desde la fecha de la resolución. La API devuelve solo lo vigente, con los nombres del catálogo.

El **historial del expediente** es la unión ordenada de pases y actuaciones: `GET /api/expedientes/:id/historial`.

## Reglas del circuito

- **No se saltea ninguna oficina.** Cada acción solo se puede hacer en su etapa, y el único camino a la
  finalización pasa por todas. Al finalizar, además, se verifica en el historial que estén todos los
  visto bueno.
- **Tomar antes de actuar.** Cuando el expediente llega a una oficina, alguien de esa oficina lo **toma**
  (`POST /api/expedientes/:id/tomar`). A partir de ahí actúa esa persona, y queda registrado quién lo recibió y cuándo.
- **Solo la oficina donde está.** Un usuario de otra oficina recibe 403.
- **Usuario que actúa.** Mientras no haya login, se indica con el encabezado `X-Usuario-Id`. Los
  usuarios de prueba (`GET /api/usuarios`) son: 2 Catastro, 3 Recaudación, 4 Distrito, 5 Jurídico, 6 Secretaría.

## Paso a paso

### Catastro: carga (`etapa CARGA`)

| Paso | Endpoint | Validaciones |
|------|----------|--------------|
| 1. Inicio | `POST /api/tramites/alta-concesion` | **Expediente único** (409 si el número ya existe), del año en curso; checklist de la situación legal |
| 2. Titulares | `PUT /:id/titulares` | **Persona única por documento**: si ya está cargada, se usa la misma y se actualizan sus datos. Para precargar el formulario: `GET /api/personas?documento=…` (devuelve datos, concesiones y deudas). Cada domicilio legal se valida contra el catálogo de ubicación (400 si la localidad no es del departamento o el distrito no es el de la localidad) |
| 3. Ubicación de la concesión | `PUT /:id/ubicacion` (multipart) | Departamento / localidad / distrito **obligatorios y del catálogo**. KML/GeoJSON **optativo en la carga y obligatorio para la verificación final**: si viene, PostGIS lo valida y **409 si el polígono coincide ≥ 90 % con otra concesión** (duplicada). Un GeoJSON que declara su sistema de coordenadas (`crs`) se transforma desde ese sistema (ej: Campo Inchauspe); si declara uno y los números son de otro, 400. Avisos (no rechazan): sistema en que vino, río lejano, número de concesión del archivo distinto, puntos de desagüe/entrega lejos |
| 4. Inmueble | `PUT /:id/inmueble` | **409 si la matrícula catastral ya tiene otra concesión activa** |
| 5. Usos | `PUT /:id/usos` | Caudal = magnitud × dotación. Devuelve `avisos` si el desagüe o el punto de entrega quedan a más de 1 km del polígono (suele ser una coordenada mal tipeada) |
| 6. Suministro | `PUT /:id/suministro` | Necesita la ubicación (paso 3). Cada fuente, el sistema y el desagüe tienen que estar en el **catálogo de suministro de esa ubicación**, y los canales tienen que ser un **camino del árbol** (el secundario deriva del principal elegido, y así hasta el quinto). Si la ubicación no tiene catálogo, solo se cargan observación y caudal |
| Envío | `POST /:id/enviar` | Todos los pasos completos, el suministro todavía válido para la ubicación (pudo cambiar después) y sin duplicados → **Recaudación** |

### Recaudación (`etapa RECAUDACION`)

Se verifica si los titulares del alta tienen **otras concesiones otorgadas** (VIGENTES) y si alguna
tiene **deuda**. Tener otra concesión solo se informa; lo único que frena el alta es la deuda. Por
ahora la deuda es **sí / no** (sin monto) y queda ligada **a la concesión y a todos sus titulares
vigentes** (una fila de `rec_deuda` por titular, con `concesion_id`).

- `GET /:id/recaudacion`: los titulares del alta, sus concesiones otorgadas (con todos sus titulares y
  `tieneDeuda`) y las deudas de antes registradas sin concesión.
- `POST /:id/recaudacion` (`{ "concesiones": [{ "concesionId", "tieneDeuda" }], "observaciones"? }`): una
  respuesta por **cada** concesión del GET (vacío si no tienen otras). El resultado sale de las respuestas:
  - **Ninguna con deuda:** pasa a **Distrito**.
  - **Alguna con deuda:** se registra la deuda (concesión + titulares) y el expediente queda **EN ESPERA**
    en Recaudación, **sin plazo**. No es un rechazo. En espera, Recaudación puede volver a responder: si
    marca que la concesión ya no tiene deuda, se cancela y el expediente se reanuda y pasa a Distrito.
- **Aviso por correo:** `POST /:id/recaudacion/notificar-deuda` (`{ "observaciones" }` opcional) manda a cada
  titular con deuda pendiente un correo con el detalle de SUS deudas. Los que no tienen correo cargado se
  informan en la respuesta. Cada envío queda en `not_email` (`GET /api/expedientes/:id/emails`) y en el
  historial. Sin servidor de correo configurado (`SMTP_HOST`), se registra como «modo prueba» y no sale.
- **Pago:** `POST /api/deudas/:id/cancelar` (`{ "comprobante" }`) cancela la deuda. Los expedientes en
  espera **se reanudan solos** cuando ningún titular debe nada; después, Recaudación da el "sin deuda".

### Distrito y Jurídico (`etapas DISTRITO y JURIDICO`)

`POST /:id/distrito` y `POST /:id/juridico`, con `{ "resultado": "APTO" | "OBSERVADO" | "NO_APTO", "observaciones" }`:

- **APTO:** pasa a la etapa siguiente.
- **OBSERVADO:** el motivo es obligatorio. **Vuelve a Catastro** (etapa CORRECCION, estado OBSERVADO).
  Catastro lo toma, corrige con los mismos `PUT` y lo reenvía con `POST /:id/reenviar`. El expediente
  **vuelve a la oficina que lo observó**, sin empezar de nuevo el circuito.
- **Si al corregir cambiaron los titulares** (hay alguna persona que Recaudación no verificó), al reenviar
  pasa **primero por Recaudación**, que verifica la deuda (con deuda queda en espera, como siempre), y con el
  «sin deuda» vuelve a la oficina que observó. Para saberlo, cada «sin deuda» guarda a quiénes verificó.
- **NO_APTO:** el motivo es obligatorio. El trámite termina: expediente **RECHAZADO** y concesión **DENEGADA**
  (deja de verse en el visor y en QGIS).

### Secretaría General (`etapa SECRETARIA_GENERAL`)

Con el visto bueno del director:

1. `POST /:id/numero-concesion`: **pide** el número de concesión a Catastro. Pedirlo dos veces no crea otro
   pedido. El expediente no se mueve: sigue en Secretaría.
2. **Catastro**, desde su bandeja (`GET /api/solicitudes-numero?estado=PENDIENTE`), toma el número de su libro
   de concesiones («Petete») y lo carga: `POST /api/solicitudes-numero/:id/asignar` (`{ "numeros": ["4521"] }`).
   Se controla que sea un número, sin repetir y que no lo tenga otra concesión; los ceros a la izquierda se
   quitan. Como referencia, `GET /api/solicitudes-numero/ultimo-numero` da el último registrado.
3. `POST /:id/resolucion`: carga la resolución (`{ "numero", "anio", "fecha" }`, el número lo lleva Secretaría),
   con número/año único. **Necesita el número de concesión ya cargado por Catastro.** La resolución queda
   enlazada a la concesión y el expediente pasa a **Catastro** para el cierre, ya con número y resolución.

### Catastro: cierre (`etapas CIERRE y ESPERA_PADRON`)

1. En la etapa CIERRE, Catastro **solo completa lo que falta** con los mismos `PUT` de la carga. Lo que ya tiene
   valor es lo que aprobó la resolución y no cambia (409 con la lista de campos):
   - titulares y domicilios: los mismos (de cada persona se completan los datos vacíos y se actualizan correo y teléfono);
   - ubicación y polígono: la misma ubicación; el polígono se puede cargar **solo si faltaba**;
   - usos, caudal y puntos de desagüe y entrega: no se modifican;
   - inmueble y suministro: se completan los campos vacíos.
2. `POST /:id/verificacion-final`: revalida la carga, **exige el polígono** (así toda concesión otorgada se ve en el
   visor y en QGIS) y el trámite queda **esperando el padrón de Rentas**.
3. `POST /:id/padron` (`{ "padron" }`): carga el padrón cuando llega (suele demorar 30 a 60 días). Hay
   que tener el visto bueno de todas las oficinas (Recaudación, Distrito, Jurídico, número de concesión,
   resolución y verificación final), y el padrón no puede estar usado por otra concesión.
   Resultado: **expediente FINALIZADO, concesión VIGENTE** y todo lo cargado (titulares, ubicación, **polígono**,
   usos, suministro) rige desde la fecha de la resolución.

### El archivo del polígono y el visor

- `GET /api/sig/poligonos/:id/archivo`: descarga el KML/GeoJSON **original** que se presentó (el id viene en
  `ubicacion.poligono.id`). Se comprueba con su hash SHA-256 que no se haya modificado en el disco.
- `GET /api/sig/concesiones/:concesionId/kml`: el polígono vigente como KML, para Google Earth o un GPS.
- `GET /api/sig/concesiones/:concesionId`: la concesión en la capa del visor (`poligono_desde` = fecha de la resolución).
- `POST /api/sig/kml/analizar`: vista previa sin guardar; devuelve también `numerosConcesion` si el archivo los trae.

## Probar el circuito completo

```bash
bash requests/alta-concesion/circuito-completo.sh
```

El script recorre el alta oficina por oficina con los usuarios de prueba y verifica 100 reglas. Incluye
deuda (espera, aviso por correo y reanudación), observación y reenvío, **cotitular agregado al corregir (vuelve a
Recaudación)**, pedido y carga del número de concesión, duplicados, titular reutilizado, ubicación fuera del
catálogo, **descarga del archivo original**, **puntos lejos del polígono**, **suministro fuera del árbol** y **sin
catálogo**, **cierre «solo completar»**, **polígono obligatorio en la verificación final**, **GeoJSON en Campo
Inchauspe** y rechazo. Se puede correr las veces que se quiera.

Las reglas puras (sin base de datos) tienen además pruebas unitarias: `npm test`
(`validaciones/*.spec.ts`, `../circuito/validaciones/circuito.spec.ts`, `catalogos/suministro/arbol-suministro.spec.ts`
y `sig/kml/archivo-geografico.spec.ts`).

## Pendiente

- Archivos adjuntos: informe de Distrito, dictamen de Jurídico y PDF de la resolución (la infraestructura
  de archivos ya existe, `ArchivosService`).
- "Soltar" un expediente tomado (hoy, si lo tiene otra persona de la oficina, hay que esperar a que lo pase).
- Login: `X-Usuario-Id` pasa a salir de la sesión.
- Frontend: conectar las pantallas de cada oficina a estos endpoints (hoy usan json-server).

## Organización del código

```
tramites/alta-concesion/
├── dto/                               forma de los datos que llegan (class-validator), una clase por sección
├── validaciones/                      reglas chicas y puras, una función por regla (con pruebas unitarias)
│   ├── inicio.validaciones.ts         exigirAnioEnCurso, exigirDocumentosDeLaSituacion
│   ├── titulares.validaciones.ts      exigirDocumentosSinRepetir
│   ├── inmueble.validaciones.ts       exigirAnioDominioNoFuturo
│   ├── usos.validaciones.ts           exigirPeriodoValido, exigirUsosSinRepetir, exigirUsosDelCatalogo, exigirPuntoEntregaSiCorresponde
│   ├── suministro.validaciones.ts     exigirCascadaEnOrden (el árbol: catalogos/suministro/arbol-suministro.ts)
│   └── cierre.validaciones.ts         exigirSoloCompletar, exigirSinCambios (después de la resolución)
├── pasos/                             un service por pestaña de la carga en Catastro
│   ├── paso1-inicio.service.ts        InicioAltaService
│   ├── paso2-titulares.service.ts     TitularesAltaService
│   ├── paso3-ubicacion.service.ts     UbicacionAltaService
│   ├── paso4-inmueble.service.ts      InmuebleAltaService
│   ├── paso5-usos.service.ts          UsosAltaService
│   └── paso6-suministro.service.ts    SuministroAltaService
├── alta-concesion.service.ts          lo común: consultar, exigirEditable, guardarEnVigente
├── alta-circuito.config.ts            lo propio del alta en el circuito (AltaCircuitoConfig)
├── alta-circuito.service.ts           llama a cada oficina (tramites/circuito/) y devuelve el alta
├── alta-concesion.respuesta.ts        arma la respuesta (misma forma que usa el frontend)
└── alta-concesion.controller.ts       endpoints
```

Cada función cuenta su proceso con comentarios numerados (`//1.- …`, `//2.- Se valida que…`).

**El circuito por las oficinas es común a todos los trámites** (`tramites/circuito/`): un service por oficina
(envío, Recaudación, Distrito/Jurídico, número de concesión, resolución, cierre). Lo propio del alta (a quién se
le verifica la deuda, qué pasa con la concesión al rechazarse, al asignarle número, al resolverse y al
finalizar) está en `AltaCircuitoConfig`. Cambio de titularidad, anulación y los demás solo escriben su
configuración. La mecánica del expediente (tomar, pasar, actuar, historial, bandejas) está en `expedientes/`.
