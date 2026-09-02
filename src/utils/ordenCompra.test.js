import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotalesOrden, formatearCodigoOrden, numeroALetrasOrden, validarOrdenCompra } from './ordenCompra.js';

test('formatea el correlativo oficial sin separadores inventados', () => {
  assert.equal(formatearCodigoOrden('OC', 100111, 6), 'OC100111');
});

test('calcula subtotal, IGV y total con redondeo monetario', () => {
  assert.deepEqual(calcularTotalesOrden([{ cantidad: 1, precioUnitario: 170 }]), {
    subtotal: 170,
    igv: 30.6,
    total: 200.6
  });
});

test('convierte el total de referencia a letras', () => {
  assert.equal(numeroALetrasOrden(200.6, 'US$'), 'DOSCIENTOS CON 60/100 DOLARES AMERICANOS');
});

test('rechaza órdenes incompletas', () => {
  const errores = validarOrdenCompra({ items: [] });
  assert.ok(errores.proveedor);
  assert.ok(errores.items);
});

test('mantiene correlativos únicos y estables bajo una ráfaga de 100 asignaciones', () => {
  const codigos = Array.from({ length: 100 }, (_, index) => formatearCodigoOrden('OC', 100111 + index, 6));
  assert.equal(new Set(codigos).size, 100);
  assert.equal(codigos.at(0), 'OC100111');
  assert.equal(codigos.at(-1), 'OC100210');
});

test('calcula una orden de 100 ítems sin pérdida de precisión monetaria', () => {
  const items = Array.from({ length: 100 }, () => ({ cantidad: 3, precioUnitario: 19.99 }));
  assert.deepEqual(calcularTotalesOrden(items), { subtotal: 5997, igv: 1079.46, total: 7076.46 });
});
