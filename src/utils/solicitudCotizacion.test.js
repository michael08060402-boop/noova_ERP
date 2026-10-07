import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretarLinea,
  interpretarTextoSolicitud,
  interpretarFilasSolicitud,
  normalizarUnidad
} from './solicitudCotizacion.js';

test('detecta cantidad al inicio, al final con "x" y con unidad', () => {
  assert.deepEqual(interpretarLinea('3 camionetas 4x4 doble cabina'), {
    descripcion: 'Camionetas 4x4 doble cabina', cantidad: 3, unidadMedida: 'UNIDAD'
  });
  assert.deepEqual(interpretarLinea('- Casco de seguridad x 20'), {
    descripcion: 'Casco de seguridad', cantidad: 20, unidadMedida: 'UNIDAD'
  });
  assert.deepEqual(interpretarLinea('Guantes de nitrilo - 50 pares'), {
    descripcion: 'Guantes de nitrilo', cantidad: 50, unidadMedida: 'PAR'
  });
  assert.deepEqual(interpretarLinea('Camioneta 4x4 doble cabina (2 unidades)'), {
    descripcion: 'Camioneta 4x4 doble cabina', cantidad: 2, unidadMedida: 'UNIDAD'
  });
});

test('no confunde números de la descripción con la cantidad', () => {
  assert.deepEqual(interpretarLinea('Camioneta 4x4 modelo 2023'), {
    descripcion: 'Camioneta 4x4 modelo 2023', cantidad: 1, unidadMedida: 'UNIDAD'
  });
  assert.equal(interpretarLinea('Alquiler de camioneta por 30 días').cantidad, 1);
  assert.equal(interpretarLinea('Descripción   Cantidad   Unidad'), null);
});

test('texto libre: ítems, especificaciones con sangría y datos generales', () => {
  const { items, datos } = interpretarTextoSolicitud([
    'Asunto: Alquiler de camionetas para transporte de personal',
    'Lugar de entrega: Unidad minera Cerro Verde',
    '1. 2 camionetas 4x4 doble cabina',
    '    - Año 2022 o superior',
    '    - Con conductor y SOAT',
    '2. Minibús 15 pasajeros x 1'
  ].join('\n'));

  assert.equal(datos.asunto, 'Alquiler de camionetas para transporte de personal');
  assert.equal(datos.lugarEntrega, 'Unidad minera Cerro Verde');
  assert.equal(items.length, 2);
  assert.equal(items[0].cantidad, 2);
  assert.equal(items[0].especificaciones, 'Año 2022 o superior\nCon conductor y SOAT');
  assert.equal(items[1].descripcion, 'Minibús 15 pasajeros');
});

test('la sangría común del texto pegado no se toma como detalle', () => {
  const { items } = interpretarTextoSolicitud('   Casco x 10\n   Lentes x 5');
  assert.equal(items.length, 2);
});

test('tabla con encabezado reconocido', () => {
  const { items } = interpretarFilasSolicitud([
    ['SOLICITUD DE MATERIALES'],
    ['N°', 'Código', 'Descripción', 'Cant.', 'Und.', 'Observaciones'],
    ['1', 'C-01', 'Cable 3x12 AWG', '200', 'metros', 'Rollo de 100 m'],
    ['2', '', 'Cinta aislante', '10', 'und', ''],
    ['', '', 'TOTAL', '', '', '']
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(
    [items[0].codigo, items[0].descripcion, items[0].cantidad, items[0].unidadMedida, items[0].especificaciones],
    ['C-01', 'Cable 3x12 AWG', 200, 'M.', 'Rollo de 100 m']
  );
});

test('tabla sin encabezado ignora el N° de ítem como cantidad', () => {
  const { items } = interpretarFilasSolicitud([['1', 'Camioneta 4x4', '3', 'unidades']]);
  assert.equal(items[0].cantidad, 3);
  assert.equal(items[0].descripcion, 'Camioneta 4x4');
});

test('unidades', () => {
  assert.equal(normalizarUnidad('Días'), 'DÍA');
  assert.equal(normalizarUnidad('lts'), 'LT.');
  assert.equal(normalizarUnidad('xyz'), 'UNIDAD');
});

test('"Ítem" es el N° correlativo cuando hay columna Descripción', () => {
  const { items } = interpretarFilasSolicitud([
    ['Ítem', 'Descripción', 'Cantidad', 'Unidad'],
    ['1', 'Camioneta 4x4 doble cabina', '3', 'und']
  ]);
  assert.equal(items[0].descripcion, 'Camioneta 4x4 doble cabina');
  assert.equal(items[0].cantidad, 3);
});

test('una fila de datos no se confunde con un encabezado', () => {
  const { items, conEncabezado } = interpretarFilasSolicitud([['03', 'Producto de prueba número 3', 'UNIDAD', '4']]);
  assert.equal(conEncabezado, undefined);
  assert.equal(items[0].descripcion, 'Producto de prueba número 3');
  assert.equal(items[0].cantidad, 4);
});

test('en documentos se descartan membrete y paginación', () => {
  const { items, datos } = interpretarTextoSolicitud([
    'RUC: 20550622930',
    'Fecha de Emisión: 06/10/2026',
    'Asunto: Compra de cable',
    'Cable 3x12 AWG - 200 metros',
    'Página 1 de 1'
  ].join('\n'), 'UNIDAD', { documento: true });
  assert.equal(datos.asunto, 'Compra de cable');
  assert.deepEqual(items.map((i) => [i.descripcion, i.cantidad, i.unidadMedida]), [['Cable 3x12 AWG', 200, 'M.']]);
});
