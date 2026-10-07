# Trámite: Baja de Pozo

Baja de una perforación registrada. Se busca el pozo (por concesión, expediente, titular,
documento, ID, alias o ubicación), se abre su vista y se elige una de dos formas.

## Baja de oficio — directa, sin trámite

La DRH ya sabe que el pozo no existe o no funciona. Un usuario de Pozos carga el motivo (y la
inspección, si la hubo) y el pozo queda dado de baja en el acto: sin expediente, sin pasar por
otras oficinas, sin resolución y sin clausura. Distrito recibe el aviso para tomar conocimiento.

## Baja a solicitud del titular — con expediente

```
POZOS (mesa de entrada) ── documentación ──► POZOS ── antecedentes ──► POZOS ── evaluación técnica ──► JURÍDICO ──► SECRETARÍA GENERAL ──► POZOS ──► FINALIZADO
      │ falta documentación                                                 │ requiere subsanación    │ observado    │ resolución          (clausura física,
      ▼                                                                     ▼                         ▼              │ aprueba / rechaza    solo si corresponde)
   EN ESPERA (se reanuda al completarla)                    EN ESPERA (se reanuda al subsanar)   corrección en Pozos │
                                                                                                  y vuelve a Jurídico ▼
                                                                                    aprobada: pozo en BAJA, concesión anulada (si se decidió),
                                                                                              aviso a Distrito (toma conocimiento, no frena)
```

| Paso | Oficina | Qué se hace |
|------|---------|-------------|
| 1. Mesa de entrada | Pozos | Registra el expediente, el solicitante y el checklist de documentación. **Completa** → antecedentes; **pendiente** → el expediente queda EN ESPERA hasta completarla |
| 2. Antecedentes | Pozos | La pantalla muestra lo que la DRH ya tiene: perforación, titular, ubicación, concesión, **tasa de uso del agua** (deudas de los titulares) y trámites anteriores. Pozos los da por verificados |
| 3. Evaluación técnica | Pozos | Inspección (sí/no, fecha), informe técnico y **si corresponde la clausura física**. **Favorable** → Jurídico; **requiere subsanación** → EN ESPERA hasta que se subsane y se vuelva a evaluar |
| 4. Dictamen | Jurídico | Aspectos legales y, si el pozo abastece una concesión, **si se anula también** (con la tasa a la vista). Apto / observado (vuelve a Pozos) / no apto (rechazo) |
| 5. Resolución | Secretaría General | Acto administrativo que **aprueba o rechaza** (el rechazo exige el motivo). Al aprobar: pozo en BAJA y desvinculado de la concesión; concesión ANULADA si se decidió; aviso a Distrito |
| 6. Clausura física | Pozos | Solo si la evaluación técnica dijo que corresponde: fecha y acta. Recién ahí FINALIZA. Baja administrativa ≠ pozo clausurado |
| — Toma de conocimiento | Distrito | Distrito maneja agua superficial: **no dictamina**. Ve las bajas aprobadas en su bandeja y marca «tomé conocimiento» (queda en el historial); no frena el trámite |

Fuentes: CU «Baja de pozo» (`Documentacion/Documentacion PH.txt`), tabla `poz_baja` de
`Documentacion/esquema_drh.sql`, el flujo publicado por la DRH y lo que definió la oficina.

## Reglas

- **La baja es lógica**: el pozo pasa a estado `BAJA` y se conserva todo su registro técnico.
  `poz_baja` guarda el estado y la concesión que tenía el pozo antes.
- **Una baja sin resolver por pozo** (índice único parcial `uk_baja_pozo_sin_resolver`: en
  trámite, en espera u observada). Un pozo dado de baja o anulado no admite otra.
- **A solicitud** exige solicitante y expediente; **de oficio** no lleva ninguno (`chk_baja_expediente`).
- Pozos inicia y hace la baja de oficio; solo Distrito toma conocimiento.
- El expediente tiene que ser del año en curso (misma regla que el alta).
- Mismas reglas de circuito que el alta: cada acción en su etapa, **tomar antes de actuar**,
  solo la oficina donde está el expediente, y todo queda en el historial.
