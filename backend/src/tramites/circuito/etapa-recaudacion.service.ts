import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dictamen, EstadoExpediente, Etapa, formatearNumeroExpediente, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { Expediente } from '../../expedientes/entities/expediente.entity.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { NotificacionesService, type EmailRegistrado } from '../../notificaciones/notificaciones.service.js';
import { TipoEmail } from '../../notificaciones/notificaciones.constantes.js';
import { nombrePersona } from '../../personas/entities/persona.entity.js';
import { RecaudacionService, type ConcesionConDeuda } from '../../recaudacion/recaudacion.service.js';
import { armarAvisoDeuda } from './aviso-deuda.js';
import type { NotificarDeudaDto, VerificacionDeudaDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { destinoTrasVerificarDeuda, respuestasDeDeuda } from './validaciones/circuito.validaciones.js';

/** Resultado de notificar la deuda: a quién se mandó y quién no tiene correo. */
export interface ResultadoAvisoDeuda {
  enviados: (EmailRegistrado & { titular: string })[];
  sinCorreo: string[];
}

/** Lo que Recaudación tiene que verificar de un expediente (GET …/recaudacion). */
export interface AntecedentesDeuda {
  /** Titulares del trámite. */
  titulares: { personaId: string; nombre: string; documento: string | null }[];
  /** Concesiones otorgadas de esos titulares, con todos sus titulares y si tienen deuda. */
  concesiones: (ConcesionConDeuda & { deTitulares: string[] })[];
  /** Deudas pendientes de los titulares registradas sin concesión (antes de este modelo). */
  otrasDeudas: { id: string; personaId: string; detalle: string }[];
}

/**
 * Recaudación: ¿los titulares del trámite tienen otras concesiones otorgadas con deuda?
 *
 *   antecedentes    las concesiones otorgadas de los titulares (tener otra concesión solo se
 *                   informa) y si cada una tiene deuda. Por ahora la deuda es sí / no, sin monto.
 *   verificarDeuda  Recaudación responde, por cada concesión, si tiene deuda. La deuda queda
 *                   ligada a la concesión y a todos sus titulares vigentes.
 *                     - Ninguna con deuda: pasa a Distrito (o, si llegó porque cambiaron los
 *                       titulares al corregir, vuelve a la oficina que había observado).
 *                     - Alguna con deuda: NO se rechaza; el expediente queda EN ESPERA en
 *                       Recaudación, sin plazo. Recaudación puede volver a responder (ej: «ya no
 *                       tiene deuda») o se cancela la deuda (POST /api/deudas/:id/cancelar), y
 *                       entonces se reanuda.
 *   notificarDeuda  manda un correo a cada titular con deuda pendiente.
 */
@Injectable()
export class EtapaRecaudacionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly expedientes: ExpedientesService,
    private readonly recaudacion: RecaudacionService,
    private readonly notificaciones: NotificacionesService,
    private readonly registro: RegistroTramitesService,
  ) {}

  async antecedentes(tipo: TipoTramite, expedienteId: string): Promise<AntecedentesDeuda> {
    return this.dataSource.transaction(async (tx) => {
      // Solo lectura: no se bloquea el expediente.
      const expediente = await tx.findOneBy(Expediente, { id: expedienteId, tipoTramite: tipo });
      if (!expediente) throw new NotFoundException('No se encontró el expediente.');
      const personas = await this.registro.de(tipo).personasAVerificar(tx, expediente);
      const ids = personas.map((p) => p.id);
      const concesiones = await this.recaudacion.concesionesDe(tx, ids, expediente.id);
      const pendientes = await this.recaudacion.pendientesDe(tx, ids);
      return {
        titulares: personas.map((p) => ({ personaId: p.id, nombre: nombrePersona(p), documento: p.documento })),
        concesiones: concesiones.map((c) => ({ ...c, deTitulares: c.titulares.map((t) => t.personaId).filter((id) => ids.includes(id)) })),
        otrasDeudas: pendientes.filter((d) => !d.concesion).map((d) => ({ id: d.id, personaId: d.persona.id, detalle: d.detalle })),
      };
    });
  }

  async verificarDeuda(tipo: TipoTramite, expedienteId: string, datos: VerificacionDeudaDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Recaudación tiene que tener tomado el expediente, en su etapa. Si está en espera por
      //    deuda también puede actuar: por ejemplo, para registrar que ya no la tiene.
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.RECAUDACION], usuarioId, [
        EstadoExpediente.EN_TRAMITE,
        EstadoExpediente.EN_ESPERA,
      ]);

      //2.- Los titulares del trámite y sus concesiones otorgadas: hay que responder por todas.
      const personas = await this.registro.de(tipo).personasAVerificar(tx, expediente);
      const personaIds = personas.map((p) => p.id);
      const concesiones = await this.recaudacion.concesionesDe(tx, personaIds, expediente.id);
      const respuestas = respuestasDeDeuda(concesiones, datos.concesiones);

      //3.- Se registra lo respondido: primero las deudas nuevas y después las que se levantan
      //    (así, al cancelar, no se reanuda un expediente que sigue con otra deuda).
      for (const c of concesiones.filter((c) => respuestas.get(c.id))) await this.recaudacion.marcarDeuda(tx, c, expediente, usuario);
      for (const c of concesiones.filter((c) => !respuestas.get(c.id) && c.tieneDeuda)) await this.recaudacion.quitarDeuda(tx, c, usuario);
      const conDeuda = concesiones.filter((c) => respuestas.get(c.id)).map((c) => ({ id: c.id, numero: c.numero }));

      //4.- ¿Queda alguna deuda pendiente de los titulares (de estas concesiones o de antes)?
      const pendientes = await this.recaudacion.pendientesDe(tx, personaIds);
      const actual = await this.expedientes.bloquear(tx, expediente.id, tipo); // quitarDeuda pudo reanudarlo

      if (pendientes.length) {
        //5.- Con deuda: queda en espera en Recaudación (o sigue en espera), tomado por el mismo usuario.
        await this.expedientes.actuar(tx, actual, {
          tipo: TipoActuacion.VERIFICACION_DEUDA,
          resultado: ResultadoActuacion.CON_DEUDA,
          usuario,
          observaciones: datos.observaciones,
          datos: { concesionesConDeuda: conDeuda, deudas: pendientes.map((d) => ({ id: d.id, personaId: d.persona.id, concesionId: d.concesion?.id ?? null })) },
        });
        if (actual.estado !== EstadoExpediente.EN_ESPERA) await this.expedientes.cambiarEstado(tx, actual, EstadoExpediente.EN_ESPERA, usuario);
        return;
      }

      //6.- Sin deuda: si estaba en espera se reanuda, y pasa a Distrito (o a la oficina que observó
      //    si vino por un cambio de titulares).
      if (actual.estado === EstadoExpediente.EN_ESPERA) await this.expedientes.cambiarEstado(tx, actual, EstadoExpediente.EN_TRAMITE, usuario);
      const correccion = await this.expedientes.ultimaActuacion(tx, actual.id, [TipoActuacion.CORRECCION]);
      const ultimoSinDeuda = await this.expedientes.ultimaActuacion(tx, actual.id, [TipoActuacion.VERIFICACION_DEUDA], ResultadoActuacion.SIN_DEUDA);
      const destino = destinoTrasVerificarDeuda(correccion, ultimoSinDeuda, SIGUIENTE_ETAPA[Etapa.RECAUDACION]!);

      //6.1.- Queda registrado A QUIÉNES y QUÉ concesiones se verificó (si cambian, se vuelve a verificar).
      await this.expedientes.actuar(tx, actual, {
        tipo: TipoActuacion.VERIFICACION_DEUDA,
        resultado: ResultadoActuacion.SIN_DEUDA,
        usuario,
        observaciones: datos.observaciones,
        datos: { personas: personaIds, concesiones: concesiones.map((c) => c.id) },
      });
      await this.expedientes.pasar(tx, actual, { etapa: destino, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones });
    });
  }

  async notificarDeuda(tipo: TipoTramite, expedienteId: string, datos: NotificarDeudaDto, usuarioId: string): Promise<ResultadoAvisoDeuda> {
    //1.- Recaudación tiene que tener tomado el expediente, en su etapa (en espera o no).
    const { expediente, usuario, deudores } = await this.dataSource.transaction(async (tx) => {
      const { expediente, usuario } = await this.expedientes.bloquearParaActuar(tx, expedienteId, tipo, [Etapa.RECAUDACION], usuarioId, [
        EstadoExpediente.EN_TRAMITE,
        EstadoExpediente.EN_ESPERA,
      ]);

      //2.- Las deudas pendientes de las personas del trámite, agrupadas por persona.
      const personas = await this.registro.de(tipo).personasAVerificar(tx, expediente);
      const pendientes = await this.recaudacion.pendientesDe(tx, personas.map((p) => p.id));
      if (!pendientes.length) throw new ConflictException('Las personas del expediente no tienen deudas pendientes registradas: no hay nada que notificar.');
      const deudores = personas
        .map((persona) => ({ persona, deudas: pendientes.filter((d) => d.persona.id === persona.id) }))
        .filter((d) => d.deudas.length);
      return { expediente, usuario, deudores };
    });

    //3.- Se valida que al menos un deudor tenga correo cargado.
    const conCorreo = deudores.filter((d) => d.persona.email);
    const sinCorreo = deudores.filter((d) => !d.persona.email).map((d) => nombrePersona(d.persona));
    if (!conCorreo.length) throw new BadRequestException(`Ninguna persona con deuda tiene correo cargado (${sinCorreo.join(', ')}). Cárguelo en los datos del titular.`);

    //4.- Un correo por deudor, con el detalle de SUS deudas (fuera de la transacción: el envío puede tardar).
    const numero = formatearNumeroExpediente(expediente.numero, expediente.reparticion, expediente.anio);
    const enviados: ResultadoAvisoDeuda['enviados'] = [];
    for (const { persona, deudas } of conCorreo) {
      const titular = nombrePersona(persona);
      const { asunto, cuerpo } = armarAvisoDeuda({
        expediente: numero,
        tramite: expediente.asunto ?? 'su trámite',
        titular,
        deudas: deudas.map((d) => ({ detalle: d.detalle, monto: d.monto === null ? null : Number(d.monto) })),
        observaciones: datos.observaciones,
      });
      enviados.push({ titular, ...(await this.notificaciones.enviar({ tipo: TipoEmail.AVISO_DEUDA, expediente, para: [persona.email!], asunto, cuerpo, usuario })) });
    }

    //5.- Queda en el historial del expediente a quién se avisó y con qué resultado.
    await this.dataSource.transaction((tx) =>
      this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.NOTIFICACION,
        resultado: ResultadoActuacion.REGISTRADO,
        usuario,
        observaciones: `Aviso de deuda por correo a ${enviados.map((e) => `${e.titular} (${e.para.join(', ')})`).join(', ')}.`,
        datos: { emails: enviados.map((e) => ({ id: e.id, para: e.para, estado: e.estado })), sinCorreo },
      }),
    );
    return { enviados, sinCorreo };
  }
}
