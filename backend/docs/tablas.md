# Tablas de la base `drh_sistema`

> Generado con `npm run db:tablas` el 7/10/2026, 12:52:20. **No editar a mano:** se vuelve a generar.
> Las tablas las crea TypeORM a partir de las entidades (`src/**/entities/*.entity.ts`); ver «Cómo se generan las tablas» en `PROCESOS_BACKEND.md`.

## Catálogos (`cat_`)

### `cat_cuenca`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `activo` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí | '1'::bigint |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `baja_motivo` | text | no |  |  |
| `baja_en` | timestamp with time zone | no |  |  |
| `baja_usuario_id` | bigint | no |  |  |
| `id` | integer | sí | nextval('cat_cuenca_id_seq'::regclass) | PK |
| `nombre` | character varying(120) | sí |  |  |

**Índices**

- `uk_cuenca_nombre`: UNIQUE USING btree (nombre)

**Controles (CHECK)**

- `chk_cuenca_baja`: CHECK ((activo OR ((baja_motivo IS NOT NULL) AND (baja_en IS NOT NULL))))

### `cat_departamento`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `activo` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí | '1'::bigint |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `baja_motivo` | text | no |  |  |
| `baja_en` | timestamp with time zone | no |  |  |
| `baja_usuario_id` | bigint | no |  |  |
| `id` | integer | sí | nextval('cat_departamento_id_seq'::regclass) | PK |
| `nombre` | character varying(80) | sí |  |  |

**Índices**

- `uk_departamento_nombre`: UNIQUE USING btree (nombre)

**Controles (CHECK)**

- `chk_departamento_baja`: CHECK ((activo OR ((baja_motivo IS NOT NULL) AND (baja_en IS NOT NULL))))

### `cat_distrito`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `activo` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí | '1'::bigint |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `baja_motivo` | text | no |  |  |
| `baja_en` | timestamp with time zone | no |  |  |
| `baja_usuario_id` | bigint | no |  |  |
| `id` | integer | sí | nextval('cat_distrito_id_seq'::regclass) | PK |
| `codigo` | character varying(10) | sí |  |  |
| `nombre` | character varying(60) | sí |  |  |

**Índices**

- `uk_distrito_codigo`: UNIQUE USING btree (codigo)

**Controles (CHECK)**

- `chk_distrito_baja`: CHECK ((activo OR ((baja_motivo IS NOT NULL) AND (baja_en IS NOT NULL))))

### `cat_documento_requerido`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | integer | sí | nextval('cat_documento_requerido_id_seq'::regclass) | PK |
| `descripcion` | character varying(200) | sí |  |  |
| `orden` | smallint | sí | '0'::smallint |  |
| `activo` | boolean | sí | true |  |
| `situacion_legal_codigo` | character varying(20) | sí |  | FK → cat_situacion_legal.codigo |

**Índices**

- `uk_documento_requerido`: UNIQUE USING btree (situacion_legal_codigo, descripcion)

### `cat_localidad`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `activo` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí | '1'::bigint |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `baja_motivo` | text | no |  |  |
| `baja_en` | timestamp with time zone | no |  |  |
| `baja_usuario_id` | bigint | no |  |  |
| `id` | integer | sí | nextval('cat_localidad_id_seq'::regclass) | PK |
| `nombre` | character varying(100) | sí |  |  |
| `departamento_id` | integer | sí |  | FK → cat_departamento.id |
| `distrito_id` | integer | sí |  | FK → cat_distrito.id |

**Índices**

- `idx_localidad_distrito`: USING btree (distrito_id)
- `uk_localidad`: UNIQUE USING btree (departamento_id, nombre)

**Controles (CHECK)**

- `chk_localidad_baja`: CHECK ((activo OR ((baja_motivo IS NOT NULL) AND (baja_en IS NOT NULL))))

### `cat_situacion_legal`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `codigo` | character varying(20) | sí |  | PK |
| `nombre` | character varying(60) | sí |  |  |
| `titulo` | character varying(80) | sí |  |  |
| `orden` | smallint | sí | '0'::smallint |  |
| `activo` | boolean | sí | true |  |

### `cat_suministro_canal`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | integer | sí | nextval('cat_suministro_canal_id_seq'::regclass) | PK |
| `nivel` | smallint | sí |  |  |
| `nombre` | character varying(120) | sí |  |  |
| `zona_id` | integer | sí |  | FK → cat_suministro_zona.id |
| `padre_id` | integer | no |  | FK → cat_suministro_canal.id |

**Índices**

- `uk_suministro_canal_hijo`: UNIQUE USING btree (padre_id, nombre) WHERE (padre_id IS NOT NULL)
- `uk_suministro_canal_principal`: UNIQUE USING btree (zona_id, nombre) WHERE (padre_id IS NULL)

