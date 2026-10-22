// Permisos del sistema y plantillas por rol. Los códigos son fijos (los usa el código para
// proteger cada acción). Lo que vale para cada usuario son los permisos que Informática le
// asigna (seg_usuario_permiso); los roles son solo plantillas para empezar (seg_rol_permiso).
import { Oficina } from '../expedientes/expedientes.constantes.js';

/** Acciones protegidas. Consultar expedientes no requiere permiso (salvo ver datos sensibles). */
export enum Permiso {
  // Generales: se pueden asignar a usuarios de cualquier oficina.
  EXPEDIENTE_TOMAR = 'EXPEDIENTE_TOMAR',
  DATOS_SENSIBLES_VER = 'DATOS_SENSIBLES_VER',
  // Catastro
  ALTA_INICIAR = 'ALTA_INICIAR',
  ALTA_CARGAR = 'ALTA_CARGAR',
  KML_CARGAR = 'KML_CARGAR',
  ALTA_CERRAR = 'ALTA_CERRAR',
  MAPA_PUBLICAR = 'MAPA_PUBLICAR',
  NUMERO_ASIGNAR = 'NUMERO_ASIGNAR',
  CATALOGOS_ADMINISTRAR = 'CATALOGOS_ADMINISTRAR',
  // Recaudación
  DEUDA_VERIFICAR = 'DEUDA_VERIFICAR',
  // Distrito
  DISTRITO_DICTAMINAR = 'DISTRITO_DICTAMINAR',
  // Jurídico
  JURIDICO_DICTAMINAR = 'JURIDICO_DICTAMINAR',
  // Secretaría General
  NUMERO_SOLICITAR = 'NUMERO_SOLICITAR',
  RESOLUCION_CARGAR = 'RESOLUCION_CARGAR',
  // Pozos
  BAJA_POZO_GESTIONAR = 'BAJA_POZO_GESTIONAR',
  EMPRESAS_GESTIONAR = 'EMPRESAS_GESTIONAR',
}

interface DefinicionPermiso {
  /** Oficina a la que pertenece; null = se puede asignar en cualquier oficina. */
  oficina: Oficina | null;
  grupo: string;
  nombre: string;
  descripcion: string;
}

export const PERMISOS_INICIALES: Record<Permiso, DefinicionPermiso> = {
  [Permiso.EXPEDIENTE_TOMAR]: { oficina: null, grupo: 'Generales', nombre: 'Tomar expedientes', descripcion: 'Recibir en la oficina un expediente que llegó, para trabajar en él.' },
  [Permiso.DATOS_SENSIBLES_VER]: {
    oficina: null,
    grupo: 'Generales',
    nombre: 'Ver datos sensibles',
    descripcion: 'DNI / CUIT, domicilios, teléfonos, emails y montos de deudas. Sin este permiso se muestran ocultos.',
  },
  [Permiso.ALTA_INICIAR]: { oficina: Oficina.CATASTRO, grupo: 'Alta de concesión', nombre: 'Crear expedientes e iniciar el trámite', descripcion: 'Registrar el expediente de un alta de concesión nueva.' },
  [Permiso.ALTA_CARGAR]: { oficina: Oficina.CATASTRO, grupo: 'Alta de concesión', nombre: 'Editar los datos del alta', descripcion: 'Cargar y corregir los datos del alta y enviarla al circuito.' },
  [Permiso.KML_CARGAR]: {
    oficina: Oficina.CATASTRO,
    grupo: 'Alta de concesión',
    nombre: 'Cargar o reemplazar el KML',
    descripcion: 'Subir el polígono de la concesión (KML / GeoJSON). Cambia lo que se ve en el visor.',
  },
  [Permiso.ALTA_CERRAR]: { oficina: Oficina.CATASTRO, grupo: 'Alta de concesión', nombre: 'Cerrar altas', descripcion: 'Verificación final y carga del padrón de Rentas.' },
  [Permiso.MAPA_PUBLICAR]: {
    oficina: Oficina.CATASTRO,
    grupo: 'Alta de concesión',
    nombre: 'Publicar en el mapa',
    descripcion: 'Verificar el polígono de una concesión con resolución y publicarlo en Argenmap, u observarlo con una nota.',
  },
  [Permiso.NUMERO_ASIGNAR]: { oficina: Oficina.CATASTRO, grupo: 'Alta de concesión', nombre: 'Asignar N° de concesión', descripcion: 'Cargar el número de concesión que pidió Secretaría General.' },
  [Permiso.CATALOGOS_ADMINISTRAR]: { oficina: Oficina.CATASTRO, grupo: 'Catálogos', nombre: 'Administrar catálogos', descripcion: 'Altas, cambios y bajas de ubicaciones, suministro y cauces.' },
  [Permiso.DEUDA_VERIFICAR]: { oficina: Oficina.RECAUDACION, grupo: 'Recaudación', nombre: 'Verificar deudas', descripcion: 'Verificar la deuda de los titulares, avisar y registrar pagos.' },
  [Permiso.DISTRITO_DICTAMINAR]: { oficina: Oficina.DISTRITO, grupo: 'Distrito', nombre: 'Informe técnico de Distrito', descripcion: 'Dictaminar apto / no apto / observado y tomar conocimiento de bajas.' },
  [Permiso.JURIDICO_DICTAMINAR]: { oficina: Oficina.JURIDICO, grupo: 'Jurídico', nombre: 'Dictamen jurídico', descripcion: 'Dictaminar sobre altas y bajas.' },
  [Permiso.NUMERO_SOLICITAR]: { oficina: Oficina.SECRETARIA_GENERAL, grupo: 'Secretaría General', nombre: 'Pedir N° de concesión', descripcion: 'Pedir a Catastro el número de concesión.' },
  [Permiso.RESOLUCION_CARGAR]: { oficina: Oficina.SECRETARIA_GENERAL, grupo: 'Secretaría General', nombre: 'Cargar resoluciones', descripcion: 'Registrar la resolución de un trámite.' },
  [Permiso.BAJA_POZO_GESTIONAR]: {
    oficina: Oficina.POZOS,
    grupo: 'Pozos',
    nombre: 'Gestionar bajas de pozo',
    descripcion: 'Iniciar bajas, controlar documentación, antecedentes, evaluación técnica y clausura.',
  },
  [Permiso.EMPRESAS_GESTIONAR]: { oficina: Oficina.POZOS, grupo: 'Pozos', nombre: 'Gestionar empresas perforadoras', descripcion: 'Registrar empresas perforadoras y sus máquinas.' },
};

