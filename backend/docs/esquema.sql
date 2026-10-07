--
-- PostgreSQL database dump
--

\restrict ZeHpk3wjePGTtvmBkaFYOwVGUDD499gGGAYNXKYJKkS4yiJ17x9Z3XwBFJMvpuV

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: sig; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sig;


--
-- Name: con_caracter; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_caracter AS ENUM (
    'PERMANENTE',
    'EVENTUAL'
);


--
-- Name: con_estado_concesion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_estado_concesion AS ENUM (
    'EN_TRAMITE',
    'DENEGADA',
    'VIGENTE',
    'MODIFICADA',
    'ANULADA',
    'ARCHIVADA'
);


--
-- Name: con_origen_concesion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_origen_concesion AS ENUM (
    'SISTEMA',
    'MIGRACION'
);


--
-- Name: con_origen_poligono; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_origen_poligono AS ENUM (
    'ALTA',
    'AMPLIACION',
    'REDUCCION',
    'REUBICACION',
    'SUBDIVISION',
    'MIGRACION'
);


--
-- Name: con_tipo_derecho; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_tipo_derecho AS ENUM (
    'CONCESION',
    'DERECHO_TRADICIONAL',
    'PERMISO_USO',
    'PERMISO_POZO'
);


--
-- Name: con_tipo_punto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.con_tipo_punto AS ENUM (
    'DESAGUE',
    'ENTREGA'
);


--
-- Name: emp_estado_empresa; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.emp_estado_empresa AS ENUM (
    'EN_TRAMITE',
    'OBSERVADA',
    'RECHAZADA',
    'ACTIVA',
    'BAJA'
);


--
-- Name: exp_dictamen; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_dictamen AS ENUM (
    'APTO',
    'NO_APTO',
    'OBSERVADO',
    'SIN_DICTAMEN'
);


--
-- Name: exp_estado_expediente; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_estado_expediente AS ENUM (
    'EN_TRAMITE',
    'OBSERVADO',
    'EN_ESPERA',
    'FINALIZADO',
    'RECHAZADO',
    'ARCHIVADO',
    'ANULADO'
);


--
-- Name: exp_etapa; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_etapa AS ENUM (
    'CARGA',
    'CORRECCION',
    'RECAUDACION',
    'DISTRITO',
    'JURIDICO',
    'SECRETARIA_GENERAL',
    'CIERRE',
    'ESPERA_PADRON',
    'INICIO_POZOS',
    'ANTECEDENTES_POZOS',
    'EVALUACION_TECNICA_POZOS',
    'CORRECCION_POZOS',
    'CLAUSURA_POZOS'
);


--
-- Name: exp_oficina; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_oficina AS ENUM (
    'catastro',
    'recaudacion',
    'distrito',
    'juridico',
    'secretaria_general',
    'pozos'
);


--
-- Name: exp_resultado_actuacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_resultado_actuacion AS ENUM (
    'APTO',
    'NO_APTO',
    'OBSERVADO',
    'SIN_DEUDA',
    'CON_DEUDA',
    'REGISTRADO'
);


--
-- Name: exp_tipo_actuacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_tipo_actuacion AS ENUM (
    'CARGA_COMPLETA',
    'CORRECCION',
    'VERIFICACION_DEUDA',
    'DEUDA_CANCELADA',
    'INFORME_TECNICO',
    'DICTAMEN_JURIDICO',
    'NUMERO_CONCESION',
    'RESOLUCION',
    'VERIFICACION_FINAL',
    'PADRON',
    'DOCUMENTACION',
    'ANTECEDENTES',
    'EVALUACION_TECNICA',
    'CLAUSURA',
    'TOMA_CONOCIMIENTO'
);


--
-- Name: exp_tipo_tramite; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exp_tipo_tramite AS ENUM (
    'ALTA_CONCESION',
    'CAMBIO_TITULARIDAD',
    'ANULACION',
    'AMPLIACION_REDUCCION',
    'SUBDIVISION',
    'REUBICACION',
    'PERMISO_USO',
    'AUTORIZACION_PERFORACION',
    'REGISTRO_POZO',
    'BAJA_POZO',
    'REGISTRO_EMPRESA',
    'OTRO'
);


--
-- Name: per_tipo_documento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.per_tipo_documento AS ENUM (
    'DNI',
    'CUIL',
    'CUIT'
);


--
-- Name: per_tipo_persona; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.per_tipo_persona AS ENUM (
    'FISICA',
    'JURIDICA'
);


--
-- Name: poz_estado_baja; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poz_estado_baja AS ENUM (
    'EN_TRAMITE',
    'EN_ESPERA',
    'OBSERVADA',
    'CLAUSURA_PENDIENTE',
    'CONFIRMADA',
    'RECHAZADA'
);


--
-- Name: poz_estado_pozo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poz_estado_pozo AS ENUM (
    'EN_USO',
    'FUERA_DE_SERVICIO',
    'PARADO',
    'BAJA',
    'ANULADO'
);


--
-- Name: poz_origen_baja; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poz_origen_baja AS ENUM (
    'A_SOLICITUD',
    'DE_OFICIO'
);


--
-- Name: poz_origen_pozo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poz_origen_pozo AS ENUM (
    'AUTORIZACION',
    'OFICIO',
    'MIGRACION'
);


