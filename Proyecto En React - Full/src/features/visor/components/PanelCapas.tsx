import { useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { CRITERIOS, type CriterioColor, type ItemLeyenda as ItemDeLeyenda } from '../colores'
import { COLOR_POZO_A_REVISAR, COLOR_POZO_OFICIO, ESTADOS_POZO, formatoHa, TIPOS_PUNTO, ZOOM_ETIQUETAS } from '../estilos'
import { SERVICIOS_WMS, urlLeyenda, type EstadoWms, type ServicioWms } from '../capasWms'
import { CAPAS_NINGUNA, CAPAS_TODAS, type CapasVisor, type FiltrosVisor } from '../filtros'
import { useTemasWms } from '../hooks'
import { Casilla, claseSelect, Interruptor, ItemLeyenda, Subtitulo } from './ui'

/** Un lugar al que se puede llevar el mapa (distrito de riego o departamento). */
export interface Destino {
  clave: string
  nombre: string
  grupo: 'Distritos de riego' | 'Departamentos'
  cantidad: number
}

interface Props {
  filtros: FiltrosVisor
  onFiltrar: (filtros: FiltrosVisor) => void
  leyenda: ItemDeLeyenda[]
  capas: CapasVisor
  onCapas: (capas: CapasVisor) => void
  cantidades: { concesiones: number; superficieHa: number; pozos: number; puntos: number; cauces: number }
  destinos: Destino[]
  onIrA: (clave: string) => void
  /** Capas WMS de otros organismos. */
  wms: EstadoWms
  onWms: (wms: EstadoWms) => void
}

/** «1 polígono», «12 polígonos». */
const contar = (n: number, singular: string, plural: string) => `${n.toLocaleString('es-AR')} ${n === 1 ? singular : plural}`

/**
 * Tarjeta de un grupo del catálogo de capas: encabezado con ícono, nombre, resumen e
 * interruptor; al desplegarla muestra la leyenda y las opciones de la capa.
 */
function GrupoCapa({
  icono,
  color,
  titulo,
  resumen,
  activo,
  onCambiar,
  children,
  abiertoAlInicio = false,
}: {
  icono: string
  color: string
  titulo: string
  resumen: string
  activo: boolean
  onCambiar: () => void
  children: ReactNode
  abiertoAlInicio?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio)
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className={cn('flex items-center gap-3 px-3 py-2.5', abierto && 'border-b border-slate-100 dark:border-slate-700')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: color }}>
          <Icon name={icono} className="text-[20px]!" />
        </span>
        <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="min-w-0 flex-1 text-left">
          <p className={cn('truncate text-sm font-semibold', activo ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>{titulo}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{resumen}</p>
        </button>
        <Interruptor activo={activo} onCambiar={onCambiar} etiqueta={titulo} />
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-label={abierto ? `Plegar ${titulo}` : `Desplegar ${titulo}`}
          className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Icon name="expand_more" className={cn('text-[20px]! transition-transform', abierto && 'rotate-180')} />
        </button>
      </div>
      {abierto && <div className={cn('px-2 py-2', !activo && 'opacity-50')}>{children}</div>}
    </section>
  )
}

/**
 * Un servicio WMS de otro organismo: una casilla por tema y, si el tema tiene varias campañas
 * (un cultivo por año), la campaña a ver. La leyenda la dibuja el servidor de origen.
 */
function GrupoWms({ servicio, estado, onCambiar }: { servicio: ServicioWms; estado: EstadoWms[string]; onCambiar: (estado: EstadoWms[string]) => void }) {
  const { data: temas = [], isLoading, isError } = useTemasWms(servicio)
  const elegidas = Object.keys(estado.elegidas).length

  function prender() {
    if (estado.activo || elegidas) return onCambiar({ ...estado, activo: !estado.activo })
    // Primera vez: el tema por defecto (o todos), en su campaña más nueva.
    const iniciales = temas.filter((t) => !servicio.porDefecto || servicio.porDefecto.includes(t.clave))
    onCambiar({ activo: true, elegidas: Object.fromEntries(iniciales.map((t) => [t.clave, t.campanias[0].capa])) })
  }
  function alternarTema(clave: string, capa: string) {
    const nuevas = { ...estado.elegidas }
    if (nuevas[clave]) delete nuevas[clave]
    else nuevas[clave] = capa
    onCambiar({ activo: Object.keys(nuevas).length > 0, elegidas: nuevas })
  }

  let resumen = servicio.resumen
  if (isError) resumen = 'El servidor no responde'
  else if (estado.activo && elegidas) resumen = `${elegidas} ${elegidas === 1 ? 'capa' : 'capas'} a la vista · ${servicio.resumen.split(' · ')[1]}`

  return (
    <GrupoCapa icono={servicio.icono} color={servicio.color} titulo={servicio.titulo} resumen={resumen} activo={estado.activo} onCambiar={prender}>
      {isLoading && <p className="px-1.5 py-1 text-xs text-slate-400">Leyendo las capas del servidor…</p>}
      {isError && <p className="px-1.5 py-1 text-xs text-red-600">No se pudo leer la lista de capas de {servicio.servidor}. Puede estar caído o bloqueado por la red.</p>}
      {temas.map((t) => {
        const capa = estado.elegidas[t.clave]
        return (
          <div key={t.clave}>
            <Casilla
              marcada={!!capa}
              onCambiar={() => alternarTema(t.clave, t.campanias[0].capa)}
              muestra={<span className="size-3.5 shrink-0 rounded-sm" style={{ backgroundColor: servicio.color }} />}
              texto={t.nombre}
              cantidad={t.campanias.length > 1 ? t.campanias.length : undefined}
              tachar={false}
            />
            {capa && (
              <div className="mb-1 ml-7 flex flex-col gap-1 pr-1.5">
                {t.minZoom && <p className="text-xs text-slate-400">Se ve al acercar el mapa (zoom {t.minZoom} o más).</p>}
                {t.campanias.length > 1 && (
                  <select
                    value={capa}
                    onChange={(e) => onCambiar({ activo: true, elegidas: { ...estado.elegidas, [t.clave]: e.target.value } })}
                    aria-label={`Campaña de ${t.nombre}`}
                    className={cn(claseSelect, 'py-1 text-xs')}
                  >
                    {t.campanias.map((c) => (
                      <option key={c.capa} value={c.capa}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
                <details className="text-xs text-slate-500 dark:text-slate-400">
                  <summary className="cursor-pointer select-none hover:text-primary">Leyenda</summary>
                  <img src={urlLeyenda(servicio, capa)} alt={`Leyenda de ${t.nombre}`} loading="lazy" className="mt-1 max-w-full rounded bg-white p-1" />
                </details>
              </div>
            )}
          </div>
        )
      })}
      {temas.length > 0 && (
        <p className="px-1.5 pt-1 text-xs text-slate-400">
          Fuente: {servicio.fuente}. Se dibuja encima del mapa base y debajo de las capas de la DRH.
          {servicio.consultable && ' Clic en el mapa (fuera de una concesión) para ver los datos: padrón y nomenclatura de la parcela, nombre del canal…'}
        </p>
      )}
    </GrupoCapa>
  )
}

/**
 * Catálogo de capas del visor, agrupado por tema (como los visores del IGN):
 *   - Derechos de agua: concesiones, coloreadas por el criterio elegido; la leyenda filtra.
 *   - Aguas subterráneas: pozos, por estado.
 *   - Desagües y puntos de entrega de las concesiones (sección de usos).
 *   - Hidrografía: ríos y canales.
 *   - Otros organismos: servicios WMS (Catastro, actividades agropecuarias e industriales).
 * Arriba, «Ir a» un distrito de riego o un departamento.
 */
export function PanelCapas({ filtros, onFiltrar, leyenda, capas, onCapas, cantidades, destinos, onIrA, wms, onWms }: Props) {
  const alternarValor = (valor: string) => {
    const ocultos = new Set(filtros.ocultos)
    if (ocultos.has(valor)) ocultos.delete(valor)
    else ocultos.add(valor)
    onFiltrar({ ...filtros, ocultos })
  }
  const cambiarCriterio = (criterio: CriterioColor) => onFiltrar({ ...filtros, criterio, ocultos: new Set() })

  return (
    <div className="flex flex-col gap-4 p-3">
      <div>
        <Subtitulo>Ir a</Subtitulo>
        <select value="" onChange={(e) => e.target.value && onIrA(e.target.value)} aria-label="Ir a un distrito o departamento" className={claseSelect}>
          <option value="">Elegir distrito o departamento…</option>
          <option value="*">Toda la provincia</option>
          {(['Distritos de riego', 'Departamentos'] as const).map((grupo) => (
            <optgroup key={grupo} label={grupo}>
              {destinos
                .filter((d) => d.grupo === grupo)
                .map((d) => (
                  <option key={d.clave} value={d.clave}>
                    {d.nombre} ({d.cantidad})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Subtitulo
          acciones={
            <>
              <button
                type="button"
                onClick={() => {
                  onCapas(CAPAS_TODAS)
                  onFiltrar({ ...filtros, ocultos: new Set() })
                }}
                className="hover:underline"
              >
                Ver todo
              </button>
              <button
                type="button"
                onClick={() => {
                  onCapas(CAPAS_NINGUNA)
                  onWms(Object.fromEntries(Object.entries(wms).map(([id, e]) => [id, { ...e, activo: false }])))
                }}
                className="hover:underline"
              >
                Ocultar todo
              </button>
            </>
          }
        >
          Capas
        </Subtitulo>

        <GrupoCapa
          icono="water_drop"
          color="#137fec"
          titulo="Concesiones de agua"
          resumen={`${contar(cantidades.concesiones, 'polígono', 'polígonos')} · ${formatoHa(cantidades.superficieHa)}`}
          activo={capas.concesiones}
          onCambiar={() => onCapas({ ...capas, concesiones: !capas.concesiones })}
          abiertoAlInicio
        >
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/50">
            <span className="text-[13px] font-extrabold text-red-600 [text-shadow:0_0_2px_#fff]">123</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm text-slate-700 dark:text-slate-200">Números de concesión</p>
              <p className="text-[11px] text-slate-400">Aparecen al acercar, cuando el número entra en la finca (zoom {ZOOM_ETIQUETAS} o más)</p>
            </div>
            <Interruptor activo={capas.etiquetas} onCambiar={() => onCapas({ ...capas, etiquetas: !capas.etiquetas })} etiqueta="Números de concesión" />
          </div>
          <label className="mb-2 flex flex-col gap-1 px-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Colorear por</span>
            <select value={filtros.criterio} onChange={(e) => cambiarCriterio(e.target.value as CriterioColor)} className={claseSelect}>
              {CRITERIOS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          {leyenda.map((item) => (
            <Casilla
              key={item.valor}
              marcada={!filtros.ocultos.has(item.valor)}
              onCambiar={() => alternarValor(item.valor)}
              muestra={<span className="size-3.5 shrink-0 rounded-sm border-2" style={{ borderColor: item.color, backgroundColor: `${item.color}55` }} />}
              texto={item.nombre}
              cantidad={item.cantidad}
            />
          ))}
          {leyenda.length > 1 && (
            <div className="mt-1 flex gap-3 px-1.5 text-xs font-semibold text-primary">
              <button type="button" onClick={() => onFiltrar({ ...filtros, ocultos: new Set() })} className="hover:underline">
                Todos
              </button>
              <button type="button" onClick={() => onFiltrar({ ...filtros, ocultos: new Set(leyenda.map((i) => i.valor)) })} className="hover:underline">
                Ninguno
              </button>
            </div>
          )}
        </GrupoCapa>

        <GrupoCapa
          icono="water_pump"
          color="#0284c7"
          titulo="Pozos"
          resumen={`${contar(cantidades.pozos, 'pozo', 'pozos')} · aguas subterráneas`}
          activo={capas.pozos}
          onCambiar={() => onCapas({ ...capas, pozos: !capas.pozos })}
        >
          {Object.entries(ESTADOS_POZO).map(([clave, e]) => (
            <ItemLeyenda key={clave} muestra={<span className="size-3 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-slate-300" style={{ backgroundColor: e.color }} />} texto={e.nombre} />
          ))}
          <ItemLeyenda
            muestra={<span className="size-3 shrink-0 rounded-full border-[3px] bg-sky-600" style={{ borderColor: COLOR_POZO_A_REVISAR }} />}
            texto="Fuera del polígono de su concesión"
          />
          <ItemLeyenda muestra={<span className="size-3 shrink-0 rounded-full border-[3px] bg-sky-600" style={{ borderColor: COLOR_POZO_OFICIO }} />} texto="Registrado de oficio" />
        </GrupoCapa>

        <GrupoCapa
          icono="water_drop"
          color={TIPOS_PUNTO.DESAGUE.color}
          titulo="Desagües y puntos de entrega"
          resumen={`${contar(cantidades.puntos, 'punto', 'puntos')} · sección de usos`}
          activo={capas.puntos}
          onCambiar={() => onCapas({ ...capas, puntos: !capas.puntos })}
        >
          {Object.entries(TIPOS_PUNTO).map(([clave, t]) => (
            <ItemLeyenda key={clave} muestra={<span className="size-2.5 shrink-0 rotate-45 border-2 border-white shadow ring-1 ring-slate-300" style={{ backgroundColor: t.color }} />} texto={t.nombre} />
          ))}
          <ItemLeyenda
            muestra={<span className="size-2.5 shrink-0 rotate-45 border-[3px]" style={{ borderColor: COLOR_POZO_A_REVISAR, backgroundColor: TIPOS_PUNTO.DESAGUE.color }} />}
            texto="A más de 1 km del polígono de su concesión"
          />
        </GrupoCapa>

        <GrupoCapa
          icono="waves"
          color="#2563eb"
          titulo="Ríos y canales"
          resumen={`${contar(cantidades.cauces, 'cauce', 'cauces')} · hidrografía`}
          activo={capas.cauces}
          onCambiar={() => onCapas({ ...capas, cauces: !capas.cauces })}
        >
          <ItemLeyenda muestra={<span className="h-[3px] w-5 shrink-0 rounded bg-blue-600" />} texto="Río o arroyo" />
          <ItemLeyenda muestra={<span className="w-5 shrink-0 border-t-[3px] border-dashed border-cyan-600" />} texto="Canal" />
          <p className="px-1.5 pt-1 text-xs text-slate-400">Fuente: OpenStreetMap. Falta la red de canales de riego de la DRH.</p>
        </GrupoCapa>
      </div>

      <div className="flex flex-col gap-2">
        <Subtitulo>Otros organismos</Subtitulo>
        {SERVICIOS_WMS.map((s) => (
          <GrupoWms key={s.id} servicio={s} estado={wms[s.id] ?? { activo: false, elegidas: {} }}onCambiar={(e) => onWms({ ...wms, [s.id]: e })} />
        ))}
      </div>
    </div>
  )
}
