import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATOS_POR_RED, disenosPara, getDiseno, moverDiseno, otroDiseno } from './disenos.js';

test('Cada red ofrece diseños para todos sus formatos', () => {
  for (const [red, formatos] of Object.entries(FORMATOS_POR_RED)) {
    for (const formato of formatos) assert.ok(disenosPara(red, formato).length > 0, `${red} ${formato}`);
  }
});

test('TikTok solo ofrece diseños verticales y LinkedIn no ofrece verticales', () => {
  assert.ok(disenosPara('tiktok', 'vertical').every((d) => d.formato === 'vertical'));
  assert.equal(disenosPara('linkedin', 'vertical').length, 0);
  assert.ok(!disenosPara('instagram', 'publicacion').some((d) => d.id === 'social-horizontal'));
});

test('Recorre los diseños en círculo', () => {
  const lista = disenosPara('instagram', 'vertical');
  assert.equal(lista.length, 3);
  assert.equal(moverDiseno(lista, lista[2].id, 1), lista[0].id);
  assert.equal(moverDiseno(lista, lista[0].id, -1), lista[2].id);
  assert.equal(moverDiseno(lista, 'automatico', 1), lista[0].id);
  assert.equal(moverDiseno([], 'automatico', 1), 'automatico');
});

test('Otro boceto elige un diseño distinto al usado', () => {
  const lista = disenosPara('linkedin', 'flyer');
  assert.notEqual(otroDiseno(lista, lista[0].id), lista[0].id);
  assert.equal(otroDiseno(lista.slice(0, 1), lista[0].id), lista[0].id);
  assert.equal(getDiseno('flyer-dato').nombre, 'Dato tipográfico');
});