**Controles (CHECK)**

- `chk_suministro_canal_nivel`: CHECK ((((nivel >= 1) AND (nivel <= 5)) AND ((padre_id IS NULL) = (nivel = 1))))

### `cat_suministro_opcion`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | integer | sí | nextval('cat_suministro_opcion_id_seq'::regclass) | PK |
| `tipo` | cat_tipo_opcion_suministro | sí |  |  |
| `nombre` | character varying(120) | sí |  |  |
| `zona_id` | integer | sí |  | FK → cat_suministro_zona.id |

**Índices**

- `uk_suministro_opcion`: UNIQUE USING btree (zona_id, tipo, nombre)

### `cat_suministro_zona`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `activo` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí | '1'::bigint |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `baja_motivo` | text | no |  |  |
| `baja_en` | timestamp with time zone | no |  |  |
| `baja_usuario_id` | bigint | no |  |  |
| `id` | integer | sí | nextval('cat_suministro_zona_id_seq'::regclass) | PK |
| `localidad_origen` | character varying(100) | sí |  |  |
| `departamento_id` | integer | sí |  | FK → cat_departamento.id |
| `distrito_id` | integer | sí |  | FK → cat_distrito.id |
| `localidad_id` | integer | no |  | FK → cat_localidad.id |

**Índices**

- `uk_suministro_zona_localidad`: UNIQUE USING btree (localidad_id, distrito_id) WHERE (localidad_id IS NOT NULL)
- `uk_suministro_zona_origen`: UNIQUE USING btree (departamento_id, distrito_id, localidad_origen)

**Controles (CHECK)**

- `chk_suministro_zona_baja`: CHECK ((activo OR ((baja_motivo IS NOT NULL) AND (baja_en IS NOT NULL))))

### `cat_tipo_uso`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `codigo` | character varying(40) | sí |  | PK |
| `nombre` | character varying(80) | sí |  |  |
| `dotacion` | numeric(8,3) | sí |  |  |
| `unidad` | character varying(40) | sí |  |  |
| `requiere_punto_entrega` | boolean | sí | false |  |
| `orden` | smallint | sí | '0'::smallint |  |
| `activo` | boolean | sí | true |  |

**Índices**

- `UQ_a7f97767eb4cbc8103bca04aa61`: UNIQUE (nombre)

## Concesiones (`con_`)

### `con_concesion`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('con_concesion_id_seq'::regclass) | PK |
| `numero` | character varying(20) | no |  |  |
| `origen` | con_origen_concesion | sí | 'SISTEMA'::con_origen_concesion |  |
| `anio_otorgamiento` | smallint | no |  |  |
| `fecha_otorgamiento` | date | no |  |  |
| `tipo_derecho` | con_tipo_derecho | sí | 'CONCESION'::con_tipo_derecho |  |
| `estado` | con_estado_concesion | sí | 'EN_TRAMITE'::con_estado_concesion |  |
| `observaciones` | text | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `resolucion_id` | bigint | no |  | FK → exp_resolucion.id |
| `situacion_legal_codigo` | character varying(20) | no |  | FK → cat_situacion_legal.codigo |

**Índices**

- `idx_concesion_estado`: USING btree (estado)
- `uk_concesion_numero`: UNIQUE USING btree (numero)

**Controles (CHECK)**

- `chk_concesion_expediente`: CHECK (((expediente_id IS NOT NULL) OR (origen = 'MIGRACION'::con_origen_concesion)))

### `con_condicion`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_condicion_id_seq'::regclass) | PK |
| `caracter` | con_caracter | no |  |  |
| `codigo_servicio` | smallint | no |  |  |
| `periodo_inicio` | date | no |  |  |
| `periodo_fin` | date | no |  |  |
| `caudal_lps` | numeric(10,3) | no |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `uk_condicion_vigente`: UNIQUE USING btree (concesion_id) WHERE vigente

**Controles (CHECK)**

- `chk_condicion_caudal`: CHECK (((caudal_lps IS NULL) OR (caudal_lps >= (0)::numeric)))
- `chk_condicion_periodo`: CHECK (((periodo_fin IS NULL) OR (periodo_inicio IS NULL) OR (periodo_fin >= periodo_inicio)))

### `con_domicilio`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_domicilio_id_seq'::regclass) | PK |
| `orden` | smallint | sí |  |  |
| `calle` | character varying(150) | sí |  |  |
| `numero` | character varying(20) | no |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `departamento_id` | integer | sí |  | FK → cat_departamento.id |
| `localidad_id` | integer | sí |  | FK → cat_localidad.id |
| `distrito_id` | integer | sí |  | FK → cat_distrito.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `idx_domicilio_concesion`: USING btree (concesion_id, vigente)

