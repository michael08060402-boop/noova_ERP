import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarHashtags, combinarTextoPost } from './textoPost.js';

test('Separa los hashtags finales conservando las menciones dentro del texto', () => {
  assert.deepEqual(separarHashtags('Nuestro #estudio.\n\n#Ventilación #Minería'), {
    texto: 'Nuestro #estudio.', hashtags: '#Ventilación #Minería'
  });
});

test('Normaliza y evita hashtags duplicados', () => {
  assert.equal(combinarTextoPost(' Texto del post ', 'Minería, #Ventilación #Minería'), 'Texto del post\n\n#Minería #Ventilación');
});

test('Rechaza hashtags con puntuación y textos vacíos', () => {
  assert.throws(() => combinarTextoPost('Post', '#Minería!'));
  assert.throws(() => combinarTextoPost(' ', ' '));
});
