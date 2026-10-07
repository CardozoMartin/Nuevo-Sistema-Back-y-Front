import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { DataSource } from 'typeorm';
import type { Expediente } from '../expedientes/entities/expediente.entity.js';
import type { Usuario } from '../seguridad/entities/usuario.entity.js';
import { Email } from './entities/email.entity.js';
import { EstadoEmail, type TipoEmail } from './notificaciones.constantes.js';

export interface NuevoEmail {
  tipo: TipoEmail;
  expediente?: Expediente | null;
  para: string[];
  asunto: string;
  cuerpo: string;
  usuario: Usuario;
}

/** Lo que se informa de cada correo (a la API y al historial del expediente). */
export interface EmailRegistrado {
  id: string;
  para: string[];
  asunto: string;
  estado: EstadoEmail;
  error: string | null;
}

/**
 * Envío de correos del sistema. Lo usa Recaudación (aviso de deuda) y lo van a usar otros
 * avisos (vencimientos, pozos…).
 *
 * El servidor de correo se configura en el .env (SMTP_HOST, SMTP_PUERTO, SMTP_USUARIO,
 * SMTP_CLAVE, SMTP_REMITENTE). Sin SMTP_HOST el sistema funciona en MODO PRUEBA: el correo se
 * registra en not_email como NO_ENVIADO_PRUEBA y no sale a nadie.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly transporte: Transporter | null;
  private readonly remitente: string;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const host = config.get<string>('SMTP_HOST');
    this.remitente = config.get<string>('SMTP_REMITENTE') ?? 'DRH - Sistema de Concesiones <no-responder@drh.local>';
    this.transporte = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PUERTO', 587)),
          secure: config.get('SMTP_SEGURO') === 'true',
          auth: config.get('SMTP_USUARIO') ? { user: config.get<string>('SMTP_USUARIO'), pass: config.get<string>('SMTP_CLAVE') } : undefined,
        })
      : null;
    if (!host) this.logger.warn('Sin SMTP_HOST: los correos se registran en modo prueba y no se envían.');
  }

  /**
   * Manda un correo y lo deja registrado:
   *   1. Se envía por el servidor de correo (o, sin servidor, se marca como modo prueba).
   *   2. Se guarda en not_email con el resultado. Un error de envío NO se lanza: queda
   *      registrado con estado ERROR para que la oficina lo vea y lo pueda reintentar.
   */
  async enviar(nuevo: NuevoEmail): Promise<EmailRegistrado> {
    //1.- Envío.
    let estado = EstadoEmail.NO_ENVIADO_PRUEBA;
    let error: string | null = null;
    if (this.transporte) {
      try {
        await this.transporte.sendMail({ from: this.remitente, to: nuevo.para, subject: nuevo.asunto, text: nuevo.cuerpo });
        estado = EstadoEmail.ENVIADO;
      } catch (e) {
        estado = EstadoEmail.ERROR;
        error = e instanceof Error ? e.message : String(e);
        this.logger.error(`No se pudo enviar «${nuevo.asunto}» a ${nuevo.para.join(', ')}: ${error}`);
      }
    }

    //2.- Registro.
    const email = await this.dataSource.manager.save(
      this.dataSource.manager.create(Email, {
        tipo: nuevo.tipo,
        expediente: nuevo.expediente ?? null,
        para: nuevo.para,
        asunto: nuevo.asunto,
        cuerpo: nuevo.cuerpo,
        estado,
        error,
        enviadoPor: nuevo.usuario,
      }),
    );
    return { id: email.id, para: email.para, asunto: email.asunto, estado, error };
  }

  /** Correos enviados por un expediente, del último al primero. */
  async deExpediente(expedienteId: string) {
    const emails = await this.dataSource.manager.find(Email, { where: { expediente: { id: expedienteId } }, order: { creadoEn: 'DESC' } });
    return emails.map((e) => ({ id: e.id, tipo: e.tipo, para: e.para, asunto: e.asunto, cuerpo: e.cuerpo, estado: e.estado, error: e.error, fecha: e.creadoEn }));
  }
}
