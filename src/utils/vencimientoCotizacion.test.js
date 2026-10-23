import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAS_POR_VENCER, actualizacionReciente, diasValidez, estadoVisible } from './vencimientoCotizacion.js';

const HOY = new Date(2026, 9, 23);

function cot(fechaEmision, validez = '15 días', estado = 'Generada') {
  return { fechaEmision, validez, estado };
}

test('una cotización generada cuya validez ya pasó se muestra como Vencida', () => {
  const r = estadoVisible(cot('2026-10-01'), HOY);
  assert.equal(r.clave, 'vencida');
  assert.equal(r.label, 'Vencida');
  assert.equal(r.detalle, 'Válida hasta el 16/10/2026');
});

test('se marca por vencer desde el día de vencimiento hasta el límite de aviso', () => {
  assert.equal(estadoVisible(cot('2026-10-08'), HOY).label, 'Vence hoy');
  assert.equal(estadoVisible(cot('2026-10-09'), HOY).label, 'Vence en 1 día');
  const limite = estadoVisible(cot('2026-10-15'), HOY);
  assert.equal(limite.clave, 'por-vencer');
  assert.equal(limite.dias, DIAS_POR_VENCER);
});

test('con más días de validez queda Vigente', () => {
  const r = estadoVisible(cot('2026-10-20', '30 días'), HOY);
  assert.equal(r.clave, 'vigente');
  assert.equal(r.detalle, 'Válida hasta el 19/11/2026');
});

test('al generar la orden de compra el estado pasa a Aceptada aunque haya vencido', () => {
  assert.equal(estadoVisible(cot('2026-01-01', '15 días', 'Aceptada'), HOY).clave, 'aceptada');
  assert.equal(estadoVisible({ ...cot('2026-01-01'), ordenCompraId: 'x' }, HOY).clave, 'aceptada');
  assert.equal(estadoVisible(cot('2026-01-01', '15 días', 'Cancelada'), HOY).clave, 'cancelada');
});

test('sin fecha o sin validez no inventa un vencimiento', () => {
  assert.equal(estadoVisible(cot('', '15 días'), HOY).clave, 'generada');
  assert.equal(estadoVisible(cot('2026-10-01', ''), HOY).clave, 'generada');
  assert.equal(diasValidez({ validez: '20 días' }), 20);
});

test('resalta solo las cotizaciones actualizadas recientemente', () => {
  const ahora = new Date('2026-10-23T15:00:00Z');
  assert.equal(actualizacionReciente({ updatedAt: '2026-10-23T14:55:00Z', createdAt: '2026-10-01T10:00:00Z' }, ahora).hace, 'hace 5 min');
  assert.equal(actualizacionReciente({ updatedAt: '2026-10-23T13:30:00Z' }, ahora).hace, 'hace 1 h');
  assert.equal(actualizacionReciente({ updatedAt: '2026-10-23T12:30:00Z' }, ahora), null);
  assert.equal(actualizacionReciente({}, ahora), null);
});