### `con_inmueble`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_inmueble_id_seq'::regclass) | PK |
| `padron` | character varying(30) | no |  |  |
| `matricula_catastral` | character varying(30) | no |  |  |
| `circunscripcion` | character varying(10) | no |  |  |
| `seccion` | character varying(10) | no |  |  |
| `parcela` | character varying(20) | no |  |  |
| `lamina` | character varying(20) | no |  |  |
| `orden` | character varying(20) | no |  |  |
| `libro` | character varying(20) | no |  |  |
| `folio` | character varying(20) | no |  |  |
| `anio_dominio` | smallint | no |  |  |
| `matricula_dominio` | character varying(30) | no |  |  |
| `serie` | character varying(20) | no |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `departamento_id` | integer | no |  | FK → cat_departamento.id |
| `localidad_id` | integer | no |  | FK → cat_localidad.id |
| `distrito_id` | integer | no |  | FK → cat_distrito.id |
| `cuenca_id` | integer | no |  | FK → cat_cuenca.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `idx_inmueble_matricula`: USING btree (matricula_catastral)
- `idx_inmueble_padron`: USING btree (padron)
- `uk_inmueble_vigente`: UNIQUE USING btree (concesion_id) WHERE vigente

**Controles (CHECK)**

- `chk_inmueble_anio_dominio`: CHECK (((anio_dominio IS NULL) OR (anio_dominio >= 1900)))

### `con_poligono`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('con_poligono_id_seq'::regclass) | PK |
| `geom` | geometry(MultiPolygon,5345) | sí |  |  |
| `superficie_ha` | numeric(12,4) | sí |  |  |
| `perimetro_m` | numeric(12,2) | sí |  |  |
| `origen` | con_origen_poligono | sí |  |  |
| `archivo_nombre` | character varying(255) | no |  |  |
| `archivo_ruta` | character varying(500) | no |  |  |
| `archivo_sha256` | character varying(64) | no |  |  |
| `archivo_bytes` | integer | no |  |  |
| `sistema_origen` | character varying(20) | no |  |  |
| `vigente` | boolean | sí | true |  |
| `hasta` | timestamp with time zone | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `desde` | date | no |  |  |

**Índices**

- `idx_poligono_geom`: USING gist (geom)
- `uk_poligono_vigente`: UNIQUE USING btree (concesion_id) WHERE vigente

**Controles (CHECK)**

- `chk_poligono_archivo`: CHECK (((archivo_ruta IS NULL) = (archivo_sha256 IS NULL)))

### `con_punto`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_punto_id_seq'::regclass) | PK |
| `tipo` | con_tipo_punto | sí |  |  |
| `coord_x` | numeric(12,2) | no |  |  |
| `coord_y` | numeric(12,2) | no |  |  |
| `geom` | geometry(Point,5345) | no |  |  |
| `latitud` | numeric(9,6) | sí |  |  |
| `longitud` | numeric(9,6) | sí |  |  |
| `referencia` | character varying(255) | no |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `idx_punto_geom`: USING gist (geom)
- `uk_punto_vigente`: UNIQUE USING btree (concesion_id, tipo) WHERE vigente

**Controles (CHECK)**

- `chk_punto_posgar`: CHECK ((((coord_x IS NULL) = (coord_y IS NULL)) AND ((coord_x IS NULL) OR (((coord_x >= (3000000)::numeric) AND (coord_x <= (4000000)::numeric)) AND ((coord_y >= (6000000)::numeric) AND (coord_y <= (8000000)::numeric))))))
- `chk_punto_rango`: CHECK ((((latitud >= ('-55'::integer)::numeric) AND (latitud <= ('-21'::integer)::numeric)) AND ((longitud >= ('-74'::integer)::numeric) AND (longitud <= ('-53'::integer)::numeric))))

### `con_suministro`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_suministro_id_seq'::regclass) | PK |
| `fuente_principal` | character varying(120) | no |  |  |
| `fuentes_adicionales` | character varying(120)[] | sí | '{}'::character varying[] |  |
| `sistema_distribucion` | character varying(120) | no |  |  |
| `canal_principal` | character varying(120) | no |  |  |
| `canal_secundario` | character varying(120) | no |  |  |
| `canal_terciario` | character varying(120) | no |  |  |
| `canal_cuarto` | character varying(120) | no |  |  |
| `canal_quinto` | character varying(120) | no |  |  |
| `desague` | character varying(120) | no |  |  |
| `observacion` | text | no |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `uk_suministro_vigente`: UNIQUE USING btree (concesion_id) WHERE vigente

