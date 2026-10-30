import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUENTAS, FECHA_BASE, FECHA_META, getCuenta } from './metricasRedes.js';
import {
  audienciaPorRed, avanceHaciaMeta, borradoresParaRevisar, cuentasDeRed, fechasDelEje, haceCuanto,
  resumenPiezas, serieIndice, totales, trayectoriaEsperada, valorActual, valorEn
} from './tablero.js';

const captura = (cuenta, fecha, seguidores) => ({ cuenta, fecha, seguidores });
const pieza = (id, estado, modificada = '2026-11-01T10:00:00Z') => ({ id, fechaModificacion: modificada, metadatos: { estado } });

test('Sin lecturas el valor es el punto de partida; con lecturas toma la última hasta esa fecha', () => {
  const base = getCuenta('facebook').base.seguidores;
  assert.equal(valorActual([], 'facebook'), base);
  const capturas = [captura('facebook', '2026-11-02', base + 10), captura('facebook', '2026-11-05', base + 25)];
  assert.equal(valorEn(capturas, 'facebook', '2026-11-03'), base + 10);
  assert.equal(valorEn(capturas, 'facebook', '2026-11-01'), base);
  assert.equal(valorActual(capturas, 'facebook'), base + 25);
});

test('Una lectura automática del día de partida reemplaza la cifra de partida', () => {
  const base = getCuenta('facebook').base.seguidores;
  assert.equal(valorActual([captura('facebook', FECHA_BASE, base + 4)], 'facebook'), base + 4);
  assert.equal(valorActual([captura('facebook', '2026-10-01', base + 99)], 'facebook'), base);
});

test('Filtra las cuentas por red', () => {
  assert.equal(cuentasDeRed('todas').length, CUENTAS.length);
  assert.deepEqual(cuentasDeRed('linkedin').map((c) => c.id).sort(), ['linkedin-empresa', 'linkedin-perfil']);
});

test('El eje de fechas siempre incluye la partida y la meta, y el periodo recorta las lecturas viejas', () => {
  const capturas = [captura('facebook', '2026-11-02', 7700), captura('facebook', '2026-12-20', 7800)];
  const todo = fechasDelEje(capturas, CUENTAS, 'todo', '2026-12-21');
  assert.deepEqual(todo, [FECHA_BASE, '2026-11-02', '2026-12-20', FECHA_META]);
  const siete = fechasDelEje(capturas, CUENTAS, '7', '2026-12-21');
  assert.deepEqual(siete, [FECHA_BASE, '2026-12-20', FECHA_META]);
});

test('El índice parte en 100, sube con las lecturas y no inventa datos futuros', () => {
  const base = getCuenta('facebook').base.seguidores;
  const facebook = [getCuenta('facebook')];
  const fechas = [FECHA_BASE, '2026-11-02', FECHA_META];
  const serie = serieIndice([captura('facebook', '2026-11-02', Math.round(base * 1.01))], facebook, fechas, '2026-11-03');
  assert.equal(serie[0], 100);
  assert.equal(serie[1], 101);
  assert.equal(serie[2], null);
});

test('La trayectoria esperada va de 100 a la meta de forma pareja', () => {
  const facebook = [getCuenta('facebook')];
  const fechas = [FECHA_BASE, '2026-12-01', FECHA_META];
  const trayectoria = trayectoriaEsperada(facebook, fechas);
  assert.equal(trayectoria[0], 100);
  assert.ok(trayectoria[1] > 100 && trayectoria[1] < trayectoria[2]);
  assert.ok(Math.abs(trayectoria[2] - 101) < 0.1);
});

test('El avance a la meta queda entre 0 y 100', () => {
  assert.equal(avanceHaciaMeta(100, 100, 120), 0);
  assert.equal(avanceHaciaMeta(110, 100, 120), 50);
  assert.equal(avanceHaciaMeta(150, 100, 120), 100);
  assert.equal(avanceHaciaMeta(90, 100, 120), 0);
});

test('Los totales parten sin cambio y suman la diferencia de las lecturas', () => {
  const inicial = totales([], CUENTAS);
  assert.equal(inicial.cambio, 0);
  assert.equal(inicial.avance, 0);
  const facebook = getCuenta('facebook').base.seguidores;
  const con = totales([captura('facebook', '2026-11-02', facebook + 70)], CUENTAS);
  assert.equal(con.cambio, 70);
  assert.ok(con.porcentaje > 0);
});

test('La audiencia junta las dos cuentas de LinkedIn y ordena de mayor a menor', () => {
  const lista = audienciaPorRed([], CUENTAS, { linkedin: { label: 'LinkedIn', color: '#0a66c2' } });
  assert.equal(lista.filter((r) => r.red === 'linkedin').length, 1);
  assert.equal(lista[0].red, 'linkedin');
  assert.ok(lista.every((r, i) => i === 0 || lista[i - 1].valor >= r.valor));
});

test('Cuenta las piezas por estado y lista los borradores más recientes primero', () => {
  const piezas = [pieza('a', 'borrador', '2026-11-01T10:00:00Z'), pieza('b', 'borrador', '2026-11-03T10:00:00Z'), pieza('c', 'aprobado'), pieza('d', 'publicado')];
  assert.deepEqual(resumenPiezas(piezas), { borradores: 2, aprobadas: 1, publicadas: 1 });
  assert.deepEqual(borradoresParaRevisar(piezas).map((p) => p.id), ['b', 'a']);
});

test('Dice hace cuánto fue una lectura', () => {
  const ahora = new Date('2026-11-02T12:00:00Z');
  assert.equal(haceCuanto('2026-11-02T11:59:00Z', ahora), 'hace un momento');
  assert.equal(haceCuanto('2026-11-02T09:00:00Z', ahora), 'hace 3 h');
  assert.equal(haceCuanto('2026-10-31T12:00:00Z', ahora), 'hace 2 días');
});
