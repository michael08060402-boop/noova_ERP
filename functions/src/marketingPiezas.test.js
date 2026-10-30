const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FORMATOS_POR_RED, VARIANTES, validarSolicitudPieza } = require('./marketingPiezas');

test('Acepta TikTok con formato vertical y rechaza otros formatos', () => {
  assert.deepEqual(validarSolicitudPieza({ red: 'tiktok', formato: 'vertical', tema: 'automatico' }).inputs, { red: 'tiktok', formato: 'vertical', tema: 'automatico' });
  assert.ok(validarSolicitudPieza({ red: 'tiktok', formato: 'flyer', tema: 'automatico' }).error);
});

test('Envía la variante al workflow solo cuando se eligió una', () => {
  const base = { red: 'linkedin', formato: 'flyer', tema: 'proyectos' };
  assert.equal(validarSolicitudPieza(base).inputs.variante, undefined);
  assert.equal(validarSolicitudPieza({ ...base, variante: 'automatico' }).inputs.variante, undefined);
  assert.equal(validarSolicitudPieza({ ...base, variante: 'flyer-foto-dato' }).inputs.variante, 'flyer-foto-dato');
});

test('Rechaza un diseño que no existe o que no sirve para la red o el formato', () => {
  const base = { red: 'linkedin', formato: 'flyer', tema: 'proyectos' };
  assert.ok(validarSolicitudPieza({ ...base, variante: 'no-existe' }).error);
  assert.ok(validarSolicitudPieza({ ...base, variante: 'vertical-campo' }).error);
  assert.ok(validarSolicitudPieza({ red: 'facebook', formato: 'publicacion', tema: 'proyectos', variante: 'social-horizontal' }).inputs);
  assert.ok(validarSolicitudPieza({ red: 'instagram', formato: 'publicacion', tema: 'proyectos', variante: 'social-horizontal' }).error);
});

test('Valida fecha, tema y red', () => {
  assert.ok(validarSolicitudPieza({ red: 'linkedin', formato: 'flyer', tema: 'proyectos', fecha: '16/11/2026' }).error);
  assert.ok(validarSolicitudPieza({ red: 'linkedin', formato: 'flyer', tema: 'otro' }).error);
  assert.ok(validarSolicitudPieza({ red: 'youtube', formato: 'flyer', tema: 'proyectos' }).error);
});

test('Cada red tiene al menos un diseño por cada formato que ofrece', () => {
  for (const [red, formatos] of Object.entries(FORMATOS_POR_RED)) {
    for (const formato of formatos) {
      assert.ok(Object.values(VARIANTES).some((v) => v.formato === formato && v.redes.includes(red)), `${red} ${formato}`);
    }
  }
});