### `con_titular`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_titular_id_seq'::regclass) | PK |
| `orden` | smallint | sí |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `persona_id` | bigint | sí |  | FK → per_persona.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `idx_titular_concesion`: USING btree (concesion_id, vigente)
- `idx_titular_persona`: USING btree (persona_id, vigente)
- `uk_titular_vigente`: UNIQUE USING btree (concesion_id, persona_id) WHERE vigente

### `con_uso`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `vigente` | boolean | sí | true |  |
| `desde` | date | no |  |  |
| `hasta` | date | no |  |  |
| `id` | bigint | sí | nextval('con_uso_id_seq'::regclass) | PK |
| `orden` | smallint | sí |  |  |
| `magnitud` | numeric(12,2) | sí |  |  |
| `caudal_lps` | numeric(10,3) | sí |  |  |
| `concesion_id` | bigint | sí |  | FK → con_concesion.id |
| `tipo_uso_codigo` | character varying(40) | sí |  | FK → cat_tipo_uso.codigo |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |

**Índices**

- `idx_conuso_concesion`: USING btree (concesion_id, vigente)

## Empresas perforadoras (`emp_`)

### `emp_empresa`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('emp_empresa_id_seq'::regclass) | PK |
| `persona_juridica` | boolean | sí |  |  |
| `cuit` | character varying(13) | sí |  |  |
| `razon_social` | character varying(200) | no |  |  |
| `nombre` | character varying(100) | no |  |  |
| `apellido` | character varying(100) | no |  |  |
| `ingresos_brutos` | character varying(30) | no |  |  |
| `convenio_multilateral` | boolean | sí | false |  |
| `registro_comercio` | character varying(30) | no |  |  |
| `domicilio_fiscal` | character varying(255) | no |  |  |
| `provincia` | character varying(80) | no | 'Tucumán'::character varying |  |
| `departamento_id` | integer | no |  |  |
| `localidad_id` | integer | no |  |  |
| `telefono` | character varying(30) | no |  |  |
| `email` | character varying(150) | no |  |  |
| `estado` | emp_estado_empresa | sí | 'EN_TRAMITE'::emp_estado_empresa |  |
| `observaciones` | text | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | no | now() |  |

**Índices**

- `idx_empresa_estado`: USING btree (estado)
- `uk_empresa_cuit`: UNIQUE USING btree (cuit)

**Controles (CHECK)**

- `chk_empresa_nombre`: CHECK (((persona_juridica AND (razon_social IS NOT NULL)) OR ((NOT persona_juridica) AND (nombre IS NOT NULL) AND (apellido IS NOT NULL))))

### `emp_maquina`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('emp_maquina_id_seq'::regclass) | PK |
| `codigo` | character varying(30) | sí |  |  |
| `modelo` | character varying(120) | no |  |  |
| `capacidad_diametro` | character varying(30) | no |  |  |
| `capacidad_profundidad` | numeric(8,2) | no |  |  |
| `altura_torre` | numeric(6,2) | no |  |  |
| `vehiculo_patente` | character varying(20) | no |  |  |
| `vehiculo_modelo` | character varying(120) | no |  |  |
| `foto_ruta` | character varying(500) | no |  |  |
| `observaciones` | text | no |  |  |
| `activa` | boolean | sí | true |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `empresa_id` | bigint | sí |  | FK → emp_empresa.id |

**Índices**

- `idx_maquina_empresa`: USING btree (empresa_id, activa)
- `uk_maquina_codigo`: UNIQUE USING btree (codigo)

## Expedientes (`exp_`)

### `exp_actuacion`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_actuacion_id_seq'::regclass) | PK |
| `oficina` | exp_oficina | sí |  |  |
| `etapa` | exp_etapa | sí |  |  |
| `tipo` | exp_tipo_actuacion | sí |  |  |
| `resultado` | exp_resultado_actuacion | sí |  |  |
| `observaciones` | text | no |  |  |
| `datos` | jsonb | no |  |  |
| `fecha` | timestamp with time zone | sí | now() |  |
| `expediente_id` | bigint | sí |  | FK → exp_expediente.id |
| `usuario_id` | bigint | sí |  | FK → seg_usuario.id |

**Índices**

- `idx_actuacion_expediente`: USING btree (expediente_id, fecha)

### `exp_documentacion_presentada`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_documentacion_presentada_id_seq'::regclass) | PK |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `expediente_id` | bigint | sí |  | FK → exp_expediente.id |
| `documento_requerido_id` | integer | sí |  | FK → cat_documento_requerido.id |

**Índices**

- `uk_doc_presentada`: UNIQUE USING btree (expediente_id, documento_requerido_id)

