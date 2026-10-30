import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_VERSION_BYTES, extensionDe, porcentaje, puedeUsarTaller, trozos, validarArchivoVersion } from './archivosVersion.js';

const archivo = (name, size = 1000) => ({ name, size });

test('La versión debe tener la misma extensión que el archivo actual', () => {
  assert.equal(validarArchivoVersion(archivo('editado.PNG'), 'flyer.png'), null);
  assert.equal(validarArchivoVersion(archivo('editado.jpeg'), 'flyer.jpg'), null);
  assert.ok(validarArchivoVersion(archivo('editado.jpg'), 'flyer.png'));
  assert.ok(validarArchivoVersion(archivo('video.mp4'), 'flyer.png'));
});

test('Rechaza archivos vacíos, demasiado grandes o ausentes', () => {
  assert.ok(validarArchivoVersion(archivo('a.png', 0), 'flyer.png'));
  assert.ok(validarArchivoVersion(archivo('a.png', LIMITE_VERSION_BYTES + 1), 'flyer.png'));
  assert.ok(validarArchivoVersion(null, 'flyer.png'));
});

test('Divide el archivo en trozos que cubren todos los bytes sin solaparse', () => {
  const rangos = trozos(10, 4);
  assert.deepEqual(rangos, [{ inicio: 0, fin: 3 }, { inicio: 4, fin: 7 }, { inicio: 8, fin: 9 }]);
  assert.deepEqual(trozos(4, 4), [{ inicio: 0, fin: 3 }]);
  assert.deepEqual(trozos(0, 4), []);
});

test('Calcula el avance y quién puede usar el taller', () => {
  assert.equal(porcentaje(50, 200), 25);
  assert.equal(porcentaje(300, 200), 100);
  assert.equal(extensionDe('Flyer.JPEG'), 'jpg');
  assert.equal(puedeUsarTaller({ role: 'soporte_ti' }, { metadatos: { jsonEtag: 'v1' } }), true);
  assert.equal(puedeUsarTaller({ role: 'jefe_proyecto_mina' }, { metadatos: { jsonEtag: 'v1' } }), false);
});
