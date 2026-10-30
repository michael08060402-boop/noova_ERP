import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estaAprobada, etiquetaEstado, hoyLima, puedeAprobar, validarAprobacion, validarMotivo } from './aprobacion.js';

const completo = { red: 'linkedin', fecha: '2026-11-16', hora: '09:07', revisado: true };

test('Aprueba solo con red, fecha, hora y revisión confirmada', () => {
  assert.equal(validarAprobacion(completo, [], '2026-11-10'), null);
  assert.ok(validarAprobacion({ ...completo, red: '' }, [], '2026-11-10'));
  assert.ok(validarAprobacion({ ...completo, hora: '25:00' }, [], '2026-11-10'));
  assert.ok(validarAprobacion({ ...completo, revisado: false }, [], '2026-11-10'));
});

test('No permite fechas pasadas ni aprobar con pendientes', () => {
  assert.ok(validarAprobacion({ ...completo, fecha: '2026-11-09' }, [], '2026-11-10'));
  assert.equal(validarAprobacion({ ...completo, fecha: '2026-11-10' }, [], '2026-11-10'), null);
  assert.ok(validarAprobacion(completo, ['Falta la frase de apertura'], '2026-11-10'));
});

test('El motivo de una devolución tiene entre 3 y 500 caracteres', () => {
  assert.ok(validarMotivo(' '));
  assert.equal(validarMotivo('Falta una foto'), null);
  assert.ok(validarMotivo('x'.repeat(501)));
});

test('Reconoce el estado y quién puede aprobar', () => {
  assert.equal(etiquetaEstado('aprobado'), 'Aprobada');
  assert.equal(etiquetaEstado('borrador'), 'Borrador');
  assert.equal(etiquetaEstado(undefined), 'Borrador');
  assert.equal(estaAprobada({ metadatos: { estado: 'aprobado' } }), true);
  assert.equal(puedeAprobar({ role: 'gerencia' }, { metadatos: { jsonEtag: 'v1' } }), true);
  assert.equal(puedeAprobar({ role: 'soporte_ti' }, { metadatos: { jsonEtag: 'v1' } }), false);
  assert.equal(puedeAprobar({ role: 'gerencia' }, { metadatos: {} }), false);
});

test('La fecha de hoy se calcula en hora de Lima', () => {
  assert.equal(hoyLima(new Date('2026-11-10T03:00:00Z')), '2026-11-09');
});
