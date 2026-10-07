// Formato de una fila del padrón de concesiones para importar.
//
// Las columnas son LAS MISMAS de la planilla real (BASE_DE_DATOS_LA_AGUADITA.xlsx, hoja
// «Procesado»), con nombres en camelCase. Así el mismo importador sirve para:
//   - los datos de prueba (scripts/generar-padron-demo.mjs), que además traen el polígono;
//   - el padrón real, convirtiendo la planilla a JSON sin transformar nada.
import type { MultiPolygon, Polygon } from 'geojson';
import { esCuitValido, soloDigitos } from '../comun/validadores/cuit.js';
import { Caracter, CODIGOS_SERVICIO, TipoDerecho, TipoPersona } from '../concesiones/concesiones.constantes.js';

export interface FilaPadron {
  /** «Año»: año de otorgamiento. */
  anio?: number | null;
  /** «Monto»: se conserva en el registro de origen (no tiene columna propia todavía). */
  monto?: number | null;
  /** «Otorg.»: número de concesión. Es único en el padrón: es la clave de la importación. */
  otorgamiento: number | string;
  subconcesion?: string | number | null;
  /** «Tipo Otorg.»: CONCESIÓN o DERECHO TRADICIONAL. */
  tipoOtorgamiento?: string | null;
  /** «Titulares»: uno o varios separados por «|», como texto libre («ABELLA  JOSE»). */
  titulares?: string | null;
  /** «Propietarios actuales»: quien figura hoy, si difiere del titular registrado. */
  propietariosActuales?: string | null;
  /** «Documento»: DNI (solo se asigna si hay un único titular). */
  documento?: string | number | null;
  /** «CUIT/ CUIL». */
  cuit?: string | number | null;
  caracter?: string | null;
  /** «Cod. Serv.»: 0 a 5. */
  codigoServicio?: number | null;
  servicio?: string | null;
  uso?: string | null;
  /** «Cantidad»: magnitud del uso (ha para riego, cabezas para pecuario…). */
  cantidad?: number | null;
  localidad?: string | null;
  departamento?: string | null;
  distrito?: string | null;
  cuenca?: string | null;
  fuente?: string | null;
  sistema?: string | null;
  canalPrincipal?: string | null;
  canalSecundario?: string | null;
  canalTerciario?: string | null;
  canalCuarto?: string | null;
  canalQuinto?: string | null;
  desague?: string | null;
  /** No está en la planilla: polígono en GeoJSON WGS84 (datos de prueba o relevamientos). */
  geometria?: Polygon | MultiPolygon | null;
  /** No está en la planilla: pozos que abastecen a la concesión (datos de prueba o relevamientos). */
  pozos?: FilaPozo[] | null;
}

/** Un pozo de la fila. Coordenadas en grados WGS84 (las de un GPS o Google Earth). */
export interface FilaPozo {
  alias?: string | null;
  latitud: number;
  longitud: number;
  tipo?: string | null;
  /** EN_USO, FUERA_DE_SERVICIO, PARADO o BAJA (por defecto EN_USO). */
  estado?: string | null;
  profundidad?: number | null;
  nivelEstatico?: number | null;
  nivelDinamico?: number | null;
  caudalM3h?: number | null;
}

// ---------------------------------------------------------------------------
// Normalización: cada función toma el valor crudo de la planilla y devuelve el del sistema.
// ---------------------------------------------------------------------------

/** Texto limpio: sin tabs ni espacios dobles; vacío → null. */
export function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).replace(/\s+/g, ' ').trim();
  return limpio === '' ? null : limpio;
}

/** Los marcadores de «sin dato» de la planilla («(SIN LOCALIDAD)», «(SIN CUENCA)») valen null. */
export function textoConDato(valor: unknown): string | null {
  const t = texto(valor);
  return t && /^\(SIN .*\)$/i.test(t) ? null : t;
}

/** «DISTRITO III» → «III» (el sistema guarda el número romano, igual que el frontend). */
export function distrito(valor: unknown): string | null {
  const t = textoConDato(valor);
  return t ? t.replace(/^DISTRITO\s+/i, '') : null;
}

export function tipoDerecho(valor: unknown): TipoDerecho {
  return /TRADICIONAL/i.test(texto(valor) ?? '') ? TipoDerecho.DERECHO_TRADICIONAL : TipoDerecho.CONCESION;
}

