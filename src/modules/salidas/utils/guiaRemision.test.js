import test from 'node:test';
import assert from 'node:assert/strict';
import {
  datosDesdeNombreArchivo,
  extraerSeries,
  interpretarGuiaRemision,
  normalizarUnidadGuia
} from './guiaRemision.js';

function linea(y, ...celdas) {
  return celdas.map(([x, str]) => ({ x, y, str }));
}

const GUIA = [
  ...linea(1115, [138, 'EMPRESA DE PRUEBA']),
  ...linea(1112, [597, 'RUC N°20999999991']),
  ...linea(1098, [554, 'GUÍA DE REMISIÓN ELECTRÓNICA']),
  ...linea(1097, [138, 'SOCIEDAD ANONIMA CERRADA']),
  ...linea(1084, [620, 'REMITENTE']),
  ...linea(1070, [599, 'N° T001 - 00000042']),
  ...linea(1007, [138, 'Fecha y hora de emisión : '], [262, '05/03/2026 03:20 PM']),
  ...linea(972, [382, 'Punto de Partida'], [469, 'AV. PRUEBA 123 URB.']),
  ...linea(960, [469, 'CENTRO - LIMA']),
  ...linea(949, [14, 'Fecha de inicio de Traslado : '], [152, '06/03/2026']),
  ...linea(948, [469, '- LIMA']),
  ...linea(924, [14, 'Motivo de Traslado : '], [112, 'OTROS']),
  ...linea(910, [382, 'Punto de llegada'], [469, 'CAMPAMENTO MINERO KM 5']),
  ...linea(898, [469, 'AREQUIPA']),
  ...linea(885, [14, 'Descripción de Motivo : '], [127, 'TRASLADO A PROYECTO']),
  ...linea(839, [14, 'Datos del Destinatario : '], [126, 'MINERA EJEMPLO S.A. - REGISTRO ÚNICO DE CONTRIBUYENTES N° 20888888881']),
  ...linea(818, [14, 'Bienes por transportar:']),
  ...linea(787, [59, 'Bien']),
  ...linea(786, [178, 'Código']),
  ...linea(781, [109, 'Código de'], [247, 'Partida'], [312, 'Código'], [656, 'Unidad de']),
  ...linea(776, [17, 'N°'], [42, 'normalizado'], [174, 'producto'], [454, 'Descripción Detallada'], [727, 'Cantidad']),
  ...linea(771, [239, 'arancelaria']),
  ...linea(770, [121, 'Bien'], [316, 'GTIN'], [663, 'medida']),
  ...linea(765, [177, 'SUNAT']),
  ...linea(754, [21, '1'], [64, 'NO'], [109, 'EQ-01'], [358, 'Multímetro digital NS 11112222'], [656, 'UNIDAD (NIU)'], [771, '1.00']),
  ...linea(740, [21, '2'], [64, 'NO'], [358, 'Pinza amperimétrica Marca ACME NS: AB1234, AB1235'], [656, 'UNIDAD (NIU)'], [771, '2.00']),
  ...linea(726, [21, '3'], [64, 'NO'], [358, 'Juego de puntas de prueba con estuche y'], [667, 'JUEGO'], [771, '1.00']),
  ...linea(717, [358, 'cables // 98765432']),
  ...linea(703, [21, '4'], [64, 'NO'], [358, 'Analizador de energía NS 5550001'], [656, 'UNIDAD (NIU)'], [771, '3.00']),
  ...linea(689, [21, '5'], [64, 'NO'], [358, 'GUANTES DE NITRILO'], [672, 'PAR'], [767, '20.00']),
  ...linea(491, [14, 'Unidad de Medida del Peso Bruto:'], [171, 'KGM']),
  ...linea(466, [14, 'Peso Bruto total de la carga:'], [143, '12']),
  ...linea(416, [14, 'Modalidad de Traslado:'], [119, 'Privado'])
];

test('lee los datos generales de una guía SUNAT sin confundir serie de guía con series de equipos', () => {
  const r = interpretarGuiaRemision([GUIA], '20999999991-09-T001-42.pdf');
  assert.equal(r.guia.tipo, '09');
  assert.equal(r.guia.serie, 'T001');
  assert.equal(r.guia.numero, '42');
  assert.equal(r.guia.remitenteRuc, '20999999991');
  assert.equal(r.guia.remitenteNombre, 'EMPRESA DE PRUEBA SOCIEDAD ANONIMA CERRADA');
  assert.equal(r.guia.fechaEmision, '2026-03-05');
  assert.equal(r.guia.horaEmision, '15:20');
  assert.equal(r.guia.fechaTraslado, '2026-03-06');
  assert.equal(r.guia.motivoTraslado, 'OTROS');
  assert.equal(r.guia.descripcionMotivo, 'TRASLADO A PROYECTO');
  assert.equal(r.guia.puntoPartida, 'AV. PRUEBA 123 URB. CENTRO - LIMA - LIMA');
  assert.equal(r.guia.puntoLlegada, 'CAMPAMENTO MINERO KM 5 AREQUIPA');
  assert.equal(r.guia.destinatarioNombre, 'MINERA EJEMPLO S.A.');
  assert.equal(r.guia.destinatarioDocumento, '20888888881');
  assert.equal(r.guia.pesoBruto, '12');
  assert.equal(r.guia.unidadPeso, 'KGM');
  assert.equal(r.guia.modalidad, 'Privado');
  assert.equal(r.items.length, 7);
  assert.ok(r.items.every((i) => i.serie !== 'T001' && i.serie !== '00000042'));
});

