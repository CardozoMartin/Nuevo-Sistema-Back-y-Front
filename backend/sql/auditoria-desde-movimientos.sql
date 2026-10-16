-- Reconstruye la auditoría (exp_auditoria) de los expedientes cargados ANTES de que existiera,
-- a partir de los pases (exp_movimiento). Solo toca los expedientes que no tienen ninguna fila de
-- auditoría, así que se puede correr más de una vez.
--
-- Lo que se recupera: quién lo inició, cada pase o devolución, quién lo tomó en cada oficina y,
-- si ya terminó, el cierre (con el último usuario que lo modificó: es lo único que había).
-- Los cambios de estado intermedios (observado, en espera) no se guardaban: no se pueden recuperar.
--
-- Uso: docker exec -i drh-postgres psql -U drh -d pruebas_de_cargas < sql/auditoria-desde-movimientos.sql

BEGIN;

CREATE TEMP TABLE sin_auditoria ON COMMIT DROP AS
SELECT e.id FROM exp_expediente e
WHERE NOT EXISTS (SELECT 1 FROM exp_auditoria a WHERE a.expediente_id = e.id);

INSERT INTO exp_auditoria (expediente_id, accion, fecha, usuario_id, oficina, oficina_destino, etapa, estado_anterior, estado_nuevo)
SELECT * FROM (
  -- Inicio: el movimiento de apertura (sin oficina de origen).
  SELECT m.expediente_id, 'INICIO'::exp_accion_auditoria, m.fecha, m.usuario_id, m.oficina_destino, NULL::exp_oficina, m.etapa_destino,
         NULL::exp_estado_expediente, NULL::exp_estado_expediente
  FROM exp_movimiento m
  WHERE m.oficina_origen IS NULL AND m.expediente_id IN (SELECT id FROM sin_auditoria)

  UNION ALL
  -- Pases y devoluciones.
  SELECT m.expediente_id, CASE WHEN m.es_devolucion THEN 'DEVOLUCION' ELSE 'PASE' END::exp_accion_auditoria, m.fecha, m.usuario_id,
         m.oficina_origen, m.oficina_destino, m.etapa_destino, NULL, NULL
  FROM exp_movimiento m
  WHERE m.oficina_origen IS NOT NULL AND m.expediente_id IN (SELECT id FROM sin_auditoria)

  UNION ALL
  -- Tomas (la de la apertura no: quien lo inicia ya lo tiene).
  SELECT m.expediente_id, 'TOMA'::exp_accion_auditoria, m.recibido_en, m.recibido_por_usuario_id, m.oficina_destino, NULL, m.etapa_destino, NULL, NULL
  FROM exp_movimiento m
  WHERE m.oficina_origen IS NOT NULL AND m.recibido_por_usuario_id IS NOT NULL AND m.expediente_id IN (SELECT id FROM sin_auditoria)

  UNION ALL
  -- Cierre de los que ya terminaron.
  SELECT e.id, 'CAMBIO_ESTADO'::exp_accion_auditoria, e.modificado_en, COALESCE(e.modificado_usuario_id, e.creado_usuario_id), e.oficina_actual, NULL, e.etapa,
         NULL, e.estado
  FROM exp_expediente e
  WHERE e.estado IN ('FINALIZADO', 'RECHAZADO', 'ARCHIVADO', 'ANULADO') AND e.id IN (SELECT id FROM sin_auditoria)
) filas
ORDER BY 3;

COMMIT;
