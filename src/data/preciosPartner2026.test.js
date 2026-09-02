import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTA_PRECIOS_PARTNER_2026,
  TOTAL_CODIGOS_PARTNER,
  TOTAL_FILAS_PARTNER,
  buscarProductoPartner,
  obtenerPrecioPartner
} from './preciosPartner2026.js';

test('la lista Partner conserva las 302 filas fuente y 300 códigos únicos', () => {
  assert.equal(TOTAL_FILAS_PARTNER, 302);
  assert.equal(TOTAL_CODIGOS_PARTNER, 300);
  assert.equal(LISTA_PRECIOS_PARTNER_2026.length, 300);
  assert.equal(new Set(LISTA_PRECIOS_PARTNER_2026.map((item) => item.codigo)).size, 300);
});

test('consulta Precio Partner por código sin depender de precios del ERP', () => {
  assert.equal(obtenerPrecioPartner('0560 1110'), 38.25);
  assert.equal(obtenerPrecioPartner('0560   0400'), 1827.5);
  assert.equal(buscarProductoPartner('codigo-inexistente'), null);
});