--
-- Name: rec_estado_deuda; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rec_estado_deuda AS ENUM (
    'PENDIENTE',
    'CANCELADA'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cat_cuenca; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_cuenca (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: cat_cuenca_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cat_cuenca_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cat_cuenca_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cat_cuenca_id_seq OWNED BY public.cat_cuenca.id;


--
-- Name: cat_departamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_departamento (
    id integer NOT NULL,
    nombre character varying(80) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: cat_departamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cat_departamento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cat_departamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cat_departamento_id_seq OWNED BY public.cat_departamento.id;


--
-- Name: cat_distrito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_distrito (
    id integer NOT NULL,
    codigo character varying(10) NOT NULL,
    nombre character varying(60) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: cat_distrito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cat_distrito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cat_distrito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cat_distrito_id_seq OWNED BY public.cat_distrito.id;


--
-- Name: cat_documento_requerido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_documento_requerido (
    id integer NOT NULL,
    descripcion character varying(200) NOT NULL,
    orden smallint DEFAULT '0'::smallint NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    situacion_legal_codigo character varying(20) NOT NULL
);


--
-- Name: cat_documento_requerido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cat_documento_requerido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cat_documento_requerido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cat_documento_requerido_id_seq OWNED BY public.cat_documento_requerido.id;


--
-- Name: cat_localidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_localidad (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    departamento_id integer NOT NULL,
    distrito_id integer NOT NULL
);


--
-- Name: cat_localidad_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cat_localidad_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cat_localidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cat_localidad_id_seq OWNED BY public.cat_localidad.id;


--
-- Name: cat_situacion_legal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_situacion_legal (
    codigo character varying(20) NOT NULL,
    nombre character varying(60) NOT NULL,
    titulo character varying(80) NOT NULL,
    orden smallint DEFAULT '0'::smallint NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: cat_tipo_uso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cat_tipo_uso (
    codigo character varying(40) NOT NULL,
    nombre character varying(80) NOT NULL,
    dotacion numeric(8,3) NOT NULL,
    unidad character varying(40) NOT NULL,
    requiere_punto_entrega boolean DEFAULT false NOT NULL,
    orden smallint DEFAULT '0'::smallint NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: con_concesion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_concesion (
    id bigint NOT NULL,
    numero character varying(20),
    origen public.con_origen_concesion DEFAULT 'SISTEMA'::public.con_origen_concesion NOT NULL,
    anio_otorgamiento smallint,
    fecha_otorgamiento date,
    tipo_derecho public.con_tipo_derecho DEFAULT 'CONCESION'::public.con_tipo_derecho NOT NULL,
    estado public.con_estado_concesion DEFAULT 'EN_TRAMITE'::public.con_estado_concesion NOT NULL,
    observaciones text,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    modificado_usuario_id bigint,
    modificado_en timestamp with time zone DEFAULT now() NOT NULL,
    expediente_id bigint,
    resolucion_id bigint,
    situacion_legal_codigo character varying(20),
    CONSTRAINT chk_concesion_expediente CHECK (((expediente_id IS NOT NULL) OR (origen = 'MIGRACION'::public.con_origen_concesion)))
);


--
-- Name: con_concesion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_concesion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_concesion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_concesion_id_seq OWNED BY public.con_concesion.id;


--
-- Name: con_condicion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_condicion (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    caracter public.con_caracter,
    codigo_servicio smallint,
    periodo_inicio date,
    periodo_fin date,
    caudal_lps numeric(10,3),
    concesion_id bigint NOT NULL,
    expediente_id bigint,
    CONSTRAINT chk_condicion_caudal CHECK (((caudal_lps IS NULL) OR (caudal_lps >= (0)::numeric))),
    CONSTRAINT chk_condicion_periodo CHECK (((periodo_fin IS NULL) OR (periodo_inicio IS NULL) OR (periodo_fin >= periodo_inicio)))
);


--
-- Name: con_condicion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_condicion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_condicion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_condicion_id_seq OWNED BY public.con_condicion.id;


--
-- Name: con_domicilio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_domicilio (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    orden smallint NOT NULL,
    calle character varying(150) NOT NULL,
    numero character varying(20),
    concesion_id bigint NOT NULL,
    departamento_id integer NOT NULL,
    localidad_id integer NOT NULL,
    distrito_id integer NOT NULL,
    expediente_id bigint
);


--
-- Name: con_domicilio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_domicilio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_domicilio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_domicilio_id_seq OWNED BY public.con_domicilio.id;


--
-- Name: con_inmueble; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_inmueble (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    padron character varying(30),
    matricula_catastral character varying(30),
    circunscripcion character varying(10),
    seccion character varying(10),
    parcela character varying(20),
    lamina character varying(20),
    orden character varying(20),
    libro character varying(20),
    folio character varying(20),
    anio_dominio smallint,
    matricula_dominio character varying(30),
    serie character varying(20),
    concesion_id bigint NOT NULL,
    departamento_id integer,
    localidad_id integer,
    distrito_id integer,
    cuenca_id integer,
    expediente_id bigint,
    CONSTRAINT chk_inmueble_anio_dominio CHECK (((anio_dominio IS NULL) OR (anio_dominio >= 1900)))
);


--
-- Name: con_inmueble_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_inmueble_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_inmueble_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_inmueble_id_seq OWNED BY public.con_inmueble.id;


--
-- Name: con_numero_concesion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_numero_concesion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_poligono; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_poligono (
    id bigint NOT NULL,
    geom public.geometry(MultiPolygon,5345) NOT NULL,
    superficie_ha numeric(12,4) NOT NULL,
    perimetro_m numeric(12,2) NOT NULL,
    origen public.con_origen_poligono NOT NULL,
    archivo_nombre character varying(255),
    archivo_ruta character varying(500),
    archivo_sha256 character varying(64),
    archivo_bytes integer,
    sistema_origen character varying(20),
    vigente boolean DEFAULT true NOT NULL,
    hasta timestamp with time zone,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    concesion_id bigint NOT NULL,
    expediente_id bigint,
    CONSTRAINT chk_poligono_archivo CHECK (((archivo_ruta IS NULL) = (archivo_sha256 IS NULL)))
);


--
-- Name: con_poligono_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_poligono_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_poligono_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_poligono_id_seq OWNED BY public.con_poligono.id;


--
-- Name: con_punto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_punto (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    tipo public.con_tipo_punto NOT NULL,
    coord_x numeric(12,2),
    coord_y numeric(12,2),
    geom public.geometry(Point,5345),
    latitud numeric(9,6) NOT NULL,
    longitud numeric(9,6) NOT NULL,
    referencia character varying(255),
    concesion_id bigint NOT NULL,
    expediente_id bigint,
    CONSTRAINT chk_punto_posgar CHECK ((((coord_x IS NULL) = (coord_y IS NULL)) AND ((coord_x IS NULL) OR (((coord_x >= (3000000)::numeric) AND (coord_x <= (4000000)::numeric)) AND ((coord_y >= (6000000)::numeric) AND (coord_y <= (8000000)::numeric)))))),
    CONSTRAINT chk_punto_rango CHECK ((((latitud >= ('-55'::integer)::numeric) AND (latitud <= ('-21'::integer)::numeric)) AND ((longitud >= ('-74'::integer)::numeric) AND (longitud <= ('-53'::integer)::numeric))))
);


--
-- Name: con_punto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_punto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_punto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_punto_id_seq OWNED BY public.con_punto.id;


--
-- Name: con_suministro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_suministro (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    fuente_principal character varying(120) NOT NULL,
    fuentes_adicionales character varying(120)[] DEFAULT '{}'::character varying[] NOT NULL,
    sistema_distribucion character varying(120),
    canal_principal character varying(120),
    canal_secundario character varying(120),
    canal_terciario character varying(120),
    canal_cuarto character varying(120),
    canal_quinto character varying(120),
    desague character varying(120),
    observacion text,
    concesion_id bigint NOT NULL,
    expediente_id bigint
);


--
-- Name: con_suministro_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_suministro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_suministro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_suministro_id_seq OWNED BY public.con_suministro.id;


--
-- Name: con_titular; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_titular (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    orden smallint NOT NULL,
    concesion_id bigint NOT NULL,
    persona_id bigint NOT NULL,
    expediente_id bigint
);


--
-- Name: con_titular_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_titular_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_titular_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_titular_id_seq OWNED BY public.con_titular.id;


--
-- Name: con_uso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.con_uso (
    vigente boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    id bigint NOT NULL,
    orden smallint NOT NULL,
    magnitud numeric(12,2) NOT NULL,
    caudal_lps numeric(10,3) NOT NULL,
    concesion_id bigint NOT NULL,
    tipo_uso_codigo character varying(40) NOT NULL,
    expediente_id bigint
);


--
-- Name: con_uso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.con_uso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: con_uso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.con_uso_id_seq OWNED BY public.con_uso.id;


--
-- Name: con_v_inmueble; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.con_v_inmueble AS
 SELECT i.id AS inmueble_id,
    i.concesion_id,
    d.nombre AS departamento,
    l.nombre AS localidad,
    di.codigo AS distrito,
    cu.nombre AS cuenca,
    i.padron,
    i.matricula_catastral,
    i.circunscripcion,
    i.seccion,
    i.parcela,
    i.lamina,
    i.orden,
    i.desde
   FROM ((((public.con_inmueble i
     LEFT JOIN public.cat_departamento d ON ((d.id = i.departamento_id)))
     LEFT JOIN public.cat_localidad l ON ((l.id = i.localidad_id)))
     LEFT JOIN public.cat_distrito di ON ((di.id = i.distrito_id)))
     LEFT JOIN public.cat_cuenca cu ON ((cu.id = i.cuenca_id)))
  WHERE i.vigente;


--
-- Name: emp_empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emp_empresa (
    id bigint NOT NULL,
    persona_juridica boolean NOT NULL,
    cuit character varying(13) NOT NULL,
    razon_social character varying(200),
    nombre character varying(100),
    apellido character varying(100),
    ingresos_brutos character varying(30),
    convenio_multilateral boolean DEFAULT false NOT NULL,
    registro_comercio character varying(30),
    domicilio_fiscal character varying(255),
    provincia character varying(80) DEFAULT 'Tucumán'::character varying,
    departamento_id integer,
    localidad_id integer,
    telefono character varying(30),
    email character varying(150),
    estado public.emp_estado_empresa DEFAULT 'EN_TRAMITE'::public.emp_estado_empresa NOT NULL,
    observaciones text,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    modificado_usuario_id bigint,
    modificado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_empresa_nombre CHECK (((persona_juridica AND (razon_social IS NOT NULL)) OR ((NOT persona_juridica) AND (nombre IS NOT NULL) AND (apellido IS NOT NULL))))
);


--
-- Name: emp_empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emp_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emp_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emp_empresa_id_seq OWNED BY public.emp_empresa.id;


--
-- Name: emp_maquina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emp_maquina (
    id bigint NOT NULL,
    codigo character varying(30) NOT NULL,
    modelo character varying(120),
    capacidad_diametro character varying(30),
    capacidad_profundidad numeric(8,2),
    altura_torre numeric(6,2),
    vehiculo_patente character varying(20),
    vehiculo_modelo character varying(120),
    foto_ruta character varying(500),
    observaciones text,
    activa boolean DEFAULT true NOT NULL,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    empresa_id bigint NOT NULL
);


--
-- Name: emp_maquina_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emp_maquina_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emp_maquina_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emp_maquina_id_seq OWNED BY public.emp_maquina.id;


--
-- Name: exp_actuacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_actuacion (
    id bigint NOT NULL,
    oficina public.exp_oficina NOT NULL,
    etapa public.exp_etapa NOT NULL,
    tipo public.exp_tipo_actuacion NOT NULL,
    resultado public.exp_resultado_actuacion NOT NULL,
    observaciones text,
    datos jsonb,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    expediente_id bigint NOT NULL,
    usuario_id bigint NOT NULL
);


--
-- Name: exp_actuacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_actuacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_actuacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_actuacion_id_seq OWNED BY public.exp_actuacion.id;


--
-- Name: exp_documentacion_presentada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_documentacion_presentada (
    id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expediente_id bigint NOT NULL,
    documento_requerido_id integer NOT NULL
);


--
-- Name: exp_documentacion_presentada_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_documentacion_presentada_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_documentacion_presentada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_documentacion_presentada_id_seq OWNED BY public.exp_documentacion_presentada.id;


--
-- Name: exp_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_expediente (
    id bigint NOT NULL,
    numero character varying(20) NOT NULL,
    reparticion character varying(10) NOT NULL,
    anio smallint NOT NULL,
    tipo_tramite public.exp_tipo_tramite NOT NULL,
    asunto character varying(255),
    fecha_ingreso date NOT NULL,
    oficina_actual public.exp_oficina NOT NULL,
    estado public.exp_estado_expediente DEFAULT 'EN_TRAMITE'::public.exp_estado_expediente NOT NULL,
    solicitante_nombre character varying(200),
    solicitante_documento character varying(20),
    observaciones text,
    etapa public.exp_etapa DEFAULT 'CARGA'::public.exp_etapa NOT NULL,
    tomado_en timestamp with time zone,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    modificado_usuario_id bigint,
    modificado_en timestamp with time zone DEFAULT now() NOT NULL,
    tomado_por_usuario_id bigint
);


--
-- Name: exp_expediente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_expediente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_expediente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_expediente_id_seq OWNED BY public.exp_expediente.id;


--
-- Name: exp_movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_movimiento (
    id bigint NOT NULL,
    oficina_origen public.exp_oficina,
    oficina_destino public.exp_oficina NOT NULL,
    etapa_destino public.exp_etapa NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    dictamen public.exp_dictamen DEFAULT 'SIN_DICTAMEN'::public.exp_dictamen NOT NULL,
    observaciones text,
    es_devolucion boolean DEFAULT false NOT NULL,
    recibido_en timestamp with time zone,
    expediente_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    recibido_por_usuario_id bigint
);


--
-- Name: exp_movimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_movimiento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_movimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_movimiento_id_seq OWNED BY public.exp_movimiento.id;


--
-- Name: exp_resolucion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_resolucion (
    id bigint NOT NULL,
    numero character varying(20) NOT NULL,
    anio smallint NOT NULL,
    fecha date NOT NULL,
    archivo_ruta character varying(500),
    observaciones text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expediente_id bigint,
    creado_usuario_id bigint NOT NULL
);


--
-- Name: exp_resolucion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_resolucion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_resolucion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_resolucion_id_seq OWNED BY public.exp_resolucion.id;


--
-- Name: mig_lote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mig_lote (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    archivo character varying(255),
    demo boolean DEFAULT false NOT NULL,
    filas integer DEFAULT 0 NOT NULL,
    importadas integer DEFAULT 0 NOT NULL,
    omitidas integer DEFAULT 0 NOT NULL,
    con_error integer DEFAULT 0 NOT NULL,
    con_poligono integer DEFAULT 0 NOT NULL,
    informe jsonb DEFAULT '[]'::jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mig_lote_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mig_lote_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mig_lote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mig_lote_id_seq OWNED BY public.mig_lote.id;


--
-- Name: mig_registro_origen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mig_registro_origen (
    id bigint NOT NULL,
    entidad_tipo character varying(40) NOT NULL,
    id_nuevo bigint NOT NULL,
    id_origen character varying(60) NOT NULL,
    tabla_origen character varying(120),
    datos_origen jsonb,
    observaciones text,
    migrado_en timestamp with time zone DEFAULT now() NOT NULL,
    lote_id integer NOT NULL
);


--
-- Name: mig_registro_origen_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mig_registro_origen_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mig_registro_origen_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mig_registro_origen_id_seq OWNED BY public.mig_registro_origen.id;


--
-- Name: per_persona; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.per_persona (
    id bigint NOT NULL,
    tipo_persona public.per_tipo_persona NOT NULL,
    tipo_documento public.per_tipo_documento,
    documento character varying(11),
    apellido character varying(100),
    nombre character varying(100),
    fecha_nacimiento date,
    razon_social character varying(200),
    fecha_constitucion date,
    denominacion character varying(250),
    email character varying(150),
    telefono character varying(30),
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    modificado_usuario_id bigint,
    modificado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_persona_documento CHECK (((documento IS NULL) = (tipo_documento IS NULL))),
    CONSTRAINT chk_persona_identidad CHECK ((((tipo_persona = 'JURIDICA'::public.per_tipo_persona) AND (razon_social IS NOT NULL) AND ((tipo_documento IS NULL) OR (tipo_documento = 'CUIT'::public.per_tipo_documento))) OR ((tipo_persona = 'FISICA'::public.per_tipo_persona) AND (((apellido IS NOT NULL) AND (nombre IS NOT NULL)) OR (denominacion IS NOT NULL)))))
);


--
-- Name: per_persona_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.per_persona_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: per_persona_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.per_persona_id_seq OWNED BY public.per_persona.id;


--
-- Name: poz_baja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poz_baja (
    id bigint NOT NULL,
    origen public.poz_origen_baja NOT NULL,
    estado public.poz_estado_baja DEFAULT 'EN_TRAMITE'::public.poz_estado_baja NOT NULL,
    motivo text NOT NULL,
    solicitante_nombre character varying(200),
    solicitante_documento character varying(20),
    documentacion_presentada text[] DEFAULT '{}'::text[] NOT NULL,
    inspeccion_realizada boolean,
    fecha_inspeccion date,
    observaciones_inspeccion text,
    informe_tecnico text,
    requiere_clausura boolean,
    anular_concesion boolean,
    clausura_fecha date,
    clausura_acta character varying(50),
    clausura_observaciones text,
    aviso_distrito_en timestamp with time zone,
    distrito_visto_en timestamp with time zone,
    distrito_visto_por_usuario_id bigint,
    estado_pozo_anterior public.poz_estado_pozo NOT NULL,
    concesion_anterior_id bigint,
    fecha_baja date,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    modificado_en timestamp with time zone DEFAULT now() NOT NULL,
    pozo_id bigint NOT NULL,
    expediente_id bigint,
    resolucion_id bigint,
    CONSTRAINT chk_baja_expediente CHECK (((origen = 'A_SOLICITUD'::public.poz_origen_baja) = (expediente_id IS NOT NULL))),
    CONSTRAINT chk_baja_motivo CHECK ((char_length(motivo) >= 10)),
    CONSTRAINT chk_baja_solicitante CHECK (((origen = 'DE_OFICIO'::public.poz_origen_baja) OR (solicitante_nombre IS NOT NULL)))
);


--
-- Name: poz_baja_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.poz_baja_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poz_baja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.poz_baja_id_seq OWNED BY public.poz_baja.id;


--
-- Name: poz_pozo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poz_pozo (
    id bigint NOT NULL,
    id_interno character varying(20) NOT NULL,
    origen public.poz_origen_pozo DEFAULT 'AUTORIZACION'::public.poz_origen_pozo NOT NULL,
    jurisdiccion_drh boolean DEFAULT true NOT NULL,
    alias character varying(120),
    estado public.poz_estado_pozo DEFAULT 'EN_USO'::public.poz_estado_pozo NOT NULL,
    tipo_pozo character varying(60),
    geom public.geometry(Point,5345) NOT NULL,
    cota numeric(8,2),
    profundidad_real numeric(8,2),
    nivel_estatico numeric(8,2),
    nivel_dinamico numeric(8,2),
    caudal_bombeo_m3h numeric(10,3),
    caudal_bombeo_lps numeric(10,3) GENERATED ALWAYS AS ((caudal_bombeo_m3h / 3.6)) STORED,
    observaciones text,
    migrado_en date,
    creado_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expediente_id bigint,
    empresa_id bigint,
    concesion_id bigint,
    CONSTRAINT chk_pozo_expediente CHECK (((origen = 'MIGRACION'::public.poz_origen_pozo) OR (expediente_id IS NOT NULL))),
    CONSTRAINT chk_pozo_jurisdiccion CHECK ((jurisdiccion_drh OR (concesion_id IS NULL)))
);


--
-- Name: poz_pozo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.poz_pozo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poz_pozo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.poz_pozo_id_seq OWNED BY public.poz_pozo.id;


--
-- Name: rec_deuda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rec_deuda (
    id bigint NOT NULL,
    detalle text NOT NULL,
    monto numeric(14,2),
    estado public.rec_estado_deuda DEFAULT 'PENDIENTE'::public.rec_estado_deuda NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    cancelado_en timestamp with time zone,
    comprobante_pago character varying(120),
    persona_id bigint NOT NULL,
    expediente_id bigint,
    registrado_por_usuario_id bigint NOT NULL,
    cancelado_por_usuario_id bigint
);


--
-- Name: rec_deuda_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rec_deuda_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rec_deuda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rec_deuda_id_seq OWNED BY public.rec_deuda.id;


--
-- Name: seg_oficina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seg_oficina (
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    orden smallint DEFAULT '0'::smallint NOT NULL,
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: seg_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seg_usuario (
    id bigint NOT NULL,
    legajo character varying(20) NOT NULL,
    apellido character varying(100) NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    es_administrador boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    oficina_codigo character varying(30)
);


--
-- Name: seg_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seg_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seg_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seg_usuario_id_seq OWNED BY public.seg_usuario.id;


--
-- Name: typeorm_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.typeorm_metadata (
    type character varying NOT NULL,
    database character varying,
    schema character varying,
    "table" character varying,
    name character varying,
    value text
);


--
-- Name: cauce; Type: TABLE; Schema: sig; Owner: -
--

CREATE TABLE sig.cauce (
    id integer NOT NULL,
    nombre character varying(120),
    tipo character varying(10) NOT NULL,
    fuente character varying(60) NOT NULL,
    geom public.geometry(LineString,5345) NOT NULL,
    largo_km numeric(8,2) NOT NULL,
    CONSTRAINT chk_cauce_tipo CHECK (((tipo)::text = ANY ((ARRAY['RIO'::character varying, 'CANAL'::character varying])::text[])))
);


--
-- Name: cauce_id_seq; Type: SEQUENCE; Schema: sig; Owner: -
--

CREATE SEQUENCE sig.cauce_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cauce_id_seq; Type: SEQUENCE OWNED BY; Schema: sig; Owner: -
--

ALTER SEQUENCE sig.cauce_id_seq OWNED BY sig.cauce.id;


--
-- Name: v_concesiones; Type: VIEW; Schema: sig; Owner: -
--

CREATE VIEW sig.v_concesiones AS
 SELECT p.id AS poligono_id,
    c.id AS concesion_id,
    c.numero,
    (c.estado)::text AS estado,
    (c.tipo_derecho)::text AS tipo_derecho,
    (c.origen)::text AS origen,
    c.anio_otorgamiento,
    (((((e.numero)::text || '/'::text) || (e.reparticion)::text) || '-'::text) || e.anio) AS expediente,
    (e.oficina_actual)::text AS oficina_actual,
    t.titular,
    t.documento,
    (t.cantidad_titulares)::integer AS cantidad_titulares,
    i.departamento,
    i.localidad,
    i.distrito,
    i.cuenca,
    i.padron,
    i.matricula_catastral,
    i.parcela,
    (p.superficie_ha)::double precision AS superficie_ha,
    (cd.caudal_lps)::double precision AS caudal_lps,
    (cd.caracter)::text AS caracter,
    cd.codigo_servicio,
    u.usos,
    s.fuente_principal AS fuente,
    s.sistema_distribucion AS sistema,
    s.canal_principal,
    (p.origen)::text AS origen_poligono,
    p.creado_en AS poligono_desde,
    p.geom
   FROM (((((((public.con_poligono p
     JOIN public.con_concesion c ON ((c.id = p.concesion_id)))
     LEFT JOIN public.exp_expediente e ON ((e.id = c.expediente_id)))
     LEFT JOIN public.con_v_inmueble i ON ((i.concesion_id = c.id)))
     LEFT JOIN public.con_condicion cd ON (((cd.concesion_id = c.id) AND cd.vigente)))
     LEFT JOIN public.con_suministro s ON (((s.concesion_id = c.id) AND s.vigente)))
     LEFT JOIN LATERAL ( SELECT string_agg(
                CASE
                    WHEN (pe.tipo_persona = 'JURIDICA'::public.per_tipo_persona) THEN (pe.razon_social)::text
                    ELSE COALESCE((((pe.apellido)::text || ', '::text) || (pe.nombre)::text), (pe.denominacion)::text)
                END, ' / '::text ORDER BY ct.orden) AS titular,
            (array_agg(pe.documento ORDER BY ct.orden))[1] AS documento,
            count(*) AS cantidad_titulares
           FROM (public.con_titular ct
             JOIN public.per_persona pe ON ((pe.id = ct.persona_id)))
          WHERE ((ct.concesion_id = c.id) AND ct.vigente)) t ON (true))
     LEFT JOIN LATERAL ( SELECT string_agg((tu.nombre)::text, ', '::text ORDER BY cu.orden) AS usos
           FROM (public.con_uso cu
             JOIN public.cat_tipo_uso tu ON (((tu.codigo)::text = (cu.tipo_uso_codigo)::text)))
          WHERE ((cu.concesion_id = c.id) AND cu.vigente)) u ON (true))
  WHERE (p.vigente AND (c.estado <> ALL (ARRAY['ANULADA'::public.con_estado_concesion, 'DENEGADA'::public.con_estado_concesion])));


--
-- Name: v_pozos; Type: VIEW; Schema: sig; Owner: -
--

CREATE VIEW sig.v_pozos AS
 SELECT p.id AS pozo_id,
    p.id_interno,
    p.alias,
    (p.estado)::text AS estado,
    (p.origen)::text AS origen,
    p.tipo_pozo,
    p.jurisdiccion_drh,
    (p.profundidad_real)::double precision AS profundidad_m,
    (p.nivel_estatico)::double precision AS nivel_estatico_m,
    (p.nivel_dinamico)::double precision AS nivel_dinamico_m,
    (p.caudal_bombeo_m3h)::double precision AS caudal_m3h,
    (p.caudal_bombeo_lps)::double precision AS caudal_lps,
    (round((public.st_x(p.geom))::numeric, 2))::double precision AS coord_x,
    (round((public.st_y(p.geom))::numeric, 2))::double precision AS coord_y,
    p.concesion_id,
    c.numero AS concesion_numero,
    c.titular,
    c.departamento,
    c.localidad,
        CASE
            WHEN (c.geom IS NULL) THEN NULL::boolean
            ELSE public.st_within(p.geom, c.geom)
        END AS dentro_de_concesion,
    p.geom
   FROM (public.poz_pozo p
     LEFT JOIN sig.v_concesiones c ON ((c.concesion_id = p.concesion_id)))
  WHERE (p.estado <> 'ANULADO'::public.poz_estado_pozo);


--
-- Name: cat_cuenca id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_cuenca ALTER COLUMN id SET DEFAULT nextval('public.cat_cuenca_id_seq'::regclass);


--
-- Name: cat_departamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_departamento ALTER COLUMN id SET DEFAULT nextval('public.cat_departamento_id_seq'::regclass);


--
-- Name: cat_distrito id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_distrito ALTER COLUMN id SET DEFAULT nextval('public.cat_distrito_id_seq'::regclass);


--
-- Name: cat_documento_requerido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_documento_requerido ALTER COLUMN id SET DEFAULT nextval('public.cat_documento_requerido_id_seq'::regclass);


--
-- Name: cat_localidad id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_localidad ALTER COLUMN id SET DEFAULT nextval('public.cat_localidad_id_seq'::regclass);


--
-- Name: con_concesion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_concesion ALTER COLUMN id SET DEFAULT nextval('public.con_concesion_id_seq'::regclass);


--
-- Name: con_condicion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_condicion ALTER COLUMN id SET DEFAULT nextval('public.con_condicion_id_seq'::regclass);


--
-- Name: con_domicilio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio ALTER COLUMN id SET DEFAULT nextval('public.con_domicilio_id_seq'::regclass);


--
-- Name: con_inmueble id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble ALTER COLUMN id SET DEFAULT nextval('public.con_inmueble_id_seq'::regclass);


--
-- Name: con_poligono id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_poligono ALTER COLUMN id SET DEFAULT nextval('public.con_poligono_id_seq'::regclass);


--
-- Name: con_punto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_punto ALTER COLUMN id SET DEFAULT nextval('public.con_punto_id_seq'::regclass);


--
-- Name: con_suministro id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_suministro ALTER COLUMN id SET DEFAULT nextval('public.con_suministro_id_seq'::regclass);


--
-- Name: con_titular id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_titular ALTER COLUMN id SET DEFAULT nextval('public.con_titular_id_seq'::regclass);


--
-- Name: con_uso id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_uso ALTER COLUMN id SET DEFAULT nextval('public.con_uso_id_seq'::regclass);


--
-- Name: emp_empresa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emp_empresa ALTER COLUMN id SET DEFAULT nextval('public.emp_empresa_id_seq'::regclass);


--
-- Name: emp_maquina id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emp_maquina ALTER COLUMN id SET DEFAULT nextval('public.emp_maquina_id_seq'::regclass);


--
-- Name: exp_actuacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_actuacion ALTER COLUMN id SET DEFAULT nextval('public.exp_actuacion_id_seq'::regclass);


--
-- Name: exp_documentacion_presentada id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_documentacion_presentada ALTER COLUMN id SET DEFAULT nextval('public.exp_documentacion_presentada_id_seq'::regclass);


--
-- Name: exp_expediente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_expediente ALTER COLUMN id SET DEFAULT nextval('public.exp_expediente_id_seq'::regclass);


--
-- Name: exp_movimiento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimiento ALTER COLUMN id SET DEFAULT nextval('public.exp_movimiento_id_seq'::regclass);


--
-- Name: exp_resolucion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_resolucion ALTER COLUMN id SET DEFAULT nextval('public.exp_resolucion_id_seq'::regclass);


--
-- Name: mig_lote id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mig_lote ALTER COLUMN id SET DEFAULT nextval('public.mig_lote_id_seq'::regclass);


--
-- Name: mig_registro_origen id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mig_registro_origen ALTER COLUMN id SET DEFAULT nextval('public.mig_registro_origen_id_seq'::regclass);


--
-- Name: per_persona id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.per_persona ALTER COLUMN id SET DEFAULT nextval('public.per_persona_id_seq'::regclass);


--
-- Name: poz_baja id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja ALTER COLUMN id SET DEFAULT nextval('public.poz_baja_id_seq'::regclass);


--
-- Name: poz_pozo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_pozo ALTER COLUMN id SET DEFAULT nextval('public.poz_pozo_id_seq'::regclass);


--
-- Name: rec_deuda id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda ALTER COLUMN id SET DEFAULT nextval('public.rec_deuda_id_seq'::regclass);


--
-- Name: seg_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seg_usuario ALTER COLUMN id SET DEFAULT nextval('public.seg_usuario_id_seq'::regclass);


--
-- Name: cauce id; Type: DEFAULT; Schema: sig; Owner: -
--

ALTER TABLE ONLY sig.cauce ALTER COLUMN id SET DEFAULT nextval('sig.cauce_id_seq'::regclass);


--
-- Name: con_punto PK_31b3fca937b2c13cfd16f131dd4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_punto
    ADD CONSTRAINT "PK_31b3fca937b2c13cfd16f131dd4" PRIMARY KEY (id);


--
-- Name: con_poligono PK_341a9357d69e3204eb15b9a0996; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_poligono
    ADD CONSTRAINT "PK_341a9357d69e3204eb15b9a0996" PRIMARY KEY (id);


--
-- Name: cat_departamento PK_403f6fab020fa2ff33794c6ae5b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_departamento
    ADD CONSTRAINT "PK_403f6fab020fa2ff33794c6ae5b" PRIMARY KEY (id);


--
-- Name: emp_empresa PK_4615954e5b06348a47ca45a7aec; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emp_empresa
    ADD CONSTRAINT "PK_4615954e5b06348a47ca45a7aec" PRIMARY KEY (id);


--
-- Name: cat_distrito PK_4dce36207db6745e539f3e592e4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_distrito
    ADD CONSTRAINT "PK_4dce36207db6745e539f3e592e4" PRIMARY KEY (id);


--
-- Name: cat_situacion_legal PK_5f854be0d61825e44feaefe2675; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_situacion_legal
    ADD CONSTRAINT "PK_5f854be0d61825e44feaefe2675" PRIMARY KEY (codigo);


--
-- Name: con_suministro PK_65f7265e80a63f64a7304733002; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_suministro
    ADD CONSTRAINT "PK_65f7265e80a63f64a7304733002" PRIMARY KEY (id);


--
-- Name: cat_localidad PK_6caddc7c210a09aa4882b1db56b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_localidad
    ADD CONSTRAINT "PK_6caddc7c210a09aa4882b1db56b" PRIMARY KEY (id);


--
-- Name: con_domicilio PK_732a4a23ce9d60d9e1aa07fd40f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT "PK_732a4a23ce9d60d9e1aa07fd40f" PRIMARY KEY (id);


--
-- Name: exp_documentacion_presentada PK_75ddb0958a962cee39563570cf7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_documentacion_presentada
    ADD CONSTRAINT "PK_75ddb0958a962cee39563570cf7" PRIMARY KEY (id);


--
-- Name: per_persona PK_76c99a5ea529d43acbf08768573; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.per_persona
    ADD CONSTRAINT "PK_76c99a5ea529d43acbf08768573" PRIMARY KEY (id);


--
-- Name: poz_baja PK_7d4d50f2221ee7f5b7dbbc6be72; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja
    ADD CONSTRAINT "PK_7d4d50f2221ee7f5b7dbbc6be72" PRIMARY KEY (id);


--
-- Name: exp_actuacion PK_85b0ae7cee8cc4c67e258229b00; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_actuacion
    ADD CONSTRAINT "PK_85b0ae7cee8cc4c67e258229b00" PRIMARY KEY (id);


--
-- Name: exp_expediente PK_8eb3321e70d17b2b652bfb39991; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_expediente
    ADD CONSTRAINT "PK_8eb3321e70d17b2b652bfb39991" PRIMARY KEY (id);


--
-- Name: seg_oficina PK_914e7923c55de19cfdb3015a161; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seg_oficina
    ADD CONSTRAINT "PK_914e7923c55de19cfdb3015a161" PRIMARY KEY (codigo);


--
-- Name: cat_documento_requerido PK_942f9fc402dee1e18792b7d491d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_documento_requerido
    ADD CONSTRAINT "PK_942f9fc402dee1e18792b7d491d" PRIMARY KEY (id);


--
-- Name: exp_movimiento PK_95f70f687b0c7adb9d206101e8c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimiento
    ADD CONSTRAINT "PK_95f70f687b0c7adb9d206101e8c" PRIMARY KEY (id);


--
-- Name: con_inmueble PK_a5b0ff12d65504b0a612d04fc98; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT "PK_a5b0ff12d65504b0a612d04fc98" PRIMARY KEY (id);


--
-- Name: con_uso PK_b7a1e6403f690fd882b8eb39e7b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_uso
    ADD CONSTRAINT "PK_b7a1e6403f690fd882b8eb39e7b" PRIMARY KEY (id);


--
-- Name: con_titular PK_bc64343ba1041e7483496ab3f46; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_titular
    ADD CONSTRAINT "PK_bc64343ba1041e7483496ab3f46" PRIMARY KEY (id);


--
-- Name: seg_usuario PK_bd1cbde7b752168939029ad2d13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seg_usuario
    ADD CONSTRAINT "PK_bd1cbde7b752168939029ad2d13" PRIMARY KEY (id);


--
-- Name: emp_maquina PK_cb368494fdada5e241ac27b9750; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emp_maquina
    ADD CONSTRAINT "PK_cb368494fdada5e241ac27b9750" PRIMARY KEY (id);


--
-- Name: rec_deuda PK_ccd056042dd7caf297f06803d70; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda
    ADD CONSTRAINT "PK_ccd056042dd7caf297f06803d70" PRIMARY KEY (id);


--
-- Name: mig_registro_origen PK_d681a68546230945e73669677db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mig_registro_origen
    ADD CONSTRAINT "PK_d681a68546230945e73669677db" PRIMARY KEY (id);


--
-- Name: con_concesion PK_de8933be57b2d556f242e884fc0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_concesion
    ADD CONSTRAINT "PK_de8933be57b2d556f242e884fc0" PRIMARY KEY (id);


--
-- Name: cat_cuenca PK_e076325f690235ce9f29fd3bfda; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_cuenca
    ADD CONSTRAINT "PK_e076325f690235ce9f29fd3bfda" PRIMARY KEY (id);


--
-- Name: poz_pozo PK_e6ec9c14f0b3e175b6d2024d5c9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_pozo
    ADD CONSTRAINT "PK_e6ec9c14f0b3e175b6d2024d5c9" PRIMARY KEY (id);


--
-- Name: cat_tipo_uso PK_f4763569a6282e03b6f6fbe3bdd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_tipo_uso
    ADD CONSTRAINT "PK_f4763569a6282e03b6f6fbe3bdd" PRIMARY KEY (codigo);


--
-- Name: exp_resolucion PK_f9548ec8ecdb5127d1f483c4ea5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_resolucion
    ADD CONSTRAINT "PK_f9548ec8ecdb5127d1f483c4ea5" PRIMARY KEY (id);


--
-- Name: mig_lote PK_fbaa842d57f2867ff93bf4e33f3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mig_lote
    ADD CONSTRAINT "PK_fbaa842d57f2867ff93bf4e33f3" PRIMARY KEY (id);


--
-- Name: con_condicion PK_fe19c4eed2506c4d55755248d20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_condicion
    ADD CONSTRAINT "PK_fe19c4eed2506c4d55755248d20" PRIMARY KEY (id);


--
-- Name: poz_baja REL_dfc033f34c40798d97a6ca5c3b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja
    ADD CONSTRAINT "REL_dfc033f34c40798d97a6ca5c3b" UNIQUE (expediente_id);


--
-- Name: cat_tipo_uso UQ_a7f97767eb4cbc8103bca04aa61; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_tipo_uso
    ADD CONSTRAINT "UQ_a7f97767eb4cbc8103bca04aa61" UNIQUE (nombre);


--
-- Name: cauce PK_9b60e62bcbabce61e9eb86a9147; Type: CONSTRAINT; Schema: sig; Owner: -
--

ALTER TABLE ONLY sig.cauce
    ADD CONSTRAINT "PK_9b60e62bcbabce61e9eb86a9147" PRIMARY KEY (id);


--
-- Name: idx_actuacion_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actuacion_expediente ON public.exp_actuacion USING btree (expediente_id, fecha);


--
-- Name: idx_baja_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_baja_estado ON public.poz_baja USING btree (estado);


--
-- Name: idx_concesion_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concesion_estado ON public.con_concesion USING btree (estado);


--
-- Name: idx_conuso_concesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conuso_concesion ON public.con_uso USING btree (concesion_id, vigente);


--
-- Name: idx_deuda_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deuda_persona ON public.rec_deuda USING btree (persona_id, estado);


--
-- Name: idx_domicilio_concesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domicilio_concesion ON public.con_domicilio USING btree (concesion_id, vigente);


--
-- Name: idx_empresa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_estado ON public.emp_empresa USING btree (estado);


--
-- Name: idx_exp_bandeja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_bandeja ON public.exp_expediente USING btree (oficina_actual, estado);


--
-- Name: idx_exp_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_documento ON public.exp_expediente USING btree (solicitante_documento);


--
-- Name: idx_exp_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_tipo ON public.exp_expediente USING btree (tipo_tramite, estado);


--
-- Name: idx_inmueble_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inmueble_matricula ON public.con_inmueble USING btree (matricula_catastral);


--
-- Name: idx_inmueble_padron; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inmueble_padron ON public.con_inmueble USING btree (padron);


--
-- Name: idx_localidad_distrito; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_localidad_distrito ON public.cat_localidad USING btree (distrito_id);


--
-- Name: idx_maquina_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maquina_empresa ON public.emp_maquina USING btree (empresa_id, activa);


--
-- Name: idx_mig_nuevo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mig_nuevo ON public.mig_registro_origen USING btree (entidad_tipo, id_nuevo);


--
-- Name: idx_mov_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_expediente ON public.exp_movimiento USING btree (expediente_id, fecha);


--
-- Name: idx_mov_oficina; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_oficina ON public.exp_movimiento USING btree (oficina_destino, fecha);


--
-- Name: idx_poligono_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poligono_geom ON public.con_poligono USING gist (geom);


--
-- Name: idx_pozo_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pozo_alias ON public.poz_pozo USING btree (alias);


--
-- Name: idx_pozo_concesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pozo_concesion ON public.poz_pozo USING btree (concesion_id);


--
-- Name: idx_pozo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pozo_estado ON public.poz_pozo USING btree (estado);


--
-- Name: idx_pozo_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pozo_geom ON public.poz_pozo USING gist (geom);


--
-- Name: idx_punto_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_punto_geom ON public.con_punto USING gist (geom);


--
-- Name: idx_titular_concesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_titular_concesion ON public.con_titular USING btree (concesion_id, vigente);


--
-- Name: idx_titular_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_titular_persona ON public.con_titular USING btree (persona_id, vigente);


--
-- Name: uk_baja_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_baja_expediente ON public.poz_baja USING btree (expediente_id);


--
-- Name: uk_baja_pozo_sin_resolver; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_baja_pozo_sin_resolver ON public.poz_baja USING btree (pozo_id) WHERE (estado = ANY (ARRAY['EN_TRAMITE'::public.poz_estado_baja, 'EN_ESPERA'::public.poz_estado_baja, 'OBSERVADA'::public.poz_estado_baja]));


--
-- Name: uk_concesion_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_concesion_numero ON public.con_concesion USING btree (numero);


--
-- Name: uk_condicion_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_condicion_vigente ON public.con_condicion USING btree (concesion_id) WHERE vigente;


--
-- Name: uk_cuenca_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_cuenca_nombre ON public.cat_cuenca USING btree (nombre);


--
-- Name: uk_departamento_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_departamento_nombre ON public.cat_departamento USING btree (nombre);


--
-- Name: uk_distrito_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_distrito_codigo ON public.cat_distrito USING btree (codigo);


--
-- Name: uk_doc_presentada; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_doc_presentada ON public.exp_documentacion_presentada USING btree (expediente_id, documento_requerido_id);


--
-- Name: uk_documento_requerido; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_documento_requerido ON public.cat_documento_requerido USING btree (situacion_legal_codigo, descripcion);


--
-- Name: uk_empresa_cuit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_empresa_cuit ON public.emp_empresa USING btree (cuit);


--
-- Name: uk_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_expediente ON public.exp_expediente USING btree (numero, reparticion, anio);


--
-- Name: uk_inmueble_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_inmueble_vigente ON public.con_inmueble USING btree (concesion_id) WHERE vigente;


--
-- Name: uk_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_localidad ON public.cat_localidad USING btree (departamento_id, nombre);


--
-- Name: uk_maquina_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_maquina_codigo ON public.emp_maquina USING btree (codigo);


--
-- Name: uk_mig_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_mig_origen ON public.mig_registro_origen USING btree (entidad_tipo, id_origen);


--
-- Name: uk_persona_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_persona_documento ON public.per_persona USING btree (documento) WHERE (documento IS NOT NULL);


--
-- Name: uk_poligono_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_poligono_vigente ON public.con_poligono USING btree (concesion_id) WHERE vigente;


--
-- Name: uk_pozo_interno; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_pozo_interno ON public.poz_pozo USING btree (id_interno);


--
-- Name: uk_punto_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_punto_vigente ON public.con_punto USING btree (concesion_id, tipo) WHERE vigente;


--
-- Name: uk_resolucion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_resolucion ON public.exp_resolucion USING btree (numero, anio);


--
-- Name: uk_suministro_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_suministro_vigente ON public.con_suministro USING btree (concesion_id) WHERE vigente;


--
-- Name: uk_titular_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_titular_vigente ON public.con_titular USING btree (concesion_id, persona_id) WHERE vigente;


--
-- Name: uk_usuario_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_usuario_email ON public.seg_usuario USING btree (email);


--
-- Name: uk_usuario_legajo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_usuario_legajo ON public.seg_usuario USING btree (legajo);


--
-- Name: idx_cauce_geom; Type: INDEX; Schema: sig; Owner: -
--

CREATE INDEX idx_cauce_geom ON sig.cauce USING gist (geom);


--
-- Name: idx_cauce_nombre; Type: INDEX; Schema: sig; Owner: -
--

CREATE INDEX idx_cauce_nombre ON sig.cauce USING btree (nombre);


--
-- Name: exp_actuacion fk_actuacion_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_actuacion
    ADD CONSTRAINT fk_actuacion_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: exp_actuacion fk_actuacion_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_actuacion
    ADD CONSTRAINT fk_actuacion_usuario FOREIGN KEY (usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: poz_baja fk_baja_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja
    ADD CONSTRAINT fk_baja_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: poz_baja fk_baja_pozo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja
    ADD CONSTRAINT fk_baja_pozo FOREIGN KEY (pozo_id) REFERENCES public.poz_pozo(id) ON DELETE RESTRICT;


--
-- Name: poz_baja fk_baja_resolucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_baja
    ADD CONSTRAINT fk_baja_resolucion FOREIGN KEY (resolucion_id) REFERENCES public.exp_resolucion(id) ON DELETE RESTRICT;


--
-- Name: con_concesion fk_concesion_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_concesion
    ADD CONSTRAINT fk_concesion_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_concesion fk_concesion_resolucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_concesion
    ADD CONSTRAINT fk_concesion_resolucion FOREIGN KEY (resolucion_id) REFERENCES public.exp_resolucion(id) ON DELETE RESTRICT;


--
-- Name: con_concesion fk_concesion_situacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_concesion
    ADD CONSTRAINT fk_concesion_situacion FOREIGN KEY (situacion_legal_codigo) REFERENCES public.cat_situacion_legal(codigo) ON DELETE RESTRICT;


--
-- Name: con_condicion fk_condicion_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_condicion
    ADD CONSTRAINT fk_condicion_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_condicion fk_condicion_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_condicion
    ADD CONSTRAINT fk_condicion_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_uso fk_conuso_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_uso
    ADD CONSTRAINT fk_conuso_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_uso fk_conuso_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_uso
    ADD CONSTRAINT fk_conuso_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_uso fk_conuso_tipo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_uso
    ADD CONSTRAINT fk_conuso_tipo FOREIGN KEY (tipo_uso_codigo) REFERENCES public.cat_tipo_uso(codigo) ON DELETE RESTRICT;


--
-- Name: rec_deuda fk_deuda_cancelado_por; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda
    ADD CONSTRAINT fk_deuda_cancelado_por FOREIGN KEY (cancelado_por_usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: rec_deuda fk_deuda_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda
    ADD CONSTRAINT fk_deuda_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: rec_deuda fk_deuda_persona; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda
    ADD CONSTRAINT fk_deuda_persona FOREIGN KEY (persona_id) REFERENCES public.per_persona(id) ON DELETE RESTRICT;


--
-- Name: rec_deuda fk_deuda_registrado_por; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rec_deuda
    ADD CONSTRAINT fk_deuda_registrado_por FOREIGN KEY (registrado_por_usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: exp_documentacion_presentada fk_docpres_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_documentacion_presentada
    ADD CONSTRAINT fk_docpres_documento FOREIGN KEY (documento_requerido_id) REFERENCES public.cat_documento_requerido(id) ON DELETE RESTRICT;


--
-- Name: exp_documentacion_presentada fk_docpres_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_documentacion_presentada
    ADD CONSTRAINT fk_docpres_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: cat_documento_requerido fk_docreq_situacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_documento_requerido
    ADD CONSTRAINT fk_docreq_situacion FOREIGN KEY (situacion_legal_codigo) REFERENCES public.cat_situacion_legal(codigo) ON DELETE RESTRICT;


--
-- Name: con_domicilio fk_domicilio_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT fk_domicilio_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_domicilio fk_domicilio_departamento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT fk_domicilio_departamento FOREIGN KEY (departamento_id) REFERENCES public.cat_departamento(id) ON DELETE RESTRICT;


--
-- Name: con_domicilio fk_domicilio_distrito; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT fk_domicilio_distrito FOREIGN KEY (distrito_id) REFERENCES public.cat_distrito(id) ON DELETE RESTRICT;


--
-- Name: con_domicilio fk_domicilio_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT fk_domicilio_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_domicilio fk_domicilio_localidad; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_domicilio
    ADD CONSTRAINT fk_domicilio_localidad FOREIGN KEY (localidad_id) REFERENCES public.cat_localidad(id) ON DELETE RESTRICT;


--
-- Name: exp_expediente fk_exp_tomado_por; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_expediente
    ADD CONSTRAINT fk_exp_tomado_por FOREIGN KEY (tomado_por_usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_cuenca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_cuenca FOREIGN KEY (cuenca_id) REFERENCES public.cat_cuenca(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_departamento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_departamento FOREIGN KEY (departamento_id) REFERENCES public.cat_departamento(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_distrito; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_distrito FOREIGN KEY (distrito_id) REFERENCES public.cat_distrito(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_inmueble fk_inmueble_localidad; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_inmueble
    ADD CONSTRAINT fk_inmueble_localidad FOREIGN KEY (localidad_id) REFERENCES public.cat_localidad(id) ON DELETE RESTRICT;


--
-- Name: cat_localidad fk_localidad_departamento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_localidad
    ADD CONSTRAINT fk_localidad_departamento FOREIGN KEY (departamento_id) REFERENCES public.cat_departamento(id) ON DELETE RESTRICT;


--
-- Name: cat_localidad fk_localidad_distrito; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cat_localidad
    ADD CONSTRAINT fk_localidad_distrito FOREIGN KEY (distrito_id) REFERENCES public.cat_distrito(id) ON DELETE RESTRICT;


--
-- Name: emp_maquina fk_maquina_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emp_maquina
    ADD CONSTRAINT fk_maquina_empresa FOREIGN KEY (empresa_id) REFERENCES public.emp_empresa(id) ON DELETE RESTRICT;


--
-- Name: mig_registro_origen fk_mig_lote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mig_registro_origen
    ADD CONSTRAINT fk_mig_lote FOREIGN KEY (lote_id) REFERENCES public.mig_lote(id) ON DELETE RESTRICT;


--
-- Name: exp_movimiento fk_mov_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimiento
    ADD CONSTRAINT fk_mov_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: exp_movimiento fk_mov_recibido_por; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimiento
    ADD CONSTRAINT fk_mov_recibido_por FOREIGN KEY (recibido_por_usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: exp_movimiento fk_mov_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimiento
    ADD CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: con_poligono fk_poligono_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_poligono
    ADD CONSTRAINT fk_poligono_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_poligono fk_poligono_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_poligono
    ADD CONSTRAINT fk_poligono_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: poz_pozo fk_pozo_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_pozo
    ADD CONSTRAINT fk_pozo_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: poz_pozo fk_pozo_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_pozo
    ADD CONSTRAINT fk_pozo_empresa FOREIGN KEY (empresa_id) REFERENCES public.emp_empresa(id) ON DELETE RESTRICT;


--
-- Name: poz_pozo fk_pozo_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poz_pozo
    ADD CONSTRAINT fk_pozo_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_punto fk_punto_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_punto
    ADD CONSTRAINT fk_punto_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_punto fk_punto_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_punto
    ADD CONSTRAINT fk_punto_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: exp_resolucion fk_res_creado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_resolucion
    ADD CONSTRAINT fk_res_creado FOREIGN KEY (creado_usuario_id) REFERENCES public.seg_usuario(id) ON DELETE RESTRICT;


--
-- Name: exp_resolucion fk_res_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_resolucion
    ADD CONSTRAINT fk_res_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_suministro fk_suministro_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_suministro
    ADD CONSTRAINT fk_suministro_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_suministro fk_suministro_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_suministro
    ADD CONSTRAINT fk_suministro_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_titular fk_titular_concesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_titular
    ADD CONSTRAINT fk_titular_concesion FOREIGN KEY (concesion_id) REFERENCES public.con_concesion(id) ON DELETE RESTRICT;


--
-- Name: con_titular fk_titular_expediente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_titular
    ADD CONSTRAINT fk_titular_expediente FOREIGN KEY (expediente_id) REFERENCES public.exp_expediente(id) ON DELETE RESTRICT;


--
-- Name: con_titular fk_titular_persona; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.con_titular
    ADD CONSTRAINT fk_titular_persona FOREIGN KEY (persona_id) REFERENCES public.per_persona(id) ON DELETE RESTRICT;


--
-- Name: seg_usuario fk_usuario_oficina; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seg_usuario
    ADD CONSTRAINT fk_usuario_oficina FOREIGN KEY (oficina_codigo) REFERENCES public.seg_oficina(codigo) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict ZeHpk3wjePGTtvmBkaFYOwVGUDD499gGGAYNXKYJKkS4yiJ17x9Z3XwBFJMvpuV