test('separa una fila por cada serie y saca la marca de la descripción', () => {
  const { items } = interpretarGuiaRemision([GUIA]);
  const pinzas = items.filter((i) => i.descripcion === 'Pinza amperimétrica');
  assert.deepEqual(pinzas.map((i) => i.serie), ['AB1234', 'AB1235']);
  assert.ok(pinzas.every((i) => i.cantidad === 1 && i.marca === 'ACME'));
  assert.ok(items.every((i) => i.origen === 'pdf' && i.estado === 'Enviado'));
});

test('no inventa series: las unidades sin serie quedan en otra fila con su cantidad', () => {
  const { items } = interpretarGuiaRemision([GUIA]);
  const analizador = items.filter((i) => i.descripcion === 'Analizador de energía');
  assert.deepEqual(analizador.map((i) => [i.serie, i.cantidad]), [['5550001', 1], ['', 2]]);
});

test('une descripciones de varias líneas y conserva la unidad de la guía', () => {
  const { items } = interpretarGuiaRemision([GUIA]);
  const juego = items.find((i) => i.unidad === 'JUEGO');
  assert.equal(juego.descripcion, 'Juego de puntas de prueba con estuche y cables // 98765432');
  assert.equal(juego.serie, '');
  const guantes = items.find((i) => i.descripcion === 'GUANTES DE NITRILO');
  assert.equal(guantes.cantidad, 20);
  assert.equal(guantes.unidad, 'PAR');
});

test('usa el nombre del archivo SUNAT solo si el PDF no trae el número de guía', () => {
  assert.equal(interpretarGuiaRemision([GUIA], '20999999991-09-T001-43.pdf').guia.numero, '42');
  const sinNumero = GUIA.filter((i) => !i.str.startsWith('N° T001'));
  assert.equal(interpretarGuiaRemision([sinNumero], '20999999991-09-T001-43.pdf').guia.numero, '43');
  assert.deepEqual(datosDesdeNombreArchivo('20550622930-09-EG07-108.pdf'), { ruc: '20550622930', tipo: '09', serie: 'EG07', numero: '108' });
  assert.equal(datosDesdeNombreArchivo('guia.pdf'), null);
});

test('si no hay tabla de bienes no inventa filas', () => {
  const r = interpretarGuiaRemision([GUIA.filter((i) => i.y > 800)]);
  assert.equal(r.items.length, 0);
});

test('extrae series con distintos marcadores y conserva textos sin series', () => {
  assert.deepEqual(extraerSeries('Testo 425 NS 85952305').series, ['85952305']);
  assert.deepEqual(extraerSeries('Equipo S/N: XK-9981').series, ['XK-9981']);
  assert.deepEqual(extraerSeries('Medidor N° de serie 4455667').series, ['4455667']);
  assert.deepEqual(extraerSeries('SENSOR DE APROXIMIDAD IMPORTADO').series, []);
  assert.equal(extraerSeries('GUANTE EXAMEN M.').descripcion, 'GUANTE EXAMEN M.');
  assert.equal(extraerSeries('Kit NS 123456 con maletín').descripcion, 'Kit con maletín');
});

test('reconoce la marca escrita en la descripción', () => {
  assert.equal(extraerSeries('Testo 425 NS 85952305').marca, 'Testo');
  assert.equal(extraerSeries('Analizador de redes METREL MI2892').marca, 'Metrel');
  assert.equal(extraerSeries('Pinza Marca FLUKE /UNI-T NS: 71513153MV').marca, 'FLUKE /UNI-T');
  assert.equal(extraerSeries('MAMELUCO TERMICO').marca, '');
});

test('normaliza solo las unidades SUNAT conocidas', () => {
  assert.equal(normalizarUnidadGuia('UNIDAD (NIU)'), 'UND');
  assert.equal(normalizarUnidadGuia('KILOGRAMO (KGM)'), 'KG');
  assert.equal(normalizarUnidadGuia('PAQUETE'), 'PAQUETE');
  assert.equal(normalizarUnidadGuia('BOLSA (BG)'), 'BOLSA');
});
