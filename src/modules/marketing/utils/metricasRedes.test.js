import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUENTAS, ESTIMACION_30_DIAS, calcularVariacion, posicionEn, rangoMeta, serieCuenta, totalMetaEsperada, ultimoPunto, metaEsperada, totalBase, totalSeguidores, validarCaptura
} from './metricasRedes.js';

test('Cada cuenta tiene estimación y punto de partida', () => {
  for (const cuenta of CUENTAS) {
    assert.ok(cuenta.base.seguidores > 0, cuenta.id);
    const e = ESTIMACION_30_DIAS[cuenta.id];
    assert.ok(e && e.conservador <= e.esperado && e.esperado <= e.optimista, cuenta.id);
  }
});

test('Calcula la variación absoluta y en porcentaje', () => {
  assert.deepEqual(calcularVariacion(5414, 5308), { absoluta: 106, porcentaje: 2 });
  assert.deepEqual(calcularVariacion(100, 0), { absoluta: 100, porcentaje: 0 });
});

test('La serie empieza en el punto de partida y ordena las capturas por fecha', () => {
  const capturas = [
    { cuenta: 'facebook', fecha: '2026-11-13', seguidores: 7700 },
    { cuenta: 'facebook', fecha: '2026-11-06', seguidores: 7650 },
    { cuenta: 'tiktok', fecha: '2026-11-06', seguidores: 1300 }
  ];
  const serie = serieCuenta(capturas, 'facebook');
  assert.deepEqual(serie.map((p) => p.seguidores), [7600, 7650, 7700]);
  assert.equal(ultimoPunto(capturas, 'facebook').seguidores, 7700);
  assert.equal(ultimoPunto([], 'facebook').seguidores, 7600);
});

test('Meta esperada y totales usan el punto de partida cuando no hay capturas', () => {
  assert.equal(metaEsperada('linkedin-perfil'), 5414);
  assert.equal(totalSeguidores([]), totalBase());
  assert.equal(totalBase(true), 5308 + 3700 + 7600);
});

test('Valida las capturas nuevas', () => {
  assert.equal(validarCaptura({ cuenta: 'facebook', fecha: '2026-11-06', seguidores: 7650 }), null);
  assert.ok(validarCaptura({ cuenta: 'otra', fecha: '2026-11-06', seguidores: 1 }));
  assert.ok(validarCaptura({ cuenta: 'facebook', fecha: '2026-10-30', seguidores: 1 }));
  assert.ok(validarCaptura({ cuenta: 'facebook', fecha: '2026-11-06', seguidores: 12.5 }));
});

test('Arma el rango de metas de una cuenta y ubica un valor en él', () => {
  const rango = rangoMeta('linkedin-perfil');
  assert.deepEqual(rango, { base: 5308, conservador: 5350, esperado: 5414, optimista: 5520 });
  assert.equal(posicionEn(5308, rango.base, rango.optimista), 0);
  assert.equal(Math.round(posicionEn(rango.esperado, rango.base, rango.optimista)), 50);
  assert.equal(posicionEn(9999, rango.base, rango.optimista), 100);
  assert.equal(posicionEn(1, 5, 5), 0);
});

test('La meta esperada total suma las metas de cada cuenta', () => {
  assert.equal(totalMetaEsperada(), CUENTAS.reduce((suma, cuenta) => suma + metaEsperada(cuenta.id), 0));
  assert.ok(totalMetaEsperada(true) < totalMetaEsperada());
});
