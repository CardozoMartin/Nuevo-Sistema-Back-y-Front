// Registro de pozo de oficio emulado (PROTOTIPO: el backend real todavía no lo tiene).
//
// Pozos carga la ficha completa de un pozo que no tiene autorización de perforación previa
// (pozo preexistente, relevamiento de campo, regularización…). El sistema numera el registro,
// le da el ID interno y guarda el primer monitoreo hidráulico y químico con su fecha.
// Al registrarlo se abre el expediente y pasa a Catastro (ver registroPozo.ts: el circuito).
import type { AltaPozoOficioDto, AltaPozoOficioRespuesta } from '@/features/pozo/AltaDePozo/types'
import type { OrigenPozo, PadronPozos, PozoEnPadron } from '@/features/pozo/Padron/types'
import { ahora, nuevoId } from './db'
import { leerPunto } from './alta'
import { datosConcesion, fichaPozo } from './baja'
import { actuar, crearExpediente, NOMBRE_ETAPA, NOMBRE_OFICINA, nombreUsuario, pasar } from './expedientes'
import { error400, error403, error404, error409, exigirTexto, type Peticion, type Ruta } from './http'

/** Dos pozos a menos de esto son la misma perforación (coordenada única, paso 5 del CU). */
const DISTANCIA_MISMO_POZO_M = 5

