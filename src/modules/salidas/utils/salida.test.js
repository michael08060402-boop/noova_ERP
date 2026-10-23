import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveGuia,
  completarSalida,
  crearSalida,
  destinoDesdeGuia,
  formatearCorrelativo,
  formatearGuia,
  formatoDesdeGuia,
  itemsConDatos,
  motivoDesdeGuia,
  numerarSinCorrelativo,
  separarNumeroGuia,
  siguienteCorrelativo,
  validarSalida
} from './salida.js';

const GUIA = {
  serie: 'EG07',
  numero: '108',
  fechaTraslado: '2026-10-22',
  horaEmision: '13:11',
  puntoPartida: 'AV. CRISTOBAL DE PERALTA NORTE NRO. 110',
  motivoTraslado: 'OTROS',
  descripcionMotivo: 'TRASLADO A UM INMACULADA',
  destinatarioNombre: 'COMPANIA MINERA ARES S.A.C.'
};

const POR_DEFECTO = { persona: 'Luis Hostos', solicitante: 'Luis Hostos', autorizador: 'Elena Mendoza' };

function salidaCompleta(cambios = {}) {
  return crearSalida({
    guia: { serie: 'EG07', numero: '108' },
    formato: { correlativo: 7, fechaSalida: '2026-10-22', destino: 'UM PRUEBA' },
    items: [{ descripcion: 'Testo 425', serie: '85952305', cantidad: 1, unidad: 'UND' }],
    ...cambios
  });
}

test('lee el N° de guía escrito a mano y arma la clave de duplicado', () => {
  assert.deepEqual(separarNumeroGuia('eg07-00000108'), { serie: 'EG07', numero: '108' });
  assert.equal(separarNumeroGuia('108'), null);
  assert.equal(claveGuia({ serie: 'eg07', numero: '00000108' }), '09-EG07-108');
  assert.equal(claveGuia({ serie: 'EG07', numero: '' }), '');
  assert.equal(formatearGuia({ serie: 'EG07', numero: '108' }), 'EG07-00000108');
  assert.equal(formatearCorrelativo(7), 'N° 0007');
});

test('llena el formato con la guía, el usuario como solicitante y Elena como autorizadora', () => {
  const formato = formatoDesdeGuia(GUIA, { ...POR_DEFECTO, correlativo: 3 });
  assert.equal(formato.correlativo, 3);
  assert.equal(formato.lugar, 'AV. CRISTOBAL DE PERALTA NORTE NRO. 110');
  assert.equal(formato.fechaSalida, '2026-10-22');
  assert.equal(formato.destino, 'PROYECTO - UM INMACULADA - COMPANIA MINERA ARES S.A.C.');
  assert.equal(formato.personaAutorizada, 'Luis Hostos');
  assert.equal(formato.jefeAutoriza, 'Elena Mendoza');
  assert.equal(formato.motivo, 'trabajo');
  assert.deepEqual(formato.salida.solicita, { nombre: 'Luis Hostos', fecha: '2026-10-22', hora: '13:11' });
  assert.deepEqual(formato.salida.autoriza, { nombre: 'Elena Mendoza', fecha: '2026-10-22', hora: '13:11' });
});

test('arma el destino y el motivo solo con lo que dice la guía', () => {
  assert.equal(destinoDesdeGuia({ destinatarioNombre: 'MINERA X' }), 'MINERA X');
  assert.equal(destinoDesdeGuia({ puntoLlegada: 'KM 5' }), 'KM 5');
  assert.equal(motivoDesdeGuia({ motivoTraslado: 'VENTA' }), 'despacho');
  assert.equal(motivoDesdeGuia({ motivoTraslado: 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA' }), 'transferencia');
  assert.equal(motivoDesdeGuia({ motivoTraslado: 'OTROS' }), 'trabajo');
});

test('una salida completa es válida y las filas vacías se ignoran', () => {
  const salida = salidaCompleta();
  salida.items.push({ id: 'vacia', descripcion: '', cantidad: '', unidad: '', estado: 'Enviado' });
  assert.equal(itemsConDatos(salida.items).length, 1);
  assert.equal(validarSalida(salida).valido, true);
  assert.equal(salida.items[0].estado, 'Enviado');
});

test('marca las celdas incompletas, series repetidas y serie con cantidad distinta de 1', () => {
  const salida = salidaCompleta({
    items: [
      { descripcion: '', cantidad: 2, unidad: 'UND' },
      { descripcion: 'Pinza', serie: 'S2', cantidad: 3, unidad: '' },
      { descripcion: 'A', serie: 'x1', cantidad: 1, unidad: 'UND' },
      { descripcion: 'B', serie: 'X1', cantidad: 1, unidad: 'UND' }
    ]
  });
  const { valido, porItem } = validarSalida(salida);
  const [a, b, c, d] = salida.items;
  assert.equal(valido, false);
  assert.deepEqual(porItem[a.id], ['descripcion']);
  assert.deepEqual(porItem[b.id].sort(), ['cantidad', 'unidad']);
  assert.deepEqual(porItem[c.id], ['serie']);
  assert.deepEqual(porItem[d.id], ['serie']);
});

test('exige los datos obligatorios del formato', () => {
  const salida = salidaCompleta({ guia: { serie: '', numero: '' } });
  salida.formato.correlativo = '';
  salida.formato.motivo = 'otros';
  salida.formato.destino = '';
  assert.deepEqual(Object.keys(validarSalida(salida).errores).sort(), ['correlativo', 'destino', 'guia', 'observacion']);
  assert.equal(validarSalida(salidaCompleta({ items: [] })).errores.items, 'Agrega al menos un bien.');
});

test('completa con la guía y los valores por defecto lo que falta en registros antiguos', () => {
  const antiguo = {
    estado: 'en_revision',
    guia: GUIA,
    formato: { correlativo: '', lugar: '', destino: 'Destino editado', salida: { solicita: { nombre: 'Gianfranco Errea Molina' } } },
    items: [{ descripcion: 'Testo 425', serie: '1', cantidad: 1, unidad: 'UND' }]
  };
  const s = completarSalida(antiguo, POR_DEFECTO);
  assert.equal(s.estado, 'pendiente');
  assert.equal(s.formato.lugar, GUIA.puntoPartida);
  assert.equal(s.formato.destino, 'Destino editado');
  assert.equal(s.formato.personaAutorizada, 'Luis Hostos');
  assert.deepEqual(s.formato.salida.solicita, { nombre: 'Gianfranco Errea Molina', fecha: '2026-10-22', hora: '13:11' });
  assert.equal(s.formato.salida.autoriza.nombre, 'Elena Mendoza');
  assert.equal(s.formato.dependencia, 'NOOVA S.A.C.');
  assert.equal(s.items[0].estado, 'Enviado');
});

test('numera en orden de creación los registros que no tienen N° de formato', () => {
  assert.equal(siguienteCorrelativo([{ formato: { correlativo: 6 } }, { formato: { correlativo: '9' } }]), 10);
  assert.equal(siguienteCorrelativo([]), 1);
  const salidas = [
    { id: 'a', formato: { correlativo: 3 }, guia: {}, items: [] },
    { id: 'b', formato: { correlativo: '' }, guia: {}, items: [], creadoEn: '2026-10-22T10:00:00Z' },
    { id: 'c', formato: {}, guia: {}, items: [], creadoEn: '2026-10-21T10:00:00Z' }
  ];
  assert.deepEqual(numerarSinCorrelativo(salidas).map((s) => [s.id, s.formato.correlativo]), [['c', 4], ['b', 5]]);
});
