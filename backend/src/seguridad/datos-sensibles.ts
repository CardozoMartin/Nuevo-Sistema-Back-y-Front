import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs';
import { DATOS_SENSIBLES, type PedidoAutenticado } from './auth.decorators.js';
import { Permiso } from './permisos.constantes.js';

/** Documento de una persona: se deja ver el final (para reconocerlo), el resto se oculta. */
const DOCUMENTO = /^(documento|solicitanteDocumento|numeroDocumento|cuit|cuil|dni)$/i;
/** Contacto y domicilio: no se muestran. */
const CONTACTO = /^(email|emails|telefono|telefonos|celular|domicilio|domicilioLegal|calle)$/i;
/** Listas de domicilios: vacías. */
const LISTA_DOMICILIOS = /^(domicilios)$/i;
/** Lo que verificó Recaudación: montos y comprobantes. */
const DEUDA = /^(monto|montos|importe|montoTotal|totalDeuda|comprobante|comprobantePago)$/i;

export const enmascararDocumento = (valor: unknown): unknown => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return valor;
  const s = String(valor);
  return s.length <= 3 ? '•••' : `${'•'.repeat(Math.min(s.length - 3, 8))}${s.slice(-3)}`;
};

/**
 * Oculta los datos sensibles de una respuesta (por el nombre de cada campo, en cualquier nivel).
 * Se agrega `datosSensiblesOcultos: true` al objeto principal para que el front lo avise.
 */
export function ocultarDatosSensibles<T>(respuesta: T): T {
  const recorrer = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(recorrer);
    if (!v || typeof v !== 'object' || v instanceof Date) return v;
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => {
        if (DOCUMENTO.test(k)) return [k, enmascararDocumento(x)];
        if (CONTACTO.test(k) || DEUDA.test(k)) return [k, x === null || x === undefined ? x : null];
        if (LISTA_DOMICILIOS.test(k) && Array.isArray(x)) return [k, []];
        return [k, recorrer(x)];
      }),
    );
  };
  const oculto = recorrer(respuesta);
  return (oculto && typeof oculto === 'object' && !Array.isArray(oculto) ? { ...oculto, datosSensiblesOcultos: true } : oculto) as T;
}

/**
 * Interceptor global: en las rutas marcadas @ConDatosSensibles(), si el usuario no tiene
 * DATOS_SENSIBLES_VER, oculta DNI / CUIT, domicilios, teléfonos, emails y montos de deudas.
 */
@Injectable()
export class DatosSensiblesInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const marcada = this.reflector.getAllAndOverride<boolean>(DATOS_SENSIBLES, [ctx.getHandler(), ctx.getClass()]);
    const usuario = ctx.switchToHttp().getRequest<PedidoAutenticado>().usuario;
    if (!marcada || !usuario || usuario.permisos.includes(Permiso.DATOS_SENSIBLES_VER)) return next.handle();
    return next.handle().pipe(map((respuesta: unknown) => ocultarDatosSensibles(respuesta)));
  }
}
