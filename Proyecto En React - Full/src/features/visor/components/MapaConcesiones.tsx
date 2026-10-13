import { useEffect, useRef, type RefObject } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MultiPolygon } from 'geojson'
import { ponerFondoVisor } from '@/components/map/fondos'
import { CENTRO_TUCUMAN, puntoEtiqueta, type LatLng } from '@/lib/geo'
import { aPosgar, formatearPosgar } from '@/lib/posgar'
import { COLOR_COMPARACION, COLOR_POZO_A_REVISAR, COLOR_POZO_OFICIO, DISTANCIA_MAX_PUNTO_M, TIPOS_PUNTO, ZOOM_ETIQUETAS, colorPozo, formatoHa, formatoNumero, nombreEstado, nombreEstadoPozo, tituloConcesion } from '../estilos'
import type { CapasVisor } from '../filtros'
import { iniciarMedicion, type ResultadoMedicion, type TipoMedicion } from '../medicion'
import type { AtributosConcesion, CauceGeo, ConcesionGeo, PozoGeo, PuntoGeo } from '../types'

/** Escala aproximada (1:N) en la latitud del centro, para una pantalla de 96 ppp. */
function escalaDe(m: L.Map): number {
  const lat = m.getCenter().lat
  const metrosPorPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (m.getZoom() + 8)
  return metrosPorPixel * (96 / 0.0254)
}

/** Marca de «Ir a coordenada»: un pin con el ícono de Material Symbols. */
const ICONO_MARCA = L.divIcon({
  className: '',
  html: '<span class="material-symbols-outlined icon-fill" style="font-size:40px;color:#dc2626;text-shadow:0 1px 3px rgba(0,0,0,.45)">location_on</span>',
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -34],
})

/**
 * Márgenes al encuadrar: los paneles flotan sobre el mapa (barra lateral y panel a la
 * izquierda, herramientas y ficha a la derecha, barra de estado abajo), así que se deja libre
 * esa zona para que lo encuadrado no quede debajo. En pantallas angostas los paneles van arriba.
 */
function margenesLibres(m: L.Map): L.FitBoundsOptions {
  const ancho = m.getSize().x
  return ancho >= 900
    ? { paddingTopLeft: [440, 80], paddingBottomRight: [360, 60] }
    : { paddingTopLeft: [70, 130], paddingBottomRight: [20, 60] }
}

/**
 * Debajo de este zoom las parcelas (de pocas hectáreas) se ven como puntitos: cada concesión
 * se marca además con un círculo de su color, que se puede tocar.
 */
const ZOOM_MARCADORES = 12

/** Alto aproximado de la etiqueta (13 px de letra). */
const ALTO_TEXTO_PX = 16

/** Ancho en píxeles del texto con la letra de la etiqueta (se mide una vez por concesión). */
let medidor: CanvasRenderingContext2D | null = null
function anchoDeTexto(texto: string): number {
  medidor ??= document.createElement('canvas').getContext('2d')
  if (!medidor) return texto.length * 8
  medidor.font = "800 13px 'Public Sans', sans-serif"
  return medidor.measureText(texto).width + 3 // + el contorno blanco
}

/** Texto de la etiqueta: el número de concesión o, si todavía está en trámite, el expediente. */
const textoEtiqueta = (p: AtributosConcesion) => p.numero ?? (p.expediente ? `Exp. ${p.expediente}` : null)

/** Ríos y canales: azul (los canales, punteados). Van debajo de las concesiones. */
const COLOR_RIO = '#2563eb'
const COLOR_CANAL = '#0891b2'