/** «Cargar o reemplazar el KML» → «cargar o reemplazar el KML» (para armar mensajes). */
export const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Un permiso se puede asignar a un usuario de esa oficina (los generales, a cualquiera). */
export const permisoDeLaOficina = (permiso: string, oficina: string | null | undefined) => {
  const def = PERMISOS_INICIALES[permiso as Permiso];
  return !!def && (def.oficina === null || def.oficina === oficina);
};

export enum Rol {
  JEFE = 'JEFE',
  OPERADOR = 'OPERADOR',
  CONSULTA = 'CONSULTA',
}

export const ROLES_INICIALES: Record<Rol, { nombre: string; descripcion: string }> = {
  [Rol.JEFE]: { nombre: 'Jefe', descripcion: 'Responsable de la oficina: todo lo de la oficina.' },
  [Rol.OPERADOR]: { nombre: 'Operador', descripcion: 'Trabaja los expedientes de la oficina.' },
  [Rol.CONSULTA]: { nombre: 'Solo consulta', descripcion: 'Ve la información, sin modificar nada.' },
};

/** Plantilla de Jefe y Operador de cada oficina (además de tomar expedientes). */
const DE_OFICINA: Record<Oficina, Permiso[]> = {
  [Oficina.CATASTRO]: [Permiso.DATOS_SENSIBLES_VER, Permiso.ALTA_INICIAR, Permiso.ALTA_CARGAR, Permiso.ALTA_CERRAR, Permiso.NUMERO_ASIGNAR],
  [Oficina.RECAUDACION]: [Permiso.DATOS_SENSIBLES_VER, Permiso.DEUDA_VERIFICAR],
  [Oficina.DISTRITO]: [Permiso.DISTRITO_DICTAMINAR],
  [Oficina.JURIDICO]: [Permiso.DATOS_SENSIBLES_VER, Permiso.JURIDICO_DICTAMINAR],
  [Oficina.SECRETARIA_GENERAL]: [Permiso.NUMERO_SOLICITAR, Permiso.RESOLUCION_CARGAR],
  [Oficina.POZOS]: [Permiso.BAJA_POZO_GESTIONAR, Permiso.EMPRESAS_GESTIONAR],
};

/** Solo en la plantilla del Jefe: lo que cambia datos compartidos (el visor, los catálogos). */
const SOLO_JEFE: Partial<Record<Oficina, Permiso[]>> = {
  [Oficina.CATASTRO]: [Permiso.KML_CARGAR, Permiso.MAPA_PUBLICAR, Permiso.CATALOGOS_ADMINISTRAR],
};

/** Plantillas iniciales (seg_rol_permiso). Solo consulta no tiene permisos. */
export const MATRIZ_INICIAL: { oficina: Oficina; rol: Rol; permiso: Permiso }[] = Object.values(Oficina).flatMap((oficina) => [
  ...[Permiso.EXPEDIENTE_TOMAR, ...DE_OFICINA[oficina]].flatMap((permiso) => [Rol.JEFE, Rol.OPERADOR].map((rol) => ({ oficina, rol, permiso }))),
  ...(SOLO_JEFE[oficina] ?? []).map((permiso) => ({ oficina, rol: Rol.JEFE, permiso })),
]);