### `exp_expediente`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_expediente_id_seq'::regclass) | PK |
| `numero` | character varying(20) | sí |  |  |
| `reparticion` | character varying(10) | sí |  |  |
| `anio` | smallint | sí |  |  |
| `tipo_tramite` | exp_tipo_tramite | sí |  |  |
| `asunto` | character varying(255) | no |  |  |
| `fecha_ingreso` | date | sí |  |  |
| `oficina_actual` | exp_oficina | sí |  |  |
| `estado` | exp_estado_expediente | sí | 'EN_TRAMITE'::exp_estado_expediente |  |
| `solicitante_nombre` | character varying(200) | no |  |  |
| `solicitante_documento` | character varying(20) | no |  |  |
| `observaciones` | text | no |  |  |
| `etapa` | exp_etapa | sí | 'CARGA'::exp_etapa |  |
| `tomado_en` | timestamp with time zone | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `tomado_por_usuario_id` | bigint | no |  | FK → seg_usuario.id |

**Índices**

- `idx_exp_bandeja`: USING btree (oficina_actual, estado)
- `idx_exp_documento`: USING btree (solicitante_documento)
- `idx_exp_tipo`: USING btree (tipo_tramite, estado)
- `uk_expediente`: UNIQUE USING btree (numero, reparticion, anio)

### `exp_movimiento`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_movimiento_id_seq'::regclass) | PK |
| `oficina_origen` | exp_oficina | no |  |  |
| `oficina_destino` | exp_oficina | sí |  |  |
| `etapa_destino` | exp_etapa | sí |  |  |
| `fecha` | timestamp with time zone | sí | now() |  |
| `dictamen` | exp_dictamen | sí | 'SIN_DICTAMEN'::exp_dictamen |  |
| `observaciones` | text | no |  |  |
| `es_devolucion` | boolean | sí | false |  |
| `recibido_en` | timestamp with time zone | no |  |  |
| `expediente_id` | bigint | sí |  | FK → exp_expediente.id |
| `usuario_id` | bigint | sí |  | FK → seg_usuario.id |
| `recibido_por_usuario_id` | bigint | no |  | FK → seg_usuario.id |

**Índices**

- `idx_mov_expediente`: USING btree (expediente_id, fecha)
- `idx_mov_oficina`: USING btree (oficina_destino, fecha)

### `exp_resolucion`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_resolucion_id_seq'::regclass) | PK |
| `numero` | character varying(20) | sí |  |  |
| `anio` | smallint | sí |  |  |
| `fecha` | date | sí |  |  |
| `archivo_ruta` | character varying(500) | no |  |  |
| `observaciones` | text | no |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `creado_usuario_id` | bigint | sí |  | FK → seg_usuario.id |

**Índices**

- `uk_resolucion`: UNIQUE USING btree (numero, anio)

### `exp_solicitud_numero`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('exp_solicitud_numero_id_seq'::regclass) | PK |
| `estado` | exp_estado_solicitud_numero | sí | 'PENDIENTE'::exp_estado_solicitud_numero |  |
| `etiquetas` | character varying(100)[] | sí | '{}'::character varying[] |  |
| `numeros` | character varying(20)[] | sí | '{}'::character varying[] |  |
| `solicitado_en` | timestamp with time zone | sí | now() |  |
| `asignado_en` | timestamp with time zone | no |  |  |
| `expediente_id` | bigint | sí |  | FK → exp_expediente.id |
| `solicitado_por_usuario_id` | bigint | sí |  | FK → seg_usuario.id |
| `asignado_por_usuario_id` | bigint | no |  | FK → seg_usuario.id |

**Índices**

- `idx_solicitud_estado`: USING btree (estado, solicitado_en)
- `uk_solicitud_pendiente`: UNIQUE USING btree (expediente_id) WHERE (estado = 'PENDIENTE'::exp_estado_solicitud_numero)

**Controles (CHECK)**

- `chk_solicitud_asignada`: CHECK (((estado <> 'ASIGNADA'::exp_estado_solicitud_numero) OR ((cardinality(numeros) > 0) AND (asignado_en IS NOT NULL))))

## Migración del padrón (`mig_`)

### `mig_lote`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | integer | sí | nextval('mig_lote_id_seq'::regclass) | PK |
| `nombre` | character varying(150) | sí |  |  |
| `archivo` | character varying(255) | no |  |  |
| `demo` | boolean | sí | false |  |
| `filas` | integer | sí | 0 |  |
| `importadas` | integer | sí | 0 |  |
| `omitidas` | integer | sí | 0 |  |
| `con_error` | integer | sí | 0 |  |
| `con_poligono` | integer | sí | 0 |  |
| `informe` | jsonb | sí | '[]'::jsonb |  |
| `creado_en` | timestamp with time zone | sí | now() |  |

