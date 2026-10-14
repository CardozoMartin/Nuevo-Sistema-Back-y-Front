import type { DataSource } from 'typeorm';
import type { UsuariosService } from '../seguridad/usuarios.service.js';
import { Etapa, EstadoExpediente, Oficina, TipoTramite } from './expedientes.constantes.js';
import { ExpedientesService } from './expedientes.service.js';

/** El service con una base falsa que solo responde findOneBy. */
function serviceCon(encontrado: object | null) {
  const findOneBy = vi.fn().mockResolvedValue(encontrado);
  const service = new ExpedientesService({ manager: { findOneBy } } as unknown as DataSource, {} as UsuariosService);
  return { service, findOneBy };
}

describe('Disponibilidad del número de expediente', () => {
  it('un número que no está registrado está libre', async () => {
    const { service } = serviceCon(null);
    await expect(service.disponibilidad({ numero: '123', reparticion: '332', anio: 2026 })).resolves.toEqual({ numero: '123/332-2026', disponible: true, expediente: null });
  });

  it('busca sin ceros a la izquierda: 0123 y 123 son el mismo número', async () => {
    const { service, findOneBy } = serviceCon(null);
    await service.disponibilidad({ numero: '000123', reparticion: '0332', anio: 2026 });
    expect(findOneBy).toHaveBeenCalledWith(expect.anything(), { numero: '123', reparticion: '332', anio: 2026 });
  });

  it('si ya está registrado, dice de qué trámite es y dónde está', async () => {
    const { service } = serviceCon({
      id: '7',
      tipoTramite: TipoTramite.ALTA_CONCESION,
      estado: EstadoExpediente.EN_TRAMITE,
      etapa: Etapa.CARGA,
      oficinaActual: Oficina.CATASTRO,
      fechaIngreso: '2026-10-01',
    });
    const r = await service.disponibilidad({ numero: '123', reparticion: '332', anio: 2026 });
    expect(r.disponible).toBe(false);
    expect(r.expediente).toMatchObject({ id: '7', tipoTramiteNombre: 'Alta de concesión', oficinaNombre: 'Catastro', etapaNombre: 'Carga de datos' });
  });
});
