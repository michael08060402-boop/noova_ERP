import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estaAtrasada, etiquetaDia, porPublicar, publicadasRecientes, sumarDias } from './calendario.js';

const pieza = (id, estado, fecha, hora, extra = {}) => ({ id, metadatos: { estado, aprobacion: fecha ? { fecha, hora } : null, ...extra } });
// 2026-11-10 09:00 en Lima (UTC-5)
const AHORA = new Date('2026-11-10T14:00:00Z');

test('Solo lista lo aprobado con fecha y hora, ordenado por momento', () => {
  const lista = porPublicar([
    pieza('c', 'aprobado', '2026-11-12', '09:07'),
    pieza('a', 'aprobado', '2026-11-10', '12:07'),
    pieza('x', 'borrador', '2026-11-11', '09:00'),
    pieza('p', 'publicado', '2026-11-09', '09:00'),
    pieza('s', 'aprobado', null, null)
  ]);
  assert.deepEqual(lista.map((p) => p.id), ['a', 'c']);
});

test('Detecta lo atrasado según la hora de Lima', () => {
  assert.equal(estaAtrasada(pieza('a', 'aprobado', '2026-11-10', '08:00'), AHORA), true);
  assert.equal(estaAtrasada(pieza('a', 'aprobado', '2026-11-10', '09:30'), AHORA), false);
  assert.equal(estaAtrasada(pieza('a', 'aprobado', '2026-11-09', '23:59'), AHORA), true);
});

test('Nombra los días y ordena las publicadas por fecha de salida', () => {
  assert.equal(etiquetaDia('2026-12-01', '2026-11-30'), 'Mañana');
  const recientes = publicadasRecientes([
    pieza('a', 'publicado', null, null, { publicadoEn: '2026-11-01T10:00:00Z' }),
    pieza('b', 'publicado', null, null, { publicadoEn: '2026-11-05T10:00:00Z' }),
    pieza('c', 'aprobado', '2026-11-10', '09:00')
  ], 5);
  assert.deepEqual(recientes.map((p) => p.id), ['b', 'a']);
});

test('Suma días cruzando el fin de mes', () => {
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
});
