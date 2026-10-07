#!/usr/bin/env bash
# Recorre la Baja de Pozo con los usuarios de prueba, por todos los caminos:
#   A solicitud, completa: falta documentación (en espera) → se completa → antecedentes →
#     evaluación técnica pide subsanar (en espera) → favorable con clausura → Jurídico observa →
#     Pozos corrige → Jurídico apto anulando la concesión → Secretaría aprueba → clausura física
#     → FINALIZADO. Distrito toma conocimiento.
#   A solicitud, rechazada por Secretaría (el pozo sigue en uso).
#   De oficio: en el acto, sin expediente; Distrito también es avisado.
#
#   bash requests/baja-pozo/circuito-completo.sh        (con la API en localhost:3000 y los datos demo cargados)
#
# Usuarios de prueba (GET /api/usuarios): 4 Distrito · 5 Jurídico · 6 Secretaría · 7 Pozos
set -u
API=${API:-http://localhost:3000/api}
BAJA=$API/tramites/baja-pozo
DIS=4; JUR=5; SEC=6; POZ=7
NUM=$(( (10#$(date +%H%M%S)) % 900000 + 100000 ))
ANIO=$(date +%Y); HOY=$(date +%Y-%m-%d)
DOCS_TODOS='["NOTA_SOLICITUD","DOCUMENTO_TITULAR","TITULO_INMUEBLE","LIBRE_DEUDA"]'

# llamar METODO RUTA USUARIO [JSON]  → deja el código en $CODIGO y el cuerpo en $R.
# El JSON va por la entrada estándar: como argumento, en Windows se rompen las tildes.
llamar() {
  local metodo=$1 ruta=$2 usuario=$3 cuerpo=${4:-}
  CODIGO=$(printf '%s' "$cuerpo" | curl -s -o /tmp/drh_resp -w '%{http_code}' -X "$metodo" -H "X-Usuario-Id: $usuario" -H 'Content-Type: application/json' --data-binary @- "$ruta")
  R=$(cat /tmp/drh_resp)
}
campo() { node -e "try { const r=JSON.parse(process.argv[1]); const v=$1; console.log(typeof v==='object'?JSON.stringify(v):v) } catch { console.log('?') }" "$R"; }
paso() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
espera() { # espera CODIGO_ESPERADO DESCRIPCION
  if [[ $CODIGO == "$1" ]]; then printf '  \033[32m✔ %s (HTTP %s)\033[0m' "$2" "$CODIGO"; else printf '  \033[31m✘ %s: esperaba %s y vino %s\033[0m' "$2" "$1" "$CODIGO"; FALLOS=$((FALLOS+1)); fi
  [[ $CODIGO -ge 400 ]] && printf ' → %s' "$(campo 'r.message')"; echo
}
igual() { # igual VALOR ESPERADO DESCRIPCION
  if [[ $1 == "$2" ]]; then printf '  \033[32m✔ %s: %s\033[0m\n' "$3" "$1"; else printf '  \033[31m✘ %s: esperaba %s y vino %s\033[0m\n' "$3" "$2" "$1"; FALLOS=$((FALLOS+1)); fi
}
expediente() { printf '{"numero":"%s","reparticion":"332","anio":%s}' "$1" "$ANIO"; }
solicitud() { # solicitud POZO NUMERO DOCS
  printf '{"pozoId":"%s","expediente":%s,"motivo":"El pozo se secó y el titular pide la baja.","solicitanteNombre":"PEREZ JUAN","solicitanteDocumento":"20123456","documentacionPresentada":%s}' "$1" "$(expediente "$2")" "$3"
}
estado() { echo "$(campo 'r.expediente.oficinaActual')/$(campo 'r.expediente.etapa')/$(campo 'r.expediente.estado')/$(campo 'r.baja.estado')"; }
FALLOS=0

paso "0. Buscar tres pozos en uso, con concesión y sin baja en trámite"
llamar GET "$API/pozos" $POZ
read -r P1 P2 P3 <<< "$(campo "r.filter(p => p.estado === 'EN_USO' && !p.bajaAbierta && p.concesion).slice(0, 3).map(p => p.id).join(' ')")"
if [[ -z ${P3:-} ]]; then echo "  Faltan pozos en uso: cargue los datos demo (npm run demo:cargar)."; exit 1; fi
echo "  pozos $P1, $P2 y $P3"

paso "1. Mesa de entrada (Pozos): inicia la baja de $P1 sin toda la documentación"
llamar POST "$BAJA" $DIS "$(solicitud "$P1" $NUM '[]')"
espera 403 "un usuario de Distrito no puede iniciar la baja"
llamar POST "$BAJA" $POZ "$(solicitud "$P1" $NUM '["NOTA_SOLICITUD"]')"
espera 201 "baja iniciada"; ID=$(campo 'r.expediente.id')
igual "$(estado)" "pozos/INICIO_POZOS/EN_TRAMITE/EN_TRAMITE" "oficina/etapa/expediente/baja"
llamar POST "$BAJA" $POZ "$(solicitud "$P1" $((NUM+1)) "$DOCS_TODOS")"
espera 409 "el pozo ya tiene una baja en trámite"
llamar POST "$BAJA/$ID/documentacion" $POZ '{"resultado":"COMPLETA"}'
espera 400 "no puede decir completa si faltan obligatorios"
llamar POST "$BAJA/$ID/documentacion" $POZ '{"resultado":"PENDIENTE"}'
espera 201 "documentación pendiente"; igual "$(estado)" "pozos/INICIO_POZOS/EN_ESPERA/EN_ESPERA" "queda en espera"
llamar POST "$BAJA" $POZ "$(solicitud "$P1" $((NUM+1)) "$DOCS_TODOS")"
espera 409 "en espera también bloquea otra baja del pozo"
llamar PUT "$BAJA/$ID" $POZ "{\"motivo\":\"El pozo se secó y el titular pide la baja.\",\"solicitanteNombre\":\"PEREZ JUAN\",\"documentacionPresentada\":$DOCS_TODOS}"
espera 200 "se completa la documentación"
llamar POST "$BAJA/$ID/documentacion" $POZ '{"resultado":"COMPLETA"}'
espera 201 "documentación completa"; igual "$(estado)" "pozos/ANTECEDENTES_POZOS/EN_TRAMITE/EN_TRAMITE" "se reanuda en antecedentes"

paso "2. Pozos: antecedentes y evaluación técnica"
llamar POST "$BAJA/$ID/evaluacion-tecnica" $POZ '{"resultado":"FAVORABLE","inspeccionRealizada":false,"informeTecnico":"x","requiereClausura":false}'
espera 409 "no se puede evaluar antes de verificar antecedentes"
llamar POST "$BAJA/$ID/antecedentes" $POZ '{"observaciones":"Titular y ubicación coinciden con el registro."}'
espera 201 "antecedentes verificados"; igual "$(campo 'r.expediente.etapa')" EVALUACION_TECNICA_POZOS "etapa"
llamar POST "$BAJA/$ID/evaluacion-tecnica" $POZ '{"resultado":"REQUIERE_SUBSANACION","inspeccionRealizada":true,"informeTecnico":"Falta constancia del perforista."}'
espera 400 "inspección sin fecha"
llamar POST "$BAJA/$ID/evaluacion-tecnica" $POZ "{\"resultado\":\"REQUIERE_SUBSANACION\",\"inspeccionRealizada\":true,\"fechaInspeccion\":\"$HOY\",\"informeTecnico\":\"Falta constancia del perforista.\"}"
espera 201 "requiere subsanación"; igual "$(estado)" "pozos/EVALUACION_TECNICA_POZOS/EN_ESPERA/EN_ESPERA" "queda en espera"
llamar POST "$BAJA/$ID/evaluacion-tecnica" $POZ "{\"resultado\":\"FAVORABLE\",\"inspeccionRealizada\":true,\"fechaInspeccion\":\"$HOY\",\"informeTecnico\":\"Pozo seco, sin equipo de bombeo.\"}"
espera 400 "favorable sin decir si corresponde clausura"
llamar POST "$BAJA/$ID/evaluacion-tecnica" $POZ "{\"resultado\":\"FAVORABLE\",\"inspeccionRealizada\":true,\"fechaInspeccion\":\"$HOY\",\"informeTecnico\":\"Pozo seco, sin equipo de bombeo. Corresponde sellarlo.\",\"requiereClausura\":true}"
espera 201 "evaluación favorable"; igual "$(estado)" "juridico/JURIDICO/EN_TRAMITE/EN_TRAMITE" "pasa a Jurídico"

paso "3. Jurídico observa; Pozos corrige y reenvía; Jurídico da el apto y anula la concesión"
llamar POST "$API/expedientes/$ID/tomar" $JUR
espera 201 "Jurídico lo toma"
llamar POST "$BAJA/$ID/juridico" $JUR '{"resultado":"APTO"}'
espera 400 "apto sin decidir sobre la concesión"
llamar POST "$BAJA/$ID/juridico" $JUR '{"resultado":"OBSERVADO","observaciones":"Falta el poder del presentante."}'
espera 201 "observado"; igual "$(estado)" "pozos/CORRECCION_POZOS/OBSERVADO/OBSERVADA" "vuelve a Pozos"
llamar POST "$API/expedientes/$ID/tomar" $POZ
llamar POST "$BAJA/$ID/reenviar" $POZ '{"observaciones":"Se agregó el poder."}'
espera 201 "reenviado"; igual "$(campo 'r.expediente.oficinaActual')" juridico "vuelve a Jurídico"
llamar POST "$API/expedientes/$ID/tomar" $JUR
llamar POST "$BAJA/$ID/juridico" $JUR '{"resultado":"APTO","anularConcesion":true}'
espera 201 "Jurídico apto"; igual "$(campo 'r.expediente.oficinaActual')/$(campo 'r.baja.anularConcesion')" "secretaria_general/true" "pasa a Secretaría, anulando la concesión"

paso "4. Secretaría aprueba: pozo dado de baja, concesión anulada, falta la clausura"
llamar POST "$API/expedientes/$ID/tomar" $SEC
RES=$(( NUM % 90000 + 10000 ))
llamar POST "$BAJA/$ID/resolucion" $SEC "{\"decision\":\"RECHAZAR\",\"numero\":\"$RES\",\"anio\":$ANIO,\"fecha\":\"$HOY\"}"
espera 400 "rechazo sin motivo"
llamar POST "$BAJA/$ID/resolucion" $SEC "{\"decision\":\"APROBAR\",\"numero\":\"$RES\",\"anio\":$ANIO,\"fecha\":\"$HOY\"}"
espera 201 "resolución $RES/$ANIO"
igual "$(estado)" "pozos/CLAUSURA_POZOS/EN_TRAMITE/CLAUSURA_PENDIENTE" "pasa a clausura física"
igual "$(campo 'r.pozo.estado')/$(campo 'r.pozo.concesion')/$(campo 'r.pozo.bajaConfirmada.concesionAnulada')" "BAJA/null/true" "pozo/concesión/anulada"

paso "5. Pozos registra la clausura física: el trámite finaliza"
llamar POST "$API/expedientes/$ID/tomar" $POZ
llamar POST "$BAJA/$ID/clausura" $POZ "{\"fecha\":\"2099-01-01\",\"acta\":\"A-1\"}"
espera 400 "fecha futura"
llamar POST "$BAJA/$ID/clausura" $POZ "{\"fecha\":\"$HOY\",\"acta\":\"ACTA-$NUM\",\"observaciones\":\"Sellado con tapón de hormigón.\"}"
espera 201 "clausura registrada"
igual "$(campo 'r.expediente.estado')/$(campo 'r.baja.estado')/$(campo 'r.baja.clausura.acta')" "FINALIZADO/CONFIRMADA/ACTA-$NUM" "expediente/baja/acta"

paso "6. Baja a solicitud de $P2: Secretaría la rechaza"
llamar POST "$BAJA" $POZ "$(solicitud "$P2" $((NUM+2)) "$DOCS_TODOS")"
espera 201 "baja iniciada"; ID2=$(campo 'r.expediente.id')
llamar POST "$BAJA/$ID2/documentacion" $POZ '{"resultado":"COMPLETA"}'
llamar POST "$BAJA/$ID2/antecedentes" $POZ '{}'
llamar POST "$BAJA/$ID2/evaluacion-tecnica" $POZ '{"resultado":"FAVORABLE","inspeccionRealizada":false,"informeTecnico":"Sin observaciones.","requiereClausura":false}'
llamar POST "$API/expedientes/$ID2/tomar" $JUR
llamar POST "$BAJA/$ID2/juridico" $JUR '{"resultado":"APTO","anularConcesion":false}'
llamar POST "$API/expedientes/$ID2/tomar" $SEC
llamar POST "$BAJA/$ID2/resolucion" $SEC "{\"decision\":\"RECHAZAR\",\"numero\":\"$((RES+1))\",\"anio\":$ANIO,\"fecha\":\"$HOY\",\"observaciones\":\"El pozo abastece a otros usuarios del consorcio.\"}"
espera 201 "resolución de rechazo"
igual "$(campo 'r.expediente.estado')/$(campo 'r.baja.estado')/$(campo 'r.pozo.estado')" "RECHAZADO/RECHAZADA/EN_USO" "expediente/baja/pozo"

paso "7. Baja DE OFICIO de $P3: en el acto, sin expediente ni circuito"
llamar POST "$BAJA/de-oficio/$P3" $DIS '{"motivo":"Pozo inexistente en el lugar."}'
espera 403 "un usuario de Distrito no puede dar de baja de oficio"
llamar POST "$BAJA/de-oficio/$P3" $POZ '{"motivo":"Pozo inexistente en el lugar, verificado en recorrida."}'
espera 201 "dado de baja de oficio"
igual "$(campo 'r.estado')/$(campo 'r.bajaConfirmada.origen')/$(campo 'r.bajaConfirmada.expediente')" "BAJA/DE_OFICIO/null" "pozo/origen/expediente"

paso "8. Distrito toma conocimiento (no dictamina)"
llamar GET "$BAJA/avisos-distrito" $DIS
AVISO1=$(campo "r.find(a => a.expedienteId === '$ID')?.bajaId")
AVISO3=$(campo "r.find(a => a.pozo.id === '$P3')?.bajaId")
igual "$( [[ $AVISO1 != undefined && $AVISO3 != undefined ]] && echo si || echo no)" si "le llegaron la baja aprobada y la de oficio"
igual "$(campo "r.some(a => a.expedienteId === '$ID2')")" false "la rechazada no se avisa"
llamar POST "$BAJA/avisos-distrito/$AVISO1/visto" $POZ
espera 403 "solo Distrito toma conocimiento"
llamar POST "$BAJA/avisos-distrito/$AVISO1/visto" $DIS
espera 201 "Distrito tomó conocimiento"
llamar POST "$BAJA/avisos-distrito/$AVISO3/visto" $DIS
espera 201 "Distrito tomó conocimiento de la de oficio"
llamar GET "$BAJA/avisos-distrito" $DIS
igual "$(campo "r.some(a => a.bajaId === '$AVISO1' || a.bajaId === '$AVISO3')")" false "ya no figuran como pendientes"

paso "9. Historial de la primera baja"
llamar GET "$API/expedientes/$ID/historial" $POZ
campo "r.map(h => '  ' + (h.tipo === 'PASE' ? (h.oficinaOrigen ?? '—') + ' → ' + h.oficinaDestino + (h.recibidoPor ? ' (tomó ' + h.recibidoPor + ')' : '') : h.oficina + ': ' + h.actuacion + ' ' + h.resultado)).join('\n')"

echo
if [[ $FALLOS -eq 0 ]]; then printf '\033[32mTodo bien.\033[0m\n'; else printf '\033[31m%s verificaciones fallaron.\033[0m\n' "$FALLOS"; exit 1; fi
