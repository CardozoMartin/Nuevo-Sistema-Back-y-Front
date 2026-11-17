# Trámite: Cambio de Titularidad

Cambio del titular (o de los cotitulares) de una concesión **vigente**. Catastro busca la
concesión, registra el expediente en papel, carga el nuevo titular y lo hace circular por las
oficinas. Usa el mismo circuito que el alta (`tramites/circuito/`), con dos diferencias: **no pide
número de concesión** (ya lo tiene) y **no espera el padrón de Rentas** (el padrón es del inmueble).

```
        ┌──────── CORRECCIÓN (Catastro) ◄──── observado ────┐
        ▼                                                   │
CARGA (Catastro) → RECAUDACIÓN → DISTRITO → JURÍDICO → SECRETARÍA GENERAL → CIERRE (Catastro) → FINALIZADO
                       │             │          │         (resolución,         (verificación final:
                 con deuda:      no apto:   no apto:      sin N° de concesión)   la concesión cambia de titular)
                 EN ESPERA       RECHAZADO  RECHAZADO
```

## Regla clave: el nuevo titular es una propuesta hasta el final

Mientras el trámite circula, la concesión **sigue a nombre del titular actual**. Lo cargado por
Catastro queda en `con_cambio_titular` / `con_cambio_domicilio`. Recién en la verificación final
(con todos los vistos buenos y la resolución) se aplica el cambio, sin borrar nada:

1. Los titulares y domicilios vigentes se cierran: `vigente = false`, `hasta` = fecha de la resolución.
2. Los propuestos se insertan en `con_titular` / `con_domicilio` con `desde` = esa fecha y el expediente del cambio.

Así el historial de la concesión conserva la cadena completa de titulares.

## Cómo se modela

| Tabla | Qué guarda |
|-------|------------|
| `con_cambio_titularidad` | Une el expediente del cambio con la concesión. Estado propio (`EN_TRAMITE`, `FINALIZADO`, `RECHAZADO`, `ANULADO`) y la resolución. Índice único parcial: **un solo cambio en trámite por concesión** |
| `con_cambio_titular` | Nuevos titulares propuestos (personas de `per_persona`, el orden 0 es el principal) |
| `con_cambio_domicilio` | Domicilios legales propuestos (mismos datos que `con_domicilio`) |

La concesión apunta al expediente de su **alta**; por eso los trámites posteriores necesitan
su propia tabla para saber sobre qué concesión se tramitan. `ExpedientesService.distritosDe`
también la usa: el jefe de Distrito solo trabaja los cambios de las concesiones de su distrito.

## Reglas

- Solo sobre una concesión `VIGENTE` y **sin otro trámite en curso** (`CambioTitularidadService.tramiteEnCurso`).
- Lo inicia Catastro. El expediente tiene que ser del año en curso y su número no puede estar usado (igual que el alta).
- Los nuevos titulares **no pueden ser exactamente los actuales** (un DNI y el CUIL/CUIT que lo contiene son la misma persona). Puede quedar un cotitular, entrar uno nuevo o salir uno.
- Para enviar: al menos un nuevo titular y su domicilio legal.
- **Recaudación** verifica la deuda de los titulares **actuales** (la concesión que se transfiere aparece en la lista) **y de los nuevos**.
- **No apto** (Distrito o Jurídico): el cambio queda `RECHAZADO` y la concesión sigue igual.
- Catastro puede **cancelar** un cambio iniciado por error mientras está en la carga: queda `ANULADO` y la concesión queda libre.
- Mismas reglas de circuito que el alta: cada acción en su etapa, **tomar antes de actuar**, solo la oficina donde está el expediente, y todo queda en el historial.

Las reglas puras están en `validaciones/cambio.validaciones.ts`, con sus pruebas en `validaciones/cambio.spec.ts` (`npm test`).

## Permiso

`TITULARIDAD_GESTIONAR` (Catastro): iniciar, cargar, enviar, reenviar, cancelar y verificación final.
Al arrancar el backend entra en la plantilla de Jefe y Operador de Catastro, pero **los usuarios que
ya existían no lo reciben solos**: Informática se lo asigna desde el ABM de usuarios. Recaudación,
Distrito, Jurídico y Secretaría usan sus permisos de siempre.

## Endpoints (`:id` = id del expediente)

| Método | Ruta | Oficina | Qué hace |
|--------|------|---------|----------|
| GET | `/api/tramites/cambio-titularidad[?todos=true]` | — | Cambios en trámite (o todos) |
| GET | `/api/tramites/cambio-titularidad/:id` | — | Expediente, concesión, titulares actuales y propuestos, resolución, aviso de deuda |
| POST | `/api/tramites/cambio-titularidad` | Catastro | Inicia: `{ concesionId, expediente: { numero, reparticion, anio } }` |
| PUT | `…/:id/titulares` | Catastro | Nuevos titulares y domicilios (mismo cuerpo que `PUT /tramites/alta-concesion/:id/titulares`) |
| POST | `…/:id/cancelar` | Catastro | Iniciado por error: `{ observaciones }` (motivo) |
| POST | `…/:id/enviar` | Catastro | A Recaudación |
| POST | `…/:id/reenviar` | Catastro | Después de corregir, a la oficina que observó |
| GET / POST | `…/:id/recaudacion` | Recaudación | Antecedentes de deuda / `{ resultado, concesiones: [{ concesionId, tieneDeuda }] }` |
| POST | `…/:id/recaudacion/curso-con-deuda` | Recaudación | Pasa con deuda, con nota |
| POST | `…/:id/recaudacion/notificar-deuda` | Recaudación | Aviso por correo |
| POST | `…/:id/distrito` | Distrito | `APTO` / `OBSERVADO` / `NO_APTO` |
| POST | `…/:id/juridico` | Jurídico | `APTO` / `OBSERVADO` / `NO_APTO` |
| POST | `…/:id/resolucion` | Secretaría General | `{ numero, anio, fecha }` |
| POST | `…/:id/verificacion-final` | Catastro | Finaliza: la concesión pasa a los nuevos titulares |

Tomar el expediente e historial: `POST /api/expedientes/:id/tomar` y `GET /api/expedientes/:id/historial`.

## Pendiente (para seguir)

1. **Frontend:** conectar `Proyecto En React - Full/src/features/tramites/CambioDeTitularidad/` (`api.ts`, `hooks.ts`) a estos endpoints y sacar json-server (`/borradoresCambioTitularidad`). Hoy el front todavía usa borradores: con el backend real el cambio se crea al iniciar (ya no hay borrador aparte).
2. **Cierre en Catastro:** el prototipo pide completar correo y teléfono del nuevo titular en la carga final. Hoy los datos se editan solo en CARGA y CORRECCIÓN: falta permitir, en CIERRE, completar datos de contacto sin cambiar a las personas (ver `exigirSoloCompletar` en el paso 2 del alta).
3. **Historial de la concesión y búsqueda:** mostrar «cambio de titularidad en curso, sigue a nombre de X» y la cadena de titulares en la consulta de Catastro.
4. **A confirmar con la oficina:**
   - ¿Rentas tiene que intervenir (padrón) o alcanza con la resolución? Hoy finaliza en la verificación final.
   - ¿Hace falta un checklist de documentación al iniciar, como en el alta?
5. **Otros trámites sobre una concesión** (anulación, subdivisión, etc.): cuando se migren, sumarlos a `tramiteEnCurso`.
