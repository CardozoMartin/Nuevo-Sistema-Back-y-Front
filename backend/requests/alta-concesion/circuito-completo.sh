#!/usr/bin/env bash
# Recorre el Alta de Concesión completa, oficina por oficina, con los usuarios de prueba.
# Prueba también los caminos alternativos: deuda (espera y reanudación), observación de
# Distrito (corrección y reenvío), duplicados y rechazo («no apto»).
#
#   bash requests/alta-concesion/circuito-completo.sh        (con la API en localhost:3000)
#
# Usuarios de prueba (GET /api/usuarios): 2 Catastro · 3 Recaudación · 4 Distrito · 5 Jurídico · 6 Secretaría
set -u
cd "$(dirname "$0")"
API=${API:-http://localhost:3000/api}
ALTA=$API/tramites/alta-concesion
CAT=2; REC=3; DIS=4; JUR=5; SEC=6
NUM=$(( (10#$(date +%H%M%S)) % 900000 + 100000 ))   # número de expediente distinto en cada corrida
ANIO=$(date +%Y)

# llamar METODO RUTA USUARIO [JSON | @archivo | -F ...]  → imprime «HTTP xxx» y deja el cuerpo en $R
llamar() {
  local metodo=$1 ruta=$2 usuario=$3; shift 3
  local args=(-s -o /tmp/drh_resp -w '%{http_code}' -X "$metodo" -H "X-Usuario-Id: $usuario")
  local cuerpo=''
  if [[ $# -gt 0 && $1 == -F* ]]; then args+=("$@")
  elif [[ $# -gt 0 && $1 == @* ]]; then args+=(-H 'Content-Type: application/json' --data-binary "$1")
  # El JSON escrito en el script va por la entrada estándar: como argumento, en Windows
  # bash se lo pasa a curl en otra codificación y se rompen las tildes.
  elif [[ $# -gt 0 ]]; then args+=(-H 'Content-Type: application/json' --data-binary @-); cuerpo=$1; fi
  CODIGO=$(printf '%s' "$cuerpo" | curl "${args[@]}" "$ruta"); R=$(cat /tmp/drh_resp)
}
campo() { node -e "try { const r=JSON.parse(process.argv[1]); const v=$1; console.log(typeof v==='object'?JSON.stringify(v):v) } catch { console.log('?') }" "$R"; }
paso() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
espera() { # espera CODIGO_ESPERADO DESCRIPCION
  if [[ $CODIGO == "$1" ]]; then printf '  \033[32m✔ %s (HTTP %s)\033[0m' "$2" "$CODIGO"; else printf '  \033[31m✘ %s: esperaba %s y vino %s\033[0m' "$2" "$1" "$CODIGO"; FALLOS=$((FALLOS+1)); fi
  [[ $CODIGO -ge 400 ]] && printf ' → %s' "$(campo 'r.message')"; echo
}
FALLOS=0

# Polígonos propios de esta corrida: si se usara siempre el mismo KML, desde la segunda
# corrida el sistema lo rechazaría (con razón) por ser una concesión duplicada.
# kml_cuadrado ARCHIVO LON LAT  → parcela de ~200 x 200 m (4 ha) con esquina en (LON, LAT)
kml_cuadrado() {
  local a=$2 b=$3
  local a2 b2; a2=$(node -e "console.log(($a+0.002).toFixed(6))"); b2=$(node -e "console.log(($b+0.0018).toFixed(6))")
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Prueba %s</name><Polygon><outerBoundaryIs><LinearRing><coordinates>%s,%s,0 %s,%s,0 %s,%s,0 %s,%s,0 %s,%s,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>\n' \
    "$NUM" "$a" "$b" "$a2" "$b" "$a2" "$b2" "$a" "$b2" "$a" "$b" > "$1"
}
# Las parcelas van a la vera del Río del Cajón o Tajamar (Burruyacú), como las concesiones reales:
# se toma un vértice del río (distinto en cada corrida) y la parcela empieza ~100 m al este.
# Si la capa de ríos no está cargada (npm run sig:cauces), se usa un lugar fijo de Burruyacú.
read -r LON1 LAT1 LON2 LAT2 <<< "$(curl -s "$API/sig/cauces" | node -e "
  let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => {
    let rio; try { rio = JSON.parse(s).features.find((f) => /tajamar/i.test(f.properties.nombre ?? '')) } catch {}
    if (!rio) return console.log('-64.70 -26.30 -64.70 -26.33');
    const v = rio.geometry.coordinates, i = ${NUM} % v.length, j = (i + Math.floor(v.length / 2)) % v.length;
    const p = ([lon, lat]) => (lon + 0.001).toFixed(6) + ' ' + lat.toFixed(6);
    console.log(p(v[i]) + ' ' + p(v[j]));
  })")"
KML1=$(mktemp --suffix=.kml); KML2=$(mktemp --suffix=.kml)
kml_cuadrado "$KML1" "$LON1" "$LAT1"
kml_cuadrado "$KML2" "$LON2" "$LAT2"

paso "1. Catastro registra el expediente $NUM/332-$ANIO"
llamar POST "$ALTA" $CAT "{\"expediente\":{\"numero\":\"$NUM\",\"reparticion\":\"332\",\"anio\":$ANIO},\"situacionLegal\":\"POSEEDOR\",\"documentacionPresentada\":[2,3]}"
espera 201 "alta iniciada"; ID=$(campo 'r.id'); echo "  expediente id=$ID · $(campo 'r.circuito.etapaNombre') · tomado por $(campo 'r.circuito.tomadoPor.nombre')"
llamar POST "$ALTA" $CAT "{\"expediente\":{\"numero\":\"$NUM\",\"reparticion\":\"332\",\"anio\":$ANIO},\"situacionLegal\":\"POSEEDOR\",\"documentacionPresentada\":[]}"
espera 409 "mismo número de expediente"
llamar POST "$ALTA" $REC "{\"expediente\":{\"numero\":\"1\",\"reparticion\":\"332\",\"anio\":$ANIO},\"situacionLegal\":\"TITULAR\",\"documentacionPresentada\":[]}"
espera 403 "un usuario de Recaudación no puede iniciar un alta"

paso "2. Titulares: ¿la persona ya está cargada?"
llamar GET "$API/personas?documento=23456789" $CAT
if [[ $CODIGO == 200 ]]; then echo "  ya existe: $(campo 'r.persona.apellido+", "+r.persona.nombre') · concesiones: $(campo 'r.concesiones.length')"; else espera 404 "persona nueva"; fi
llamar PUT "$ALTA/$ID/titulares" $CAT @2-titulares.json; espera 200 "titulares guardados"
PERSONA=$(campo 'r.titulares[0].personaId'); echo "  titular principal = persona $PERSONA"
llamar GET "$API/personas?documento=23456789" $CAT; espera 200 "ahora la persona existe"; echo "  concesiones: $(campo 'r.concesiones.map(c=>c.expediente).join(", ")')"

paso "3-6. Resto de la carga"
llamar POST "$ALTA/$ID/enviar" $CAT '{}'; espera 400 "no se puede enviar incompleta"
llamar PUT "$ALTA/$ID/ubicacion" $CAT -F "archivo=@$KML1" -F departamento=BURRUYACU -F "localidad=7 DE ABRIL" -F distrito=II; espera 200 "ubicación (KML)"
MATRICULA="MAT-$NUM"
llamar PUT "$ALTA/$ID/inmueble" $CAT "{\"catastral\":{\"matricula\":\"$MATRICULA\",\"parcela\":\"1-10\",\"circunscripcion\":\"II\",\"seccion\":\"B\"},\"registral\":{\"libro\":\"100\",\"folio\":\"300\",\"anio\":1990}}"; espera 200 "inmueble"
llamar PUT "$ALTA/$ID/usos" $CAT @5-usos.json; espera 200 "usos"
llamar PUT "$ALTA/$ID/suministro" $CAT @6-suministro.json; espera 200 "suministro"; echo "  pasos: $(campo 'r.pasos')"

paso "Catastro envía a Recaudación"
llamar POST "$ALTA/$ID/enviar" $CAT '{"observaciones":"Carga completa."}'; espera 201 "enviado"; echo "  ahora: $(campo 'r.circuito.oficinaNombre') · $(campo 'r.circuito.etapaNombre') · tomado: $(campo 'r.circuito.tomadoPor')"
llamar PUT "$ALTA/$ID/suministro" $CAT @6-suministro.json; espera 409 "Catastro ya no puede editar"

paso "Recaudación"
llamar POST "$ALTA/$ID/recaudacion" $REC '{"resultado":"SIN_DEUDA"}'; espera 409 "sin tomar no puede actuar"
llamar POST "$API/expedientes/$ID/tomar" $CAT; espera 403 "Catastro no puede tomarlo (está en Recaudación)"
llamar POST "$API/expedientes/$ID/tomar" $REC; espera 201 "Recaudación lo toma"
llamar POST "$ALTA/$ID/recaudacion" $REC "{\"resultado\":\"CON_DEUDA\",\"deudas\":[{\"personaId\":\"$PERSONA\",\"detalle\":\"Canon de riego 2025 impago\",\"monto\":125000}],\"observaciones\":\"El titular principal registra deuda.\"}"
espera 201 "con deuda"; echo "  estado: $(campo 'r.circuito.estado')"
llamar POST "$ALTA/$ID/recaudacion" $REC '{"resultado":"SIN_DEUDA"}'; espera 409 "en espera no avanza"
llamar POST "$ALTA/$ID/recaudacion/notificar-deuda" $CAT '{}'; espera 403 "Catastro no notifica la deuda"
llamar POST "$ALTA/$ID/recaudacion/notificar-deuda" $REC '{"observaciones":"Puede regularizar en Av. Brígido Terán 636."}'; espera 201 "aviso de deuda por correo"
echo "  $(campo 'r.enviados.map(e=>e.titular+" → "+e.para.join(",")+" ("+e.estado+")").join("; ")')"
llamar GET "$API/expedientes/$ID/emails" $REC; echo "  correos registrados del expediente: $(campo 'r.length') · asunto: $(campo 'r[0].asunto')"
llamar GET "$API/deudas?personaId=$PERSONA" $REC; DEUDA=$(campo 'r.find(d=>d.estado==="PENDIENTE").id')
llamar POST "$API/deudas/$DEUDA/cancelar" $REC '{"comprobante":"Recibo 0001-00012345"}'; espera 201 "deuda cancelada"; echo "  expedientes reanudados: $(campo 'r.expedientesReanudados')"
llamar POST "$ALTA/$ID/recaudacion" $REC '{"resultado":"SIN_DEUDA","observaciones":"Deuda regularizada."}'; espera 201 "sin deuda → Distrito"

paso "Distrito observa → Catastro corrige → reenvía a Distrito"
llamar POST "$API/expedientes/$ID/tomar" $DIS; espera 201 "Distrito lo toma"
llamar POST "$ALTA/$ID/distrito" $DIS '{"resultado":"OBSERVADO"}'; espera 400 "observar sin motivo"
llamar POST "$ALTA/$ID/distrito" $DIS '{"resultado":"OBSERVADO","observaciones":"Corregir el caudal: el canal no tiene capacidad para 13,5 l/s."}'; espera 201 "observado"; echo "  ahora: $(campo 'r.circuito.oficinaNombre') · $(campo 'r.circuito.etapaNombre') · estado $(campo 'r.circuito.estado')"
llamar POST "$API/expedientes/$ID/tomar" $CAT; espera 201 "Catastro lo toma"
llamar PUT "$ALTA/$ID/suministro" $CAT '{"fuentes":["RIO CALERA"],"sistemaDistribucion":"DIQUE CALERA","canalPrincipal":"MATRIZ","caudalAsignado":10}'; espera 200 "Catastro corrige el caudal"
llamar POST "$ALTA/$ID/reenviar" $CAT '{"observaciones":"Caudal corregido a 10 l/s."}'; espera 201 "reenviado"; echo "  vuelve a: $(campo 'r.circuito.oficinaNombre')"
llamar POST "$API/expedientes/$ID/tomar" $DIS; espera 201 "Distrito lo toma de nuevo"
llamar POST "$ALTA/$ID/distrito" $DIS '{"resultado":"APTO","observaciones":"Hay disponibilidad hídrica."}'; espera 201 "apto → Jurídico"

paso "Jurídico"
llamar POST "$ALTA/$ID/juridico" $JUR '{"resultado":"APTO"}'; espera 409 "sin tomar no puede"
llamar POST "$API/expedientes/$ID/tomar" $JUR; espera 201 "Jurídico lo toma"
llamar POST "$ALTA/$ID/juridico" $JUR '{"resultado":"APTO","observaciones":"Documentación legal en regla."}'; espera 201 "apto → Secretaría General"

paso "Secretaría General"
llamar POST "$API/expedientes/$ID/tomar" $SEC; espera 201 "Secretaría lo toma"
RES=$(( NUM % 9000 + 100 ))
llamar POST "$ALTA/$ID/resolucion" $SEC "{\"numero\":\"$RES\",\"anio\":$ANIO,\"fecha\":\"$ANIO-10-02\"}"; espera 409 "resolución sin número de concesión"
llamar POST "$ALTA/$ID/numero-concesion" $SEC; espera 201 "Secretaría pide el número a Catastro"; echo "  pedido: $(campo 'r.concesion.solicitudNumero.estado')"
llamar POST "$ALTA/$ID/numero-concesion" $SEC; espera 201 "pedirlo de nuevo no crea otro pedido"
llamar POST "$ALTA/$ID/resolucion" $SEC "{\"numero\":\"$RES\",\"anio\":$ANIO,\"fecha\":\"$ANIO-10-02\"}"; espera 409 "resolución antes de que Catastro cargue el número"

paso "Catastro carga el número de concesión (del libro) desde su bandeja"
llamar GET "$API/solicitudes-numero?estado=PENDIENTE&expedienteId=$ID" $CAT; SOL=$(campo 'r[0].id'); echo "  pedidos pendientes del expediente: $(campo 'r.length')"
llamar GET "$API/solicitudes-numero/ultimo-numero" $CAT; echo "  último número registrado (referencia): $(campo 'r.ultimoNumero')"
NUMCON="7$NUM"
llamar POST "$API/solicitudes-numero/$SOL/asignar" $SEC "{\"numeros\":[\"$NUMCON\"]}"; espera 403 "Secretaría no carga el número"
llamar POST "$API/solicitudes-numero/$SOL/asignar" $CAT '{"numeros":["12","13"]}'; espera 400 "un solo número"
llamar POST "$API/solicitudes-numero/$SOL/asignar" $CAT "{\"numeros\":[\"0$NUMCON\"]}"; espera 201 "Catastro carga el número"; echo "  número: $(campo 'r.numeros[0]') (sin el cero a la izquierda) · el expediente sigue en Secretaría"
llamar POST "$API/solicitudes-numero/$SOL/asignar" $CAT "{\"numeros\":[\"$NUMCON\"]}"; espera 409 "no se asigna dos veces"

paso "Secretaría General: resolución"
llamar POST "$ALTA/$ID/resolucion" $SEC "{\"numero\":\"$RES\",\"anio\":$ANIO,\"fecha\":\"$ANIO-10-02\",\"observaciones\":\"Se otorga la concesión.\"}"; espera 201 "resolución → Catastro (cierre)"

paso "Catastro: cierre"
llamar POST "$API/expedientes/$ID/tomar" $CAT; espera 201 "Catastro lo toma"
llamar POST "$ALTA/$ID/padron" $CAT '{"padron":"777001"}'; espera 409 "padrón antes de la verificación final"
llamar POST "$ALTA/$ID/verificacion-final" $CAT '{"observaciones":"Datos completos."}'; espera 201 "verificación final"; echo "  ahora: $(campo 'r.circuito.etapaNombre')"
llamar POST "$ALTA/$ID/padron" $CAT "{\"padron\":\"P-$NUM\"}"; espera 201 "padrón → FINALIZADO"
echo "  expediente: $(campo 'r.circuito.estado') · concesión $(campo 'r.concesion.numero') $(campo 'r.concesion.estado') · resolución $(campo 'r.concesion.resolucion.numero')/$(campo 'r.concesion.resolucion.anio')"
llamar POST "$API/expedientes/$ID/tomar" $CAT; espera 409 "un expediente finalizado ya no circula"

paso "Historial del expediente $ID"
llamar GET "$API/expedientes/$ID/historial" $CAT
node -e "for (const h of JSON.parse(process.argv[1])) { const f=new Date(h.fecha).toLocaleTimeString('es-AR'); console.log(h.tipo==='PASE' ? '  '+f+'  PASE      '+(h.oficinaOrigen??'(ingreso)')+' → '+h.oficinaDestino+'  enviado por '+h.enviadoPor+(h.recibidoPor?' · tomado por '+h.recibidoPor:' · sin tomar')+(h.esDevolucion?' · DEVOLUCIÓN':'') : '  '+f+'  '+h.oficina.padEnd(9)+' '+h.actuacion+' = '+h.resultado+' ('+h.usuario+')'+(h.observaciones?' — '+h.observaciones:'')) }" "$R"

paso "Duplicados: otra alta sobre la misma parcela"
llamar POST "$ALTA" $CAT "{\"expediente\":{\"numero\":\"$((NUM+1))\",\"reparticion\":\"332\",\"anio\":$ANIO},\"situacionLegal\":\"TITULAR\",\"documentacionPresentada\":[1]}"; ID2=$(campo 'r.id')
llamar PUT "$ALTA/$ID2/inmueble" $CAT "{\"catastral\":{\"matricula\":\"$MATRICULA\",\"parcela\":\"9\"},\"registral\":{}}"; espera 409 "misma matrícula catastral"
llamar PUT "$ALTA/$ID2/ubicacion" $CAT -F "archivo=@$KML1" -F departamento=BURRUYACU -F "localidad=7 DE ABRIL" -F distrito=II; espera 409 "mismo polígono"

paso "Catálogo de ubicación: localidad de otro departamento"
llamar PUT "$ALTA/$ID2/titulares" $CAT '{"titulares":[{"tipoPersona":"FISICA","tipoDocumento":"DNI","documento":"23456789","apellido":"Medina","nombre":"Juan Carlos","fechaNacimiento":"1960-01-10","telefono":"381-5555555"}],"domicilios":[{"calle":"Ruta 304","departamento":"LEALES","localidad":"7 DE ABRIL","distrito":"II"}]}'
espera 400 "domicilio con una localidad de Burruyacu en Leales"

paso "Rechazo: la segunda alta (otra parcela) llega a Distrito y es «no apto»"
llamar PUT "$ALTA/$ID2/titulares" $CAT '{"titulares":[{"tipoPersona":"FISICA","tipoDocumento":"DNI","documento":"23456789","apellido":"Medina","nombre":"Juan Carlos","fechaNacimiento":"1960-01-10","telefono":"381-5555555"}],"domicilios":[{"calle":"Ruta 304","departamento":"LEALES","localidad":"VILLA DE LEALES","distrito":"III"}]}'
espera 200 "titular existente reutilizado"; echo "  misma persona: $(campo 'r.titulares[0].personaId') (antes $PERSONA)"
llamar PUT "$ALTA/$ID2/ubicacion" $CAT -F "archivo=@$KML2" -F departamento=BURRUYACU -F "localidad=7 DE ABRIL" -F distrito=II; espera 200 "ubicación (otra parcela)"
llamar PUT "$ALTA/$ID2/inmueble" $CAT "{\"catastral\":{\"matricula\":\"MAT-$((NUM+1))\",\"parcela\":\"9\"},\"registral\":{}}"; espera 200 "inmueble"
llamar PUT "$ALTA/$ID2/usos" $CAT '{"desague":{"x":3630793.87,"y":7088018.41},"items":[{"uso":"agricola-riego","magnitud":4}]}'; espera 200 "usos"
llamar PUT "$ALTA/$ID2/suministro" $CAT '{"fuentes":["RIO SALI"]}'; espera 200 "suministro"
llamar POST "$ALTA/$ID2/enviar" $CAT '{}'; espera 201 "enviado"
llamar POST "$API/expedientes/$ID2/tomar" $REC; llamar POST "$ALTA/$ID2/recaudacion" $REC '{"resultado":"SIN_DEUDA"}'; espera 201 "sin deuda"
llamar POST "$API/expedientes/$ID2/tomar" $DIS
llamar POST "$ALTA/$ID2/distrito" $DIS '{"resultado":"NO_APTO","observaciones":"No hay disponibilidad hídrica en el sistema Río Salí para nuevas concesiones."}'
espera 201 "no apto"; echo "  expediente $(campo 'r.circuito.estado') · concesión $(campo 'r.concesion.estado')"

paso "Polígono optativo: un alta sin KML se puede enviar"
llamar POST "$ALTA" $CAT "{\"expediente\":{\"numero\":\"$((NUM+2))\",\"reparticion\":\"332\",\"anio\":$ANIO},\"situacionLegal\":\"TENEDOR\",\"documentacionPresentada\":[]}"; ID3=$(campo 'r.id')
llamar PUT "$ALTA/$ID3/titulares" $CAT @2-titulares.json; espera 200 "titulares"
llamar PUT "$ALTA/$ID3/ubicacion" $CAT -F departamento=CHICLIGASTA -F "localidad=GASTONA NORTE" -F distrito=V; espera 200 "ubicación sin KML"
echo "  ubicación: $(campo 'r.ubicacion.departamento+" / "+r.ubicacion.localidad+" / "+r.ubicacion.distrito') · polígono: $(campo 'r.ubicacion.poligono')"
llamar PUT "$ALTA/$ID3/ubicacion" $CAT -F departamento=CHICLIGASTA -F "localidad=GASTONA NORTE" -F distrito=II; espera 400 "distrito que no es el de la localidad"
llamar PUT "$ALTA/$ID3/inmueble" $CAT "{\"catastral\":{\"matricula\":\"MAT-$((NUM+2))\",\"parcela\":\"3\"},\"registral\":{}}"; espera 200 "inmueble"
llamar PUT "$ALTA/$ID3/usos" $CAT @5-usos.json; espera 200 "usos"
llamar PUT "$ALTA/$ID3/suministro" $CAT @6-suministro.json; espera 200 "suministro"
llamar POST "$ALTA/$ID3/enviar" $CAT '{}'; espera 201 "enviada a Recaudación sin polígono"

paso "Bandejas"
for o in catastro recaudacion distrito juridico secretaria_general; do llamar GET "$API/expedientes/bandeja/$o" $CAT; echo "  $o: $(campo 'r.length') expediente(s)"; done

echo; if [[ $FALLOS -eq 0 ]]; then printf '\033[32mTodo OK\033[0m\n'; else printf '\033[31m%s verificaciones fallaron\033[0m\n' "$FALLOS"; exit 1; fi
