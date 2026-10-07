// Sistemas de referencia y límites usados por el módulo geográfico.

/**
 * POSGAR 2007 / Argentina faja 3 (Gauss-Krüger). Es el sistema oficial para Tucumán y el
 * de las coordenadas X/Y del esquema (X empieza con 3, Y con 7). Toda la geometría se
 * GUARDA en este sistema: las superficies y distancias salen en metros reales.
 */
export const SRID_POSGAR = 5345;

/**
 * WGS84 (latitud/longitud). Es el de los KML (lo fija el estándar) y el que usan Leaflet,
 * Google Earth y la web. La geometría ENTRA y SALE de la API en este sistema.
 */
export const SRID_WGS84 = 4326;

/**
 * Rectángulo que contiene a la provincia de Tucumán, con un margen de unos 10 km.
 * Sirve para detectar KML mal georreferenciados (coordenadas invertidas, otro sistema…).
 * TODO: reemplazar por el límite provincial real (capa del IGN) cuando se cargue.
 */
export const LIMITES_TUCUMAN = { oeste: -66.3, sur: -28.1, este: -64.4, norte: -25.95 } as const;

/**
 * Distancia máxima esperable entre una concesión y el río o canal más cercano (metros). Las
 * concesiones de riego están a la vera de los cauces: más lejos, probablemente el polígono está
 * mal ubicado (o falta el canal en la capa de cauces). Solo se avisa, no se rechaza.
 */
export const DISTANCIA_MAX_CAUCE_M = 2000;

/** Superposición mínima para avisar (m²). Debajo de esto son diferencias de digitalización. */
export const TOLERANCIA_SUPERPOSICION_M2 = 1;

/** Tamaño máximo de un KML (bytes). Un polígono de parcela pesa pocos KB. */
export const MAX_BYTES_KML = 5 * 1024 * 1024;