export function caracter(valor: unknown): Caracter | null {
  const t = texto(valor)?.toUpperCase();
  return t === 'PERMANENTE' ? Caracter.PERMANENTE : t === 'EVENTUAL' ? Caracter.EVENTUAL : null;
}

export function codigoServicio(valor: unknown): number | null {
  const n = Number(valor);
  return valor !== null && valor !== undefined && (CODIGOS_SERVICIO as readonly number[]).includes(n) ? n : null;
}

/** Uso de la planilla → código de cat_tipo_uso. FMOTRIZ (fuerza motriz) es el uso energético. */
const USOS: Record<string, string> = {
  RIEGO: 'agricola-riego',
  PULVERIZACION: 'agricola-pulverizacion',
  PECUARIO: 'pecuario',
  INDUSTRIAL: 'industrial',
  FMOTRIZ: 'energetico',
  ENERGETICO: 'energetico',
  RECREATIVO: 'recreativo',
  MINERO: 'minero',
  MEDICINAL: 'medicinal',
  PISCICOLA: 'piscicola',
};
export function codigoUso(valor: unknown): string | null {
  const t = texto(valor)
    ?.toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return t ? (USOS[t] ?? null) : null;
}

/** Señales de que un titular es una persona jurídica (sociedades, cooperativas, ingenios…). */
const JURIDICA = /\b(S\.?\s?A\.?|S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?\s?S\.?|S\.?\s?C\.?|S\.?\s?H\.?|SOCIEDAD|COOPERATIVA|COOP\.?|INGENIO|CIA\.?|COMPA[ÑN]IA|ASOCIACION|FUNDACION|CONSORCIO|MUNICIPALIDAD|COMUNA|ESTABLECIMIENTO|AGROPECUARIA|INDUSTRIAS?)\b/i;

export interface TitularNormalizado {
  denominacion: string;
  tipoPersona: TipoPersona;
  documento: string | null;
  tipoDocumento: 'DNI' | 'CUIL' | 'CUIT' | null;
}

/**
 * Titulares de la fila:
 *   1. Se separan por «|» y se limpian.
 *   2. Se infiere el tipo de persona por el nombre (S.A., S.R.L., cooperativa…).
 *   3. El documento solo se asigna si hay UN titular (con varios no se sabe de quién es).
 *      CUIT/CUIL con dígito verificador inválido o DNI con largo raro se descartan con aviso.
 */
export function titulares(fila: FilaPadron, avisos: string[]): TitularNormalizado[] {
  const nombres = (texto(fila.titulares) ?? '')
    .split('|')
    .map((n) => texto(n))
    .filter((n): n is string => !!n);

  const lista: TitularNormalizado[] = nombres.map((denominacion) => ({
    denominacion,
    tipoPersona: JURIDICA.test(denominacion) ? TipoPersona.JURIDICA : TipoPersona.FISICA,
    documento: null,
    tipoDocumento: null,
  }));

  if (lista.length === 1) {
    const [t] = lista;
    const cuit = soloDigitos(String(fila.cuit ?? ''));
    const dni = soloDigitos(String(fila.documento ?? ''));
    if (cuit) {
      if (esCuitValido(cuit)) {
        t.documento = cuit;
        // 20/23/24/27 son prefijos de personas (CUIL); 30/33/34, de empresas (CUIT).
        t.tipoDocumento = t.tipoPersona === TipoPersona.JURIDICA || /^3/.test(cuit) ? 'CUIT' : 'CUIL';
        if (/^3/.test(cuit)) t.tipoPersona = TipoPersona.JURIDICA;
      } else avisos.push(`CUIT/CUIL ${fila.cuit} con dígito verificador inválido: no se cargó.`);
    } else if (dni && t.tipoPersona === TipoPersona.FISICA) {
      if (/^\d{7,8}$/.test(dni)) {
        t.documento = dni;
        t.tipoDocumento = 'DNI';
      } else avisos.push(`Documento ${fila.documento} con largo inválido: no se cargó.`);
    }
  } else if (lista.length > 1 && (fila.cuit || fila.documento)) {
    avisos.push(`Hay ${lista.length} titulares y un solo documento: no se asignó a ninguno.`);
  }
  return lista;
}

/** Polygon → MultiPolygon (el sistema guarda todo como MultiPolygon). */
export function aMultiPolygon(g: Polygon | MultiPolygon): MultiPolygon {
  return g.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [g.coordinates] } : g;
}