function registrarDeOficio({ db, usuario, cuerpo }: Peticion): AltaPozoOficioRespuesta {
  //1.- Lo registra la oficina de Pozos.
  if (!usuario.esAdministrador && usuario.oficina !== 'pozos') throw error403('El registro de pozos lo hace la oficina de Pozos (Perforaciones).')
  const d = (cuerpo ?? {}) as AltaPozoOficioDto
  exigirTexto(d.motivo, 'Elija el motivo del registro de oficio.')
  exigirTexto(d.causante, 'Ingrese el causante.')
  exigirTexto(d.ubicacion?.departamento, 'Seleccione el departamento.')

  //2.- Coordenada: las dos formas (criterio único) y que no haya otro pozo en el mismo lugar.
  const punto = leerPunto(d.coordenada as unknown as Record<string, unknown>, 'del pozo')
  const repetido = db.pozos.find((p) => p.estado !== 'ANULADO' && Math.hypot(p.x - punto.x, p.y - punto.y) < DISTANCIA_MISMO_POZO_M)
  if (repetido) throw error409(`Ya hay un pozo registrado en esa coordenada: ${repetido.idInterno}${repetido.alias ? ` (${repetido.alias})` : ''}. Verifique que no sea el mismo.`)

  //3.- Monitoreos con fecha.
  if (d.hidraulico && !d.hidraulico.fecha) throw error400('Ingrese la fecha del monitoreo hidráulico.')
  if (d.quimico && !d.quimico.fecha) throw error400('Ingrese la fecha del monitoreo químico.')

  //4.- Número del registro e ID interno, correlativos por año.
  const anio = new Date().getFullYear()
  const n = db.pozos.filter((p) => p.registro?.expediente.endsWith(`/${anio}`)).length + 1
  const expediente = `OF-${String(n).padStart(4, '0')}/${anio}`
  const fecha = ahora()
  const { coordenada: _c, hidraulico, quimico, ...ficha } = d
  //5.- El expediente del registro: lo abre Pozos y pasa a Catastro, que registra la concesión.
  const e = crearExpediente(db, { numero: String(n), reparticion: 'OF', anio, tipoTramite: 'REGISTRO_POZO', etapa: 'CARGA_POZO', etiqueta: expediente }, usuario)
  e.fechaIngreso = d.fechaIngreso
  const pozo = {
    id: nuevoId(db),
    idInterno: `POF-${anio}-${String(n).padStart(3, '0')}`,
    alias: d.nombrePozo ?? d.alias,
    estado: d.estado,
    origen: 'OFICIO' as const,
    tipoPozo: null,
    jurisdiccionDrh: d.jurisdiccionDrh,
    profundidadM: d.construccion.profundidad,
    nivelEstaticoM: hidraulico?.nivelEstatico ?? null,
    nivelDinamicoM: hidraulico?.nivelDinamico ?? null,
    caudalM3h: hidraulico?.caudalM3h ?? null,
    latitud: punto.latitud,
    longitud: punto.longitud,
    x: punto.x,
    y: punto.y,
    concesionId: null,
    registro: { ...ficha, expediente, expedienteId: e.id, catastro: null, resolucion: null, sistemaCoordenada: punto.sistema, registradoPor: nombreUsuario(usuario), registradoEn: fecha },
  }
  db.pozos.push(pozo)
  if (hidraulico) db.monitoreos.push({ id: nuevoId(db), pozoId: pozo.id, tipo: 'hidraulico', fecha: hidraulico.fecha, registrado: fecha, usuario: nombreUsuario(usuario), datos: { ...hidraulico, regimenM3h: d.equipo.regimenM3h } })
  if (quimico) db.monitoreos.push({ id: nuevoId(db), pozoId: pozo.id, tipo: 'quimico', fecha: quimico.fecha, registrado: fecha, usuario: nombreUsuario(usuario), datos: { parametros: quimico.parametros } })
  actuar(db, e, usuario, 'REGISTRO_POZO', 'REGISTRADO', `${d.motivo}: ${d.causante}.`)
  pasar(db, e, 'CATASTRO_POZO', usuario)
  return { expediente, expedienteId: e.id, pozo: fichaPozo(db, pozo) }
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Padrón de pozos por origen (de oficio, con autorización, migrados del padrón anterior), con
 * búsqueda por ID, registro, causante, documento, alias, concesión o ubicación.
 */
function padron({ db, query }: Peticion): PadronPozos {
  const vivos = db.pozos.filter((p) => p.estado !== 'ANULADO')
  const filas: PozoEnPadron[] = vivos.map((p) => {
    const conc = datosConcesion(db, p.concesionId)
    const r = p.registro
    const monitoreos = db.monitoreos.filter((m) => m.pozoId === p.id)
    return {
      id: p.id,
      idInterno: p.idInterno,
      alias: p.alias,
      estado: p.estado,
      origen: p.origen,
      jurisdiccionDrh: p.jurisdiccionDrh,
      profundidadM: p.profundidadM,
      caudalLps: p.caudalM3h === null ? null : +(p.caudalM3h / 3.6).toFixed(3),
      coordX: p.x,
      coordY: p.y,
      latitud: p.latitud,
      longitud: p.longitud,
      departamento: r?.ubicacion.departamento ?? conc?.departamento ?? null,
      localidad: r?.ubicacion.localidad ?? conc?.localidad ?? null,
      distrito: r?.ubicacion.distrito ?? conc?.distrito ?? null,
      concesion: conc ? { id: conc.c.id, numero: conc.c.numero, titular: conc.titular } : null,
      registro: r
        ? {
            expediente: r.expediente,
            expedienteId: r.expedienteId,
            circuito: ((e) => ({ estado: e?.estado ?? '', etapaNombre: e ? NOMBRE_ETAPA[e.etapa] : '', oficinaNombre: e ? NOMBRE_OFICINA[e.oficina] : '' }))(db.expedientes.find((x) => x.id === r.expedienteId)),
            motivo: r.motivo,
            causante: r.causante,
            documento: r.documento,
            fechaIngreso: r.fechaIngreso,
            asunto: r.asunto,
            registradoPor: r.registradoPor,
            registradoEn: r.registradoEn,
            sistemaCoordenada: r.sistemaCoordenada,
            monitoreos: { hidraulicos: monitoreos.filter((m) => m.tipo === 'hidraulico').length, quimicos: monitoreos.filter((m) => m.tipo === 'quimico').length },
          }
        : null,
    }
  })
  const totales = { OFICIO: 0, AUTORIZACION: 0, MIGRACION: 0, TODOS: filas.length }
  filas.forEach((f) => totales[f.origen]++)

  //1.- Origen y búsqueda (todas las palabras, sin importar acentos ni mayúsculas).
  const origen = query.origen as OrigenPozo | undefined
  const palabras = sinAcentos(query.q?.trim() ?? '').split(/\s+/).filter(Boolean)
  const pozos = filas
    .filter((f) => !origen || f.origen === origen)
    .filter((f) => {
      if (!palabras.length) return true
      const texto = sinAcentos([f.idInterno, f.alias, f.registro?.expediente, f.registro?.causante, f.registro?.documento, f.registro?.motivo, f.concesion?.numero, f.concesion?.titular, f.departamento, f.localidad, f.distrito].filter(Boolean).join(' '))
      return palabras.every((w) => texto.includes(w))
    })
    //2.- Los de oficio más nuevos primero; después el resto por ID.
    .sort((a, b) => (b.registro?.registradoEn ?? '').localeCompare(a.registro?.registradoEn ?? '') || a.idInterno.localeCompare(b.idInterno))
  return { pozos, totales }
}

// ---------------------------------------------------------------------------
// Monitoreos: cada medición con SU fecha; no se pisan entre sí
// ---------------------------------------------------------------------------

function exigirPozo(db: Peticion['db'], id: string) {
  const p = db.pozos.find((x) => x.id === id)
  if (!p) throw error404('No se encontró el pozo.')
  return p
}

/** Los monitoreos del pozo, del más reciente al más viejo (a igual fecha, el último registrado). */
function monitoreos({ db, ruta }: Peticion) {
  const pozo = exigirPozo(db, ruta.id)
  return {
    pozo: fichaPozo(db, pozo),
    monitoreos: db.monitoreos
      .filter((m) => m.pozoId === pozo.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado))
      .map(({ pozoId: _p, ...m }) => m),
  }
}

