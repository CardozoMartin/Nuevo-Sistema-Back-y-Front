import { ocultarDatosSensibles } from './datos-sensibles.js';

describe('ocultarDatosSensibles', () => {
  const alta = {
    numeroExpediente: '155905/332-2026',
    expediente: { numero: '155905' },
    titulares: [{ documento: '37483853', apellido: 'Cardozo', email: 'a@b.com', telefono: '3812032666' }],
    domicilios: [{ calle: 'Francisco de Aguirre', numero: '525', localidad: 'ALDERETES' }],
    deudas: [{ detalle: 'Canon 2025', monto: '1500.00', comprobantePago: 'R-1' }],
  };

  it('enmascara el documento dejando los últimos 3 dígitos', () => {
    expect(ocultarDatosSensibles(alta).titulares[0].documento).toBe('•••••853');
  });

  it('saca contacto, domicilios y montos; deja lo demás', () => {
    const r = ocultarDatosSensibles(alta);
    expect(r.titulares[0]).toMatchObject({ apellido: 'Cardozo', email: null, telefono: null });
    expect(r.domicilios).toEqual([]);
    expect(r.deudas[0]).toEqual({ detalle: 'Canon 2025', monto: null, comprobantePago: null });
    expect(r.numeroExpediente).toBe('155905/332-2026');
    expect(r.expediente.numero).toBe('155905');
  });

  it('marca la respuesta para que el front lo avise', () => {
    expect(ocultarDatosSensibles(alta)).toHaveProperty('datosSensiblesOcultos', true);
    expect(ocultarDatosSensibles([{ documento: '20123456789' }])).toEqual([{ documento: '••••••••789' }]);
  });
});