/** Texto del tooltip de un pozo. */
function tooltipPozo(p: PozoGeo['properties']) {
  const datos = [
    p.profundidad_m !== null && `${formatoNumero(p.profundidad_m)} m de profundidad`,
    p.caudal_lps !== null && `${formatoNumero(p.caudal_lps)} l/s`,
  ].filter(Boolean)
  const concesion = p.concesion_numero ? `Concesión ${p.concesion_numero}` : 'Sin concesión'
  const aviso = p.dentro_de_concesion === false ? `<br><span style="color:${COLOR_POZO_A_REVISAR}">⚠ Cae fuera del polígono de su concesión</span>` : ''
  const oficio = p.origen === 'OFICIO' ? `<br><span style="color:${COLOR_POZO_OFICIO}">Registrado de oficio</span>` : ''
  return `<strong>${p.alias ?? 'Pozo'}</strong> · ${p.id_interno}<br>${concesion} · ${nombreEstadoPozo(p.estado)}${datos.length ? `<br>${datos.join(' · ')}` : ''}${oficio}${aviso}`
}

/** Texto del tooltip de un desagüe o punto de entrega: las dos coordenadas, la cargada primero. */
function tooltipPunto(p: PuntoGeo['properties']) {
  const posgar = `POSGAR X ${formatoNumero(p.coord_x, 0)} · Y ${formatoNumero(p.coord_y, 0)}`
  const grados = `${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}`
  const coordenadas = p.sistema_carga === 'WGS84' ? `${grados}<br>${posgar}` : `${posgar}<br>${grados}`
  const concesion = p.concesion_numero ? `Concesión ${p.concesion_numero}` : p.expediente ? `Alta en trámite · Exp. ${p.expediente}` : 'Alta en trámite'
  const lejos = p.distancia_poligono_m !== null && p.distancia_poligono_m > DISTANCIA_MAX_PUNTO_M
  const aviso = lejos ? `<br><span style="color:${COLOR_POZO_A_REVISAR}">⚠ A ${formatoNumero(p.distancia_poligono_m! / 1000)} km del polígono de su concesión</span>` : ''
  return `<strong>${TIPOS_PUNTO[p.tipo].nombre}</strong> · ${concesion}${p.referencia ? `<br>${p.referencia}` : ''}<br>${coordenadas}${aviso}`
}

/** Rombo para los puntos de la sección de usos (los pozos son círculos: no se confunden). */
const iconoPunto = (color: string, aRevisar: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [14, 14],
    html: `<span style="display:block;width:14px;height:14px;transform:rotate(45deg) scale(.75);background:${color};border:${aRevisar ? 3 : 2}px solid ${aRevisar ? COLOR_POZO_A_REVISAR : '#fff'};box-shadow:0 0 2px rgba(0,0,0,.5)"></span>`,
  })

interface Props {
  concesiones: ConcesionGeo[]
  /** Color de cada concesión según el criterio elegido en el panel (estado, uso, distrito…). */
  colorDe: (p: AtributosConcesion) => string
  /** Pozos a dibujar (puntos). Clic en un pozo → selecciona su concesión. */
  pozos?: PozoGeo[]
  /** Desagües y puntos de entrega (rombos). Clic → selecciona su concesión. */
  puntos?: PuntoGeo[]
  /** Ríos y canales (líneas). */
  cauces?: CauceGeo[]
  /** Qué capas se ven. */
  capas: CapasVisor
  /** Pedido de encuadre (ir a un distrito o departamento). `clave` cambia en cada pedido. */
  encuadre?: { recuadro: [number, number, number, number]; clave: number } | null
  seleccionada: number | null
  onSeleccionar: (concesionId: number | null) => void
  /** Polígono que se está comparando (un KML cargado en el visor), en rojo punteado. */
  comparacion?: MultiPolygon | null
  /** Mapa base (id de FONDOS_VISOR). */
  fondo: string
  /** El fondo no respondió: se pasó a `reemplazo` (el padre actualiza su estado y avisa). */
  onFondoFalla: (texto: string, reemplazo: string) => void
  /** Medición activa. `clave` cambia para empezar una nueva del mismo tipo. */
  medicion?: { tipo: TipoMedicion; clave: number } | null
  onMedicion?: (resultado: ResultadoMedicion) => void
  /** Punto de «Ir a coordenada» (se marca con un pin y se centra el mapa). */
  marca?: { lat: number; lng: number; texto: string; clave: number } | null
  /** Zoom y escala actuales, para la barra de estado. */
  onVista?: (vista: { zoom: number; escala: number }) => void
  /** Elemento donde se escribe la posición del cursor (directo en el DOM: cambia en cada movimiento). */
  refCursor?: RefObject<HTMLElement | null>
}

