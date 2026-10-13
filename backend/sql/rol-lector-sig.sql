-- ============================================================================
--  Usuario de solo lectura para QGIS y servidores de mapas (GeoServer, pg_featureserv)
-- ============================================================================
--  Ve SOLO el esquema «sig» (las vistas publicadas, como sig.v_concesiones). No puede
--  leer las tablas de trabajo (titulares con datos personales completos, expedientes…)
--  ni modificar nada.
--
--  Se puede ejecutar varias veces (es idempotente). Uso:
--    docker exec -i drh-postgres psql -U drh -d <DB_NAME del .env> -v clave="'LA_CLAVE'" < sql/rol-lector-sig.sql
-- ============================================================================

-- 1. El rol (si ya existe, solo se le actualiza la clave).
SELECT format('CREATE ROLE drh_lector_sig LOGIN PASSWORD %s', :'clave')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drh_lector_sig')
\gexec
ALTER ROLE drh_lector_sig WITH LOGIN PASSWORD :clave;

-- 2. Puede conectarse a la base, pero no crear nada en public.
GRANT CONNECT ON DATABASE :"DBNAME" TO drh_lector_sig;  -- la base en la que se ejecuta (-d)
REVOKE CREATE ON SCHEMA public FROM drh_lector_sig;

-- 3. Lectura de todo lo que hay (y lo que se agregue después) en el esquema sig.
GRANT USAGE ON SCHEMA sig TO drh_lector_sig;
GRANT SELECT ON ALL TABLES IN SCHEMA sig TO drh_lector_sig;
ALTER DEFAULT PRIVILEGES IN SCHEMA sig GRANT SELECT ON TABLES TO drh_lector_sig;

-- 4. Las vistas de sig leen tablas de public: Postgres las ejecuta con los permisos del
--    DUEÑO de la vista (drh), así que el lector no necesita permisos sobre esas tablas.
--    Sí necesita poder usar las funciones de PostGIS y leer los metadatos geográficos.
GRANT USAGE ON SCHEMA public TO drh_lector_sig;
GRANT SELECT ON public.spatial_ref_sys, public.geometry_columns TO drh_lector_sig;
