import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dictamen, EstadoExpediente, Etapa, formatearNumeroExpediente, ResultadoActuacion, SIGUIENTE_ETAPA, TipoActuacion, type TipoTramite } from '../../expedientes/expedientes.constantes.js';
import { ExpedientesService } from '../../expedientes/expedientes.service.js';
import { NotificacionesService, type EmailRegistrado } from '../../notificaciones/notificaciones.service.js';
import { TipoEmail } from '../../notificaciones/notificaciones.constantes.js';
import { nombrePersona } from '../../personas/entities/persona.entity.js';
import { RecaudacionService } from '../../recaudacion/recaudacion.service.js';
import { armarAvisoDeuda } from './aviso-deuda.js';
import type { NotificarDeudaDto, VerificacionDeudaDto } from './dto/circuito.dto.js';
import { RegistroTramitesService } from './registro-tramites.service.js';
import { destinoTrasVerificarDeuda } from './validaciones/circuito.validaciones.js';

/** Resultado de notificar la deuda: a quién se mandó y quién no tiene correo. */
export interface ResultadoAvisoDeuda {
  enviados: (EmailRegistrado & { titular: string })[];
  sinCorreo: string[];
}

/**
 * Recaudación: ¿las personas del trámite deben algo (Rentas u otra concesión)?
 *
 *   SIN_DEUDA (apto)     pasa a Distrito (o, si llegó porque cambiaron los titulares al corregir,
 *                        vuelve a la oficina que había observado).
 *   CON_DEUDA (no apto)  NO se rechaza: las deudas quedan registradas en la persona y el
 *                        expediente queda EN ESPERA en Recaudación, sin plazo. Cuando se cancelan
 *                        (POST /api/deudas/:id/cancelar) se reanuda solo y Recaudación lo pasa.
 *   notificarDeuda       manda un correo a cada persona con deuda pendiente.
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

  async verificarDeuda(tipo: TipoTramite, expedienteId: string, datos: VerificacionDeudaDto, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      //1.- Si está en espera por deuda no se puede dar otro resultado: se reanuda al pagar.
      const expediente = await this.expedientes.bloquear(tx, expedienteId, tipo);
      if (expediente.estado === EstadoExpediente.EN_ESPERA) {
        throw new ConflictException('El expediente está en espera por deuda: se reanuda cuando se cancelan las deudas pendientes.');
      }

      //2.- Recaudación tiene que tener tomado el expediente, en su etapa.
      const usuario = await this.expedientes.exigirParaActuar(expediente, [Etapa.RECAUDACION], usuarioId);

      //3.- Las personas a verificar (las define el trámite) y sus deudas pendientes.
      const personas = await this.registro.de(tipo).personasAVerificar(tx, expediente);
      const personaIds = personas.map((p) => p.id);
      const pendientes = await this.recaudacion.pendientesDe(tx, personaIds);

      if (datos.resultado === 'SIN_DEUDA') {
        //4.- Apto: se valida que no queden deudas registradas y pasa a Distrito.
        if (pendientes.length) {
          const quienes = [...new Set(pendientes.map((d) => nombrePersona(d.persona)))].join(', ');
          throw new ConflictException(`Hay deudas pendientes registradas de: ${quienes}. Cancélelas antes de dar el visto bueno.`);
        }
        //4.1.- ¿A dónde sigue? Distrito, o la oficina que observó si vino por un cambio de titulares.
        const correccion = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.CORRECCION]);
        const ultimoSinDeuda = await this.expedientes.ultimaActuacion(tx, expediente.id, [TipoActuacion.VERIFICACION_DEUDA], ResultadoActuacion.SIN_DEUDA);
        const destino = destinoTrasVerificarDeuda(correccion, ultimoSinDeuda, SIGUIENTE_ETAPA[Etapa.RECAUDACION]!);

        //4.2.- Queda registrado A QUIÉNES se verificó (si después cambian, se vuelve a verificar).
        await this.expedientes.actuar(tx, expediente, {
          tipo: TipoActuacion.VERIFICACION_DEUDA,
          resultado: ResultadoActuacion.SIN_DEUDA,
          usuario,
          observaciones: datos.observaciones,
          datos: { personas: personaIds },
        });
        await this.expedientes.pasar(tx, expediente, { etapa: destino, usuario, dictamen: Dictamen.APTO, observaciones: datos.observaciones });
        return;
      }

      //5.- No apto (con deuda): las deudas nuevas tienen que ser de personas de este trámite.
      const nuevas = datos.deudas ?? [];
      const ajenas = nuevas.filter((d) => !personaIds.includes(d.personaId));
      if (ajenas.length) throw new BadRequestException(`Las personas ${ajenas.map((d) => d.personaId).join(', ')} no son parte de este expediente.`);
      if (!nuevas.length && !pendientes.length) throw new BadRequestException('Indique las deudas que se detectaron (deudas: [{ personaId, detalle, monto }]).');

      //6.- Se registran las deudas (son de la persona) y el expediente queda en espera en
      //    Recaudación, tomado por el mismo usuario.
      const registradas = await this.recaudacion.registrar(tx, expediente, nuevas, usuario);
      await this.expedientes.actuar(tx, expediente, {
        tipo: TipoActuacion.VERIFICACION_DEUDA,
        resultado: ResultadoActuacion.CON_DEUDA,
        usuario,
        observaciones: datos.observaciones,
        datos: { deudas: [...registradas, ...pendientes].map((d) => ({ id: d.id, personaId: d.persona.id, detalle: d.detalle })) },
      });
      await this.expedientes.cambiarEstado(tx, expediente, EstadoExpediente.EN_ESPERA, usuario);
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