/**
 * Mapa del visor: concesiones (polígonos coloreados según el criterio elegido), pozos (puntos)
 * y ríos y canales (líneas); cada capa se prende y apaga desde el panel.
 *   - Clic en un polígono o en un pozo → selecciona la concesión (y la resalta).
 *   - Al cambiar la selección desde la lista → centra el mapa en esa concesión.
 *   - Al cargar la capa la primera vez → encuadra todas las concesiones.
 *   - «Ir a» un distrito o departamento → encuadra esa zona.
 *   - Si hay un polígono de comparación → lo dibuja encima y lo encuadra.
 *   - Mapa base, mediciones y «Ir a coordenada» los maneja el visor (barra de herramientas).
 *   Mientras se mide, los clics son vértices: no seleccionan concesiones.
 */
export function MapaConcesiones(props: Props) {
  const { concesiones, colorDe, pozos = [], puntos = [], cauces = [], capas, encuadre, seleccionada, onSeleccionar, comparacion } = props
  const { fondo, onFondoFalla, medicion, onMedicion, marca, onVista, refCursor } = props
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.GeoJSON | null>(null)
  const marcadores = useRef<L.LayerGroup | null>(null)
  const capaComparacion = useRef<L.GeoJSON | null>(null)
  const capaPozos = useRef<L.LayerGroup | null>(null)
  const capaPuntos = useRef<L.LayerGroup | null>(null)
  const capaCauces = useRef<L.GeoJSON | null>(null)
  /** Polígono de Leaflet de cada concesión, para resaltarla y centrarla. */
  const porId = useRef(new Map<number, L.Path>())
  const encuadrada = useRef(false)
  // Los callbacks y las capas cambian en cada render; se guardan en refs para usarlos en los eventos del mapa.
  const seleccionar = useRef(onSeleccionar)
  seleccionar.current = onSeleccionar
  const verConcesiones = useRef(capas.concesiones)
  verConcesiones.current = capas.concesiones
  const midiendo = useRef(false)
  midiendo.current = !!medicion
  const eventos = useRef({ onFondoFalla, onMedicion, onVista, refCursor })
  eventos.current = { onFondoFalla, onMedicion, onVista, refCursor }
  const capaFondo = useRef<L.Layer | null>(null)
  /** Punto y texto de la etiqueta de cada concesión; se calculan una vez por dato. */
  const etiquetas = useRef<{ punto: LatLng; texto: string; ancho: number; alto: number; anchoTexto: number }[]>([])
  const capaEtiquetas = useRef<L.LayerGroup | null>(null)
  const verEtiquetas = useRef(capas.concesiones && capas.etiquetas)
  verEtiquetas.current = capas.concesiones && capas.etiquetas

  // 1. Crear / destruir el mapa. preferCanvas: dibuja en un solo <canvas> en vez de un
  //    elemento SVG por polígono (con miles de concesiones la diferencia es grande).
  useEffect(() => {
    if (!contenedor.current) return
    // El zoom va abajo a la derecha, sobre la barra de estado: arriba flotan los paneles.
    const m = L.map(contenedor.current, { preferCanvas: true, zoomControl: false }).setView(CENTRO_TUCUMAN, 9)
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(m)
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>')
    // Clic fuera de un polígono: quita la selección (salvo que se esté midiendo).
    m.on('click', () => {
      if (!midiendo.current) seleccionar.current(null)
    })
    // Posición del cursor en latitud/longitud y en POSGAR 07 (la que usa la oficina).
    m.on('mousemove', (e: L.LeafletMouseEvent) => {
      const destino = eventos.current.refCursor?.current
      if (!destino) return
      const { lat, lng } = e.latlng
      destino.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}  ·  POSGAR ${formatearPosgar(aPosgar(lat, lng))}`
    })
    const avisarVista = () => eventos.current.onVista?.({ zoom: m.getZoom(), escala: escalaDe(m) })
    m.on('zoomend moveend', avisarVista)
    m.on('moveend', () => dibujarEtiquetas())
    avisarVista()
    // Marcadores de las concesiones solo con el mapa alejado.
    m.on('zoomend', () => {
      const grupo = marcadores.current
      if (!grupo) return
      if (m.getZoom() < ZOOM_MARCADORES && verConcesiones.current) grupo.addTo(m)
      else grupo.remove()
    })
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capa.current = null
      marcadores.current = null
      capaComparacion.current = null
      capaPozos.current = null
      capaPuntos.current = null
      capaCauces.current = null
      capaFondo.current = null
      capaEtiquetas.current = null
      porId.current.clear()
      encuadrada.current = false
    }
  }, [])

  // 2. Concesiones: se redibujan cuando cambian los datos, el filtro, los colores o si se ven.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capa.current?.remove()
    marcadores.current?.remove()
    porId.current.clear()
    const grupo = L.layerGroup()

    const geo = L.geoJSON(concesiones, {
      style: (f) => {
        const color = f ? colorDe(f.properties) : '#64748b'
        return { color, weight: 2.5, opacity: 1, fillColor: color, fillOpacity: 0.3 }
      },
      onEachFeature: (f: ConcesionGeo, layer) => {
        const p = f.properties
        porId.current.set(p.concesion_id, layer as L.Path)
        const tooltip = `<strong>${tituloConcesion(p)}</strong><br>${p.titular ?? 'Sin titular cargado'}<br>${nombreEstado(p.estado)} · ${formatoHa(p.superficie_ha)}${p.usos ? `<br>${p.usos}` : ''}`
        const alHacerClic = (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return // el clic sigue al mapa: es un vértice de la medición
          L.DomEvent.stopPropagation(e)
          seleccionar.current(p.concesion_id)
        }
        layer.bindTooltip(tooltip, { sticky: true }).on('click', alHacerClic)

        // Marcador en el centro de la parcela, para cuando el mapa está alejado.
        L.circleMarker((layer as L.Polygon).getBounds().getCenter(), { radius: 5, color: '#fff', weight: 1.5, fillColor: colorDe(p), fillOpacity: 0.95 })
          .bindTooltip(tooltip)
          .on('click', alHacerClic)
          .addTo(grupo)
      },
    })
    capa.current = geo
    marcadores.current = grupo
    etiquetas.current = concesiones.flatMap((f) => {
      const texto = textoEtiqueta(f.properties)
      const lugar = texto ? puntoEtiqueta(f.geometry.coordinates) : null
      return texto && lugar ? [{ ...lugar, texto, anchoTexto: anchoDeTexto(texto) }] : []
    })
    dibujarEtiquetas()
    if (capas.concesiones) {
      geo.addTo(m)
      if (m.getZoom() < ZOOM_MARCADORES) grupo.addTo(m)
    }
    capaCauces.current?.bringToBack()
    pozosAlFrente()
    capaComparacion.current?.bringToFront()

    // La primera vez, encuadrar todas las concesiones (después se respeta lo que hizo el usuario).
    if (!encuadrada.current && concesiones.length) {
      encuadrada.current = true
      const frame = requestAnimationFrame(() => {
        if (mapa.current !== m) return
        m.invalidateSize()
        m.fitBounds(geo.getBounds(), { ...margenesLibres(m), maxZoom: 16, animate: false })
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [concesiones, colorDe, capas.concesiones])

  // 2b. Pozos: un punto por pozo, con el color de su estado. Borde rojo si cae fuera de su concesión.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaPozos.current?.remove()
    capaPozos.current = null
    if (!capas.pozos) return
    const grupo = L.layerGroup()
    for (const pozo of pozos) {
      const p = pozo.properties
      const [lng, lat] = pozo.geometry.coordinates
      const aRevisar = p.dentro_de_concesion === false
      const oficio = p.origen === 'OFICIO'
      const borde = aRevisar ? COLOR_POZO_A_REVISAR : oficio ? COLOR_POZO_OFICIO : '#fff'
      L.circleMarker([lat, lng], { radius: oficio ? 7 : 6, color: borde, weight: aRevisar || oficio ? 3 : 2, fillColor: colorPozo(p.estado), fillOpacity: 1 })
        .bindTooltip(tooltipPozo(p))
        .on('click', (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return
          L.DomEvent.stopPropagation(e)
          if (p.concesion_id !== null) seleccionar.current(p.concesion_id)
        })
        .addTo(grupo)
    }
    grupo.addTo(m)
    capaPozos.current = grupo
  }, [pozos, capas.pozos])

  // 2b'. Desagües y puntos de entrega: rombos con el color del tipo. Borde rojo si quedan lejos del polígono.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaPuntos.current?.remove()
    capaPuntos.current = null
    if (!capas.puntos) return
    const grupo = L.layerGroup()
    for (const punto of puntos) {
      const p = punto.properties
      const [lng, lat] = punto.geometry.coordinates
      const aRevisar = p.distancia_poligono_m !== null && p.distancia_poligono_m > DISTANCIA_MAX_PUNTO_M
      L.marker([lat, lng], { icon: iconoPunto(TIPOS_PUNTO[p.tipo].color, aRevisar), keyboard: false })
        .bindTooltip(tooltipPunto(p), { offset: [8, 0], direction: 'right' })
        .on('click', (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return
          L.DomEvent.stopPropagation(e)
          seleccionar.current(p.concesion_id)
        })
        .addTo(grupo)
    }
    grupo.addTo(m)
    capaPuntos.current = grupo
  }, [puntos, capas.puntos])

  // 2c. Ríos y canales: líneas azules (canales punteados), siempre debajo de las concesiones.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaCauces.current?.remove()
    capaCauces.current = null
    if (!capas.cauces || !cauces.length) return
    const geo = L.geoJSON(cauces, {
      style: (f) =>
        f?.properties.tipo === 'CANAL'
          ? { color: COLOR_CANAL, weight: 2.5, dashArray: '6 4', opacity: 0.9 }
          : { color: COLOR_RIO, weight: f?.properties.nombre ? 3 : 1.5, opacity: 0.8 },
      onEachFeature: (f: CauceGeo, layer) => {
        const p = f.properties
        layer.bindTooltip(`<strong>${p.nombre ?? (p.tipo === 'CANAL' ? 'Canal sin nombre' : 'Cauce sin nombre')}</strong><br>${p.tipo === 'CANAL' ? 'Canal' : 'Río / arroyo'} · ${formatoNumero(p.largo_km)} km`, {
          sticky: true,
        })
      },
    }).addTo(m)
    geo.bringToBack()
    capaCauces.current = geo
  }, [cauces, capas.cauces])

  // 2d. «Ir a»: encuadrar el distrito o departamento elegido.
  useEffect(() => {
    const m = mapa.current
    if (!m || !encuadre) return
    const [o, s, e, n] = encuadre.recuadro
    m.flyToBounds(
      [
        [s, o],
        [n, e],
      ],
      { ...margenesLibres(m), maxZoom: 15, duration: 0.8 },
    )
  }, [encuadre])

  /**
   * Números de las concesiones (rojo con borde blanco, se leen sobre el satélite y sobre el
   * mapa oscuro). Se redibujan al mover el mapa: solo las que están a la vista y con zoom suficiente.
   */
  function dibujarEtiquetas() {
    const m = mapa.current
    if (!m) return
    capaEtiquetas.current?.remove()
    capaEtiquetas.current = null
    if (!verEtiquetas.current || m.getZoom() < ZOOM_ETIQUETAS) return
    const vista = m.getBounds().pad(0.1)
    const grupo = L.layerGroup()
    // Grados de longitud → píxeles al zoom actual (en Web Mercator es lineal).
    const pxPorGrado = (256 * 2 ** m.getZoom()) / 360
    for (const { punto, texto, ancho, alto, anchoTexto } of etiquetas.current) {
      if (!vista.contains(punto)) continue
      // Solo si el número entra en la finca: si no, al alejarse taparía el polígono y a los vecinos.
      const altoPx = alto * pxPorGrado / Math.cos((punto[0] * Math.PI) / 180)
      if (ancho * pxPorGrado < anchoTexto + 8 || altoPx < ALTO_TEXTO_PX + 4) continue
      L.marker(punto, {
        icon: L.divIcon({ className: 'etiqueta-concesion', html: `<span>${texto.replace(/[<>&]/g, '')}</span>`, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(grupo)
    }
    capaEtiquetas.current = grupo.addTo(m)
  }

  // 2e. Prender / apagar los números.
  useEffect(() => {
    dibujarEtiquetas()
  }, [capas.etiquetas, capas.concesiones])

  /** Los pozos van siempre encima de los polígonos (si no, el clic y el tooltip serían del polígono). */
  function pozosAlFrente() {
    capaPozos.current?.eachLayer((l) => (l as L.CircleMarker).bringToFront())
  }

  // 3. Resaltar y centrar la seleccionada.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    porId.current.forEach((layer, id) => {
      const elegida = id === seleccionada
      layer.setStyle({ weight: elegida ? 4.5 : 2.5, fillOpacity: elegida ? 0.5 : 0.3 })
      if (elegida) layer.bringToFront()
    })
    pozosAlFrente()
    const layer = seleccionada !== null ? porId.current.get(seleccionada) : undefined
    if (layer && 'getBounds' in layer) {
      const limites = (layer as L.Polygon).getBounds()
      // Acercar hasta la parcela si está fuera de la vista o el mapa está muy alejado para verla.
      // Si ya se ve bien, no se mueve (evita saltos al hacer clic sobre un polígono).
      if (!m.getBounds().contains(limites) || m.getZoom() < ZOOM_MARCADORES + 2) {
        m.flyToBounds(limites, { ...margenesLibres(m), maxZoom: 16, duration: 0.8 })
      }
    }
  }, [seleccionada, concesiones])

  // 4. Polígono de comparación (rojo punteado, por encima de todo).
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaComparacion.current?.remove()
    capaComparacion.current = null
    if (!comparacion) return
    const geo = L.geoJSON(comparacion, {
      style: { color: COLOR_COMPARACION, weight: 3, dashArray: '6 6', fillColor: COLOR_COMPARACION, fillOpacity: 0.12 },
      interactive: false,
    }).addTo(m)
    capaComparacion.current = geo
    m.flyToBounds(geo.getBounds(), { ...margenesLibres(m), maxZoom: 17, duration: 0.6 })
  }, [comparacion])

  // 5. Mapa base. Si no responde, el padre recibe el reemplazo y vuelve a pasar por acá.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaFondo.current = ponerFondoVisor(m, fondo, capaFondo.current, (texto, reemplazo) => eventos.current.onFondoFalla(texto, reemplazo))
  }, [fondo])

  // 6. Medición de distancia o área.
  useEffect(() => {
    const m = mapa.current
    if (!m || !medicion) return
    const activa = iniciarMedicion(m, medicion.tipo, (r) => eventos.current.onMedicion?.(r))
    return () => activa.quitar()
  }, [medicion])

  // 7. «Ir a coordenada»: pin con las coordenadas y el mapa centrado ahí.
  useEffect(() => {
    const m = mapa.current
    if (!m || !marca) return
    const pin = L.marker([marca.lat, marca.lng], { icon: ICONO_MARCA, keyboard: false }).bindPopup(marca.texto, { closeButton: true }).addTo(m)
    m.flyTo([marca.lat, marca.lng], Math.max(m.getZoom(), 16), { duration: 0.8 })
    m.once('moveend', () => pin.openPopup())
    return () => {
      pin.remove()
    }
  }, [marca])

  return <div ref={contenedor} className="h-full w-full" />
}