### `mig_registro_origen`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('mig_registro_origen_id_seq'::regclass) | PK |
| `entidad_tipo` | character varying(40) | sí |  |  |
| `id_nuevo` | bigint | sí |  |  |
| `id_origen` | character varying(60) | sí |  |  |
| `tabla_origen` | character varying(120) | no |  |  |
| `datos_origen` | jsonb | no |  |  |
| `observaciones` | text | no |  |  |
| `migrado_en` | timestamp with time zone | sí | now() |  |
| `lote_id` | integer | sí |  | FK → mig_lote.id |

**Índices**

- `idx_mig_nuevo`: USING btree (entidad_tipo, id_nuevo)
- `uk_mig_origen`: UNIQUE USING btree (entidad_tipo, id_origen)

## Personas (`per_`)

### `per_persona`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('per_persona_id_seq'::regclass) | PK |
| `tipo_persona` | per_tipo_persona | sí |  |  |
| `tipo_documento` | per_tipo_documento | no |  |  |
| `documento` | character varying(11) | no |  |  |
| `apellido` | character varying(100) | no |  |  |
| `nombre` | character varying(100) | no |  |  |
| `fecha_nacimiento` | date | no |  |  |
| `razon_social` | character varying(200) | no |  |  |
| `fecha_constitucion` | date | no |  |  |
| `denominacion` | character varying(250) | no |  |  |
| `email` | character varying(150) | no |  |  |
| `telefono` | character varying(30) | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_usuario_id` | bigint | no |  |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |

**Índices**

- `uk_persona_documento`: UNIQUE USING btree (documento) WHERE (documento IS NOT NULL)

**Controles (CHECK)**

- `chk_persona_documento`: CHECK (((documento IS NULL) = (tipo_documento IS NULL)))
- `chk_persona_identidad`: CHECK ((((tipo_persona = 'JURIDICA'::per_tipo_persona) AND (razon_social IS NOT NULL) AND ((tipo_documento IS NULL) OR (tipo_documento = 'CUIT'::per_tipo_documento))) OR ((tipo_persona = 'FISICA'::per_tipo_persona) AND (((apellido IS NOT NULL) AND (nombre IS NOT NULL)) OR (denominacion IS NOT NULL)))))

## Pozos (`poz_`)

### `poz_baja`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('poz_baja_id_seq'::regclass) | PK |
| `origen` | poz_origen_baja | sí |  |  |
| `estado` | poz_estado_baja | sí | 'EN_TRAMITE'::poz_estado_baja |  |
| `motivo` | text | sí |  |  |
| `solicitante_nombre` | character varying(200) | no |  |  |
| `solicitante_documento` | character varying(20) | no |  |  |
| `documentacion_presentada` | text[] | sí | '{}'::text[] |  |
| `inspeccion_realizada` | boolean | no |  |  |
| `fecha_inspeccion` | date | no |  |  |
| `observaciones_inspeccion` | text | no |  |  |
| `informe_tecnico` | text | no |  |  |
| `requiere_clausura` | boolean | no |  |  |
| `anular_concesion` | boolean | no |  |  |
| `clausura_fecha` | date | no |  |  |
| `clausura_acta` | character varying(50) | no |  |  |
| `clausura_observaciones` | text | no |  |  |
| `aviso_distrito_en` | timestamp with time zone | no |  |  |
| `distrito_visto_en` | timestamp with time zone | no |  |  |
| `distrito_visto_por_usuario_id` | bigint | no |  |  |
| `estado_pozo_anterior` | poz_estado_pozo | sí |  |  |
| `concesion_anterior_id` | bigint | no |  |  |
| `fecha_baja` | date | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `modificado_en` | timestamp with time zone | sí | now() |  |
| `pozo_id` | bigint | sí |  | FK → poz_pozo.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `resolucion_id` | bigint | no |  | FK → exp_resolucion.id |

**Índices**

- `REL_dfc033f34c40798d97a6ca5c3b`: UNIQUE (expediente_id)
- `idx_baja_estado`: USING btree (estado)
- `uk_baja_expediente`: UNIQUE USING btree (expediente_id)
- `uk_baja_pozo_sin_resolver`: UNIQUE USING btree (pozo_id) WHERE (estado = ANY (ARRAY['EN_TRAMITE'::poz_estado_baja, 'EN_ESPERA'::poz_estado_baja, 'OBSERVADA'::poz_estado_baja]))

**Controles (CHECK)**

- `chk_baja_expediente`: CHECK (((origen = 'A_SOLICITUD'::poz_origen_baja) = (expediente_id IS NOT NULL)))
- `chk_baja_motivo`: CHECK ((char_length(motivo) >= 10))
- `chk_baja_solicitante`: CHECK (((origen = 'DE_OFICIO'::poz_origen_baja) OR (solicitante_nombre IS NOT NULL)))

### `poz_pozo`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('poz_pozo_id_seq'::regclass) | PK |
| `id_interno` | character varying(20) | sí |  |  |
| `origen` | poz_origen_pozo | sí | 'AUTORIZACION'::poz_origen_pozo |  |
| `jurisdiccion_drh` | boolean | sí | true |  |
| `alias` | character varying(120) | no |  |  |
| `estado` | poz_estado_pozo | sí | 'EN_USO'::poz_estado_pozo |  |
| `tipo_pozo` | character varying(60) | no |  |  |
| `geom` | geometry(Point,5345) | sí |  |  |
| `cota` | numeric(8,2) | no |  |  |
| `profundidad_real` | numeric(8,2) | no |  |  |
| `nivel_estatico` | numeric(8,2) | no |  |  |
| `nivel_dinamico` | numeric(8,2) | no |  |  |
| `caudal_bombeo_m3h` | numeric(10,3) | no |  |  |
| `caudal_bombeo_lps` | numeric(10,3) | no | (caudal_bombeo_m3h / 3.6) |  |
| `observaciones` | text | no |  |  |
| `migrado_en` | date | no |  |  |
| `creado_usuario_id` | bigint | sí |  |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `empresa_id` | bigint | no |  | FK → emp_empresa.id |
| `concesion_id` | bigint | no |  | FK → con_concesion.id |

**Índices**

- `idx_pozo_alias`: USING btree (alias)
- `idx_pozo_concesion`: USING btree (concesion_id)
- `idx_pozo_estado`: USING btree (estado)
- `idx_pozo_geom`: USING gist (geom)
- `uk_pozo_interno`: UNIQUE USING btree (id_interno)

**Controles (CHECK)**

- `chk_pozo_expediente`: CHECK (((origen = 'MIGRACION'::poz_origen_pozo) OR (expediente_id IS NOT NULL)))
- `chk_pozo_jurisdiccion`: CHECK ((jurisdiccion_drh OR (concesion_id IS NULL)))

## Recaudación (`rec_`)

### `rec_deuda`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('rec_deuda_id_seq'::regclass) | PK |
| `detalle` | text | sí |  |  |
| `monto` | numeric(14,2) | no |  |  |
| `estado` | rec_estado_deuda | sí | 'PENDIENTE'::rec_estado_deuda |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `cancelado_en` | timestamp with time zone | no |  |  |
| `comprobante_pago` | character varying(120) | no |  |  |
| `persona_id` | bigint | sí |  | FK → per_persona.id |
| `expediente_id` | bigint | no |  | FK → exp_expediente.id |
| `registrado_por_usuario_id` | bigint | sí |  | FK → seg_usuario.id |
| `cancelado_por_usuario_id` | bigint | no |  | FK → seg_usuario.id |

**Índices**

- `idx_deuda_persona`: USING btree (persona_id, estado)

## Seguridad (`seg_`)

### `seg_oficina`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `codigo` | character varying(30) | sí |  | PK |
| `nombre` | character varying(80) | sí |  |  |
| `orden` | smallint | sí | '0'::smallint |  |
| `activa` | boolean | sí | true |  |

### `seg_usuario`

| Columna | Tipo | Obligatoria | Por defecto | Clave |
| --- | --- | --- | --- | --- |
| `id` | bigint | sí | nextval('seg_usuario_id_seq'::regclass) | PK |
| `legajo` | character varying(20) | sí |  |  |
| `apellido` | character varying(100) | sí |  |  |
| `nombre` | character varying(100) | sí |  |  |
| `email` | character varying(150) | sí |  |  |
| `es_administrador` | boolean | sí | false |  |
| `activo` | boolean | sí | true |  |
| `creado_en` | timestamp with time zone | sí | now() |  |
| `oficina_codigo` | character varying(30) | no |  | FK → seg_oficina.codigo |

**Índices**

- `uk_usuario_email`: UNIQUE USING btree (email)
- `uk_usuario_legajo`: UNIQUE USING btree (legajo)

## Vistas

Consultas guardadas que se leen como una tabla (no guardan datos). Su SQL está en las `*ViewEntity` del código.

| Vista | Columnas |
| --- | --- |
| `public.con_v_inmueble` | inmueble_id (bigint), concesion_id (bigint), departamento (character varying), localidad (character varying), distrito (character varying), cuenca (character varying), padron (character varying), matricula_catastral (character varying), circunscripcion (character varying), seccion (character varying), parcela (character varying), lamina (character varying), orden (character varying), desde (date) |
| `sig.v_concesiones` | poligono_id (bigint), concesion_id (bigint), numero (character varying), estado (text), tipo_derecho (text), origen (text), anio_otorgamiento (smallint), expediente (text), oficina_actual (text), titular (text), documento (character varying), cantidad_titulares (integer), departamento (character varying), localidad (character varying), distrito (character varying), cuenca (character varying), padron (character varying), matricula_catastral (character varying), parcela (character varying), superficie_ha (double precision), caudal_lps (double precision), caracter (text), codigo_servicio (smallint), usos (text), fuente (character varying), sistema (character varying), canal_principal (character varying), origen_poligono (text), poligono_desde (date), geom (USER-DEFINED) |
| `sig.v_pozos` | pozo_id (bigint), id_interno (character varying), alias (character varying), estado (text), origen (text), tipo_pozo (character varying), jurisdiccion_drh (boolean), profundidad_m (double precision), nivel_estatico_m (double precision), nivel_dinamico_m (double precision), caudal_m3h (double precision), caudal_lps (double precision), coord_x (double precision), coord_y (double precision), concesion_id (bigint), concesion_numero (character varying), titular (text), departamento (character varying), localidad (character varying), dentro_de_concesion (boolean), geom (USER-DEFINED) |

## Enumerados

| Tipo | Valores |
| --- | --- |
| `cat_tipo_opcion_suministro` | FUENTE, SISTEMA, DESAGUE |
| `con_caracter` | PERMANENTE, EVENTUAL |
| `con_estado_concesion` | EN_TRAMITE, DENEGADA, VIGENTE, MODIFICADA, ANULADA, ARCHIVADA |
| `con_origen_concesion` | SISTEMA, MIGRACION |
| `con_origen_poligono` | ALTA, AMPLIACION, REDUCCION, REUBICACION, SUBDIVISION, MIGRACION |
| `con_tipo_derecho` | CONCESION, DERECHO_TRADICIONAL, PERMISO_USO, PERMISO_POZO |
| `con_tipo_punto` | DESAGUE, ENTREGA |
| `emp_estado_empresa` | EN_TRAMITE, OBSERVADA, RECHAZADA, ACTIVA, BAJA |
| `exp_dictamen` | APTO, NO_APTO, OBSERVADO, SIN_DICTAMEN |
| `exp_estado_expediente` | EN_TRAMITE, OBSERVADO, EN_ESPERA, FINALIZADO, RECHAZADO, ARCHIVADO, ANULADO |
| `exp_estado_solicitud_numero` | PENDIENTE, ASIGNADA |
| `exp_etapa` | CARGA, CORRECCION, RECAUDACION, DISTRITO, JURIDICO, SECRETARIA_GENERAL, CIERRE, ESPERA_PADRON, INICIO_POZOS, ANTECEDENTES_POZOS, EVALUACION_TECNICA_POZOS, CORRECCION_POZOS, CLAUSURA_POZOS |
| `exp_oficina` | catastro, recaudacion, distrito, juridico, secretaria_general, pozos |
| `exp_resultado_actuacion` | APTO, NO_APTO, OBSERVADO, SIN_DEUDA, CON_DEUDA, REGISTRADO |
| `exp_tipo_actuacion` | CARGA_COMPLETA, CORRECCION, VERIFICACION_DEUDA, DEUDA_CANCELADA, INFORME_TECNICO, DICTAMEN_JURIDICO, NUMERO_CONCESION, RESOLUCION, VERIFICACION_FINAL, PADRON, DOCUMENTACION, ANTECEDENTES, EVALUACION_TECNICA, CLAUSURA, TOMA_CONOCIMIENTO, SOLICITUD_NUMERO, NOTIFICACION |
| `exp_tipo_tramite` | ALTA_CONCESION, CAMBIO_TITULARIDAD, ANULACION, AMPLIACION_REDUCCION, SUBDIVISION, REUBICACION, PERMISO_USO, AUTORIZACION_PERFORACION, REGISTRO_POZO, BAJA_POZO, REGISTRO_EMPRESA, OTRO |
| `not_estado_email` | ENVIADO, NO_ENVIADO_PRUEBA, ERROR |
| `not_tipo_email` | AVISO_DEUDA |
| `per_tipo_documento` | DNI, CUIL, CUIT |
| `per_tipo_persona` | FISICA, JURIDICA |
| `poz_estado_baja` | EN_TRAMITE, EN_ESPERA, OBSERVADA, CLAUSURA_PENDIENTE, CONFIRMADA, RECHAZADA |
| `poz_estado_pozo` | EN_USO, FUERA_DE_SERVICIO, PARADO, BAJA, ANULADO |
| `poz_origen_baja` | A_SOLICITUD, DE_OFICIO |
| `poz_origen_pozo` | AUTORIZACION, OFICIO, MIGRACION |
| `rec_estado_deuda` | PENDIENTE, CANCELADA |