- Antes de aprobar, Secretaría verifica en el historial: documentación completa, antecedentes,
  evaluación favorable y dictamen apto (la última actuación de cada uno).
- **Documentación:** la lista (`DOCUMENTOS_BAJA` en `pozos.constantes.ts`) es PROVISORIA, a
  confirmar con la oficina; después pasa a un catálogo.

## Estados

| Baja (`poz_baja.estado`) | Expediente | Se ve como |
|---|---|---|
| `EN_TRAMITE` | `EN_TRAMITE` | Iniciado / en análisis |
| `EN_ESPERA` | `EN_ESPERA` | Pendiente de documentación o de subsanación |
| `OBSERVADA` | `OBSERVADO` | Jurídico pidió correcciones |
| `CLAUSURA_PENDIENTE` | `EN_TRAMITE` (en Pozos) | Aprobada, falta la clausura física |
| `CONFIRMADA` | `FINALIZADO` | Aprobada (y clausurada, si correspondía) |
| `RECHAZADA` | `RECHAZADO` | Rechazada (Jurídico no apto o resolución de rechazo) |

## Endpoints (`:id` = id del expediente)

| Método | Ruta | Oficina | Qué hace |
|--------|------|---------|----------|
| GET | `/api/pozos?q=` | — | Busca pozos (concesión, expediente, titular, documento, ID, alias, ubicación) |
| GET | `/api/pozos/:id` | — | Ficha del pozo: concesión, expedientes, baja en trámite o aprobada |
| GET | `/api/tramites/baja-pozo[?todas=true]` | — | Bajas sin terminar (o todas) |
| GET | `/api/tramites/baja-pozo/documentos` | — | Checklist de documentación |
| GET | `/api/tramites/baja-pozo/:id` | — | Expediente, datos de la baja, ficha del pozo y deuda de la tasa |
| POST | `/api/tramites/baja-pozo/de-oficio/:pozoId` | Pozos | **Baja de oficio en el acto** |
| POST | `/api/tramites/baja-pozo` | Pozos | Baja a solicitud: pozo, expediente, motivo, solicitante, documentación |
| PUT | `/api/tramites/baja-pozo/:id` | Pozos | Corrige la solicitud y el checklist |
| POST | `…/:id/documentacion` | Pozos | `COMPLETA` / `PENDIENTE` |
| POST | `…/:id/antecedentes` | Pozos | Antecedentes verificados |
| POST | `…/:id/evaluacion-tecnica` | Pozos | `FAVORABLE` / `REQUIERE_SUBSANACION` + inspección, informe, clausura |
| POST | `…/:id/reenviar` | Pozos | Después de corregir lo observado, vuelve a Jurídico |
| POST | `…/:id/juridico` | Jurídico | `APTO` / `OBSERVADO` / `NO_APTO` + `anularConcesion` |
| POST | `…/:id/resolucion` | Secretaría | `APROBAR` / `RECHAZAR` + número, año, fecha |
| POST | `…/:id/clausura` | Pozos | Fecha y acta de la clausura física → FINALIZADO |
| GET | `/api/tramites/baja-pozo/avisos-distrito[?todos=true]` | — | Bajas aprobadas para que Distrito tome conocimiento |
| POST | `/api/tramites/baja-pozo/avisos-distrito/:bajaId/visto` | Distrito | Tomó conocimiento |

Tomar e historial: `POST /api/expedientes/:id/tomar` y `GET /api/expedientes/:id/historial`.

## Probarlo

```bash
bash requests/baja-pozo/circuito-completo.sh   # con la API corriendo y los datos demo cargados
```

Recorre todos los caminos con los usuarios de prueba (7 Pozos, 4 Distrito, 5 Jurídico,
6 Secretaría). Da de baja pozos de prueba: `npm run demo:borrar && npm run demo:cargar` los
vuelve a dejar como estaban.

## Pendiente

- Confirmar la lista de documentación con la oficina y pasarla a catálogo.
- Adjuntar archivos al expediente (nota, actas, fotos de la inspección, resolución firmada).
- La anulación de la concesión desde la baja solo cambia su estado a `ANULADA`; el resto de la
  anulación (titulares, cese de la tasa en Rentas) es del trámite de Anulación.