/**
 * Registrar un monitoreo: la fecha es la de la medición (puede ser vieja: una medición de 2019 se
 * puede cargar hoy). Si es el hidráulico más reciente, pasa a ser el dato vigente del pozo.
 */
function registrarMonitoreo({ db, usuario, ruta, cuerpo }: Peticion) {
  if (!usuario.esAdministrador && usuario.oficina !== 'pozos') throw error403('Los monitoreos los registra la oficina de Pozos.')
  const pozo = exigirPozo(db, ruta.id)
  if (pozo.estado === 'ANULADO') throw error409('El pozo está anulado.')
  const d = (cuerpo ?? {}) as { tipo?: string; fecha?: string; datos?: Record<string, unknown> }
  if (d.tipo !== 'hidraulico' && d.tipo !== 'quimico') throw error400('El tipo de monitoreo debe ser hidráulico o químico.')
  const fecha = exigirTexto(d.fecha, 'Ingrese la fecha del monitoreo (la de la medición, no la de carga).')
  if (fecha > ahora().slice(0, 10)) throw error400('La fecha del monitoreo no puede ser futura.')
  const datos = d.datos ?? {}
  const vacio = d.tipo === 'quimico' ? !(datos.parametros as unknown[] | undefined)?.length : !['nivelEstatico', 'nivelDinamico', 'caudalM3h'].some((k) => datos[k] !== null && datos[k] !== undefined)
  if (vacio) throw error400(d.tipo === 'quimico' ? 'Agregue al menos un parámetro al informe químico.' : 'Cargue al menos un dato hidráulico (niveles o caudal).')
  const m = { id: nuevoId(db), pozoId: pozo.id, tipo: d.tipo as 'hidraulico' | 'quimico', fecha, registrado: ahora(), usuario: nombreUsuario(usuario), datos }
  db.monitoreos.push(m)
  //1.- El hidráulico de fecha más reciente es el vigente: actualiza niveles y caudal del pozo.
  if (d.tipo === 'hidraulico') {
    const ultimo = db.monitoreos.filter((x) => x.pozoId === pozo.id && x.tipo === 'hidraulico').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado))[0]
    if (ultimo.id === m.id) {
      pozo.nivelEstaticoM = (datos.nivelEstatico as number | null) ?? pozo.nivelEstaticoM
      pozo.nivelDinamicoM = (datos.nivelDinamico as number | null) ?? pozo.nivelDinamicoM
      pozo.caudalM3h = (datos.caudalM3h as number | null) ?? pozo.caudalM3h
      if (pozo.registro && datos.regimenM3h !== undefined) pozo.registro.equipo.regimenM3h = datos.regimenM3h as number | null
    }
  }
  return monitoreos({ db, usuario, ruta, cuerpo: null, query: {} })
}

export const rutasPozos: Ruta[] = [
  ['GET', '/pozos/:id/monitoreos', monitoreos],
  ['POST', '/pozos/:id/monitoreos', registrarMonitoreo],
  ['POST', '/pozos/oficio', registrarDeOficio],
  ['GET', '/pozos/padron', padron],
]
