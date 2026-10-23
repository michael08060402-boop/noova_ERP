import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generarFormatoSalida, nombreArchivoSalida } from './excelSalida.js';
import { completarSalida, crearSalida } from './salida.js';
import { abrirZip } from '../../../utils/zip.js';
import { leerHoja, textoDe } from './xlsx.js';

const PLANTILLA = readFileSync(new URL('../assets/formato-salida.xlsx', import.meta.url));
const FIRMA = new Uint8Array(readFileSync(new URL('../../../assets/firmas/gianfranco.jpeg', import.meta.url)));
const FIRMAS = { firmas: [{ nombre: 'Gianfranco Errea Molina', bytes: FIRMA }] };

function salida(items) {
  return crearSalida({
    guia: { serie: 'EG07', numero: '108' },
    formato: {
      correlativo: 6, paquete: '2', lugar: 'Oficina', fechaSalida: '2026-10-22', destino: 'UM <Prueba> & Cía',
      personaAutorizada: 'Luis Hostos', jefeAutoriza: 'Elena Mendoza',
      salida: {
        solicita: { nombre: 'Gianfranco Errea', fecha: '2026-10-22', hora: '13:11' },
        autoriza: { nombre: 'Persona sin firma', fecha: '2026-10-22', hora: '13:15' }
      }
    },
    items
  });
}

function bienes(cantidad) {
  return Array.from({ length: cantidad }, (_, i) => ({ descripcion: `Equipo ${i + 1}`, serie: `S${i + 1}`, cantidad: 1, unidad: 'UND', marca: 'Testo' }));
}

async function abrir(bytes) {
  const zip = await abrirZip(bytes);
  return { zip, texto: (n) => zip.leerTexto(n) };
}

test('genera el formato N° 0006 en una sola hoja con datos, control de salida y firma', async () => {
  const items = bienes(3);
  items[0].contenedor = 'Maleta';
  const { zip, texto } = await abrir(await generarFormatoSalida(PLANTILLA, salida(items), FIRMAS));
  const libro = await texto('xl/workbook.xml');
  assert.deepEqual([...libro.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]), ['N° 0006']);

  const hoja = leerHoja(await texto('xl/worksheets/sheet1.xml'));
  assert.equal(textoDe(hoja, 'L4'), 'N° 0006');
  assert.equal(textoDe(hoja, 'B11'), 'UM &lt;Prueba&gt; &amp; Cía');
  assert.equal(textoDe(hoja, 'E11'), 'Luis Hostos');
  assert.equal(textoDe(hoja, 'I11'), 'Elena Mendoza');
  assert.equal(textoDe(hoja, 'B13'), 'PAQUETE Nº 2');
  assert.equal(textoDe(hoja, 'D43'), 'EG07-00000108');
  assert.equal(textoDe(hoja, 'B16'), 'Equipo 1');
  assert.equal(textoDe(hoja, 'J16'), 'Testo');
  assert.equal(textoDe(hoja, 'L16'), 'Enviado');
  assert.equal(textoDe(hoja, 'F16'), 'Maleta');
  assert.equal(textoDe(hoja, 'F17'), 'Caja');
  assert.equal(textoDe(hoja, 'K16'), 'N/A');
  assert.equal(textoDe(hoja, 'F19'), '');
  assert.ok(['I57:L57', 'I65:L65', 'I66:L66'].every((r) => hoja.combinadas.includes(r)));
  assert.equal(textoDe(hoja, 'B53'), 'Gianfranco Errea');
  assert.equal(textoDe(hoja, 'C56'), '22/10/2026');
  assert.equal(textoDe(hoja, 'I57'), '13:15');
  assert.match(hoja.xml, /<c r="I8" s="156"><v>46317<\/v><\/c>/);

  const dibujo = await texto('xl/drawings/drawing1.xml');
  assert.match(dibujo, /name="Rectángulo 15"[\s\S]*?<a:t>X<\/a:t>/);
  assert.equal((dibujo.match(/name="Firma /g) || []).length, 1);
  assert.ok(zip.nombres.includes('xl/media/firma1.jpeg'));
  assert.match(await texto('[Content_Types].xml'), /Extension="jpeg"/);
});

test('inserta filas cuando los bienes no caben y desplaza pie, firmas y área de impresión', async () => {
  const { texto } = await abrir(await generarFormatoSalida(PLANTILLA, salida(bienes(30)), FIRMAS));
  const hoja = leerHoja(await texto('xl/worksheets/sheet1.xml'));
  assert.equal(textoDe(hoja, 'B45'), 'Equipo 30');
  assert.ok(hoja.combinadas.includes('B45:E45'));
  assert.equal(textoDe(hoja, 'D47'), 'EG07-00000108');
  assert.equal(textoDe(hoja, 'B57'), 'Gianfranco Errea');
  assert.match(await texto('xl/workbook.xml'), /\$A\$1:\$M\$75/);
  assert.match(await texto('xl/drawings/drawing1.xml'), /<xdr:oneCellAnchor><xdr:from><xdr:col>\d+<\/xdr:col><xdr:colOff>\d+<\/xdr:colOff><xdr:row>5[78]<\/xdr:row>/);
});

test('ajusta en varias líneas las descripciones largas sin tocar los demás estilos', async () => {
  const items = bienes(2);
  items[0].descripcion = 'Juego de 3 minipinzas (transductor de corriente para analizador de redes), metrel a1588 con estuche y cables';
  const { texto } = await abrir(await generarFormatoSalida(PLANTILLA, salida(items), FIRMAS));
  const hoja = leerHoja(await texto('xl/worksheets/sheet1.xml'));
  const total = Number(/<cellXfs count="(\d+)"/.exec(await texto('xl/styles.xml'))[1]);
  assert.match(hoja.xml, new RegExp(`<c r="B16" s="${total - 1}" t="inlineStr">`));
  assert.match(hoja.xml, /<row r="16"[^>]*ht="26"/);
  assert.match(hoja.xml, /<c r="B17" s="237"/);
});

test('nombra el archivo con el N° de formato y la guía', () => {
  assert.equal(nombreArchivoSalida(salida([])), 'Formato de salida N° 0006 - EG07-00000108.xlsx');
});

test('guarda el N° de serie como texto, sin perder ceros ni letras, y la caja por defecto', async () => {
  const items = [{ descripcion: 'Equipo', serie: '0012345', cantidad: 1, unidad: 'UND' }, { descripcion: 'Detector', serie: '39BB0002', cantidad: 1, unidad: 'UND' }];
  const { texto } = await abrir(await generarFormatoSalida(PLANTILLA, salida(items), FIRMAS));
  const hoja = leerHoja(await texto('xl/worksheets/sheet1.xml'));
  assert.match(hoja.xml, /<c r="G16" s="\d+" t="inlineStr"><is><t xml:space="preserve">0012345<\/t><\/is><\/c>/);
  assert.equal(textoDe(hoja, 'G17'), '39BB0002');
  assert.equal(textoDe(hoja, 'F16'), 'Caja');
});

test('el estado elegido llega al Excel y un registro antiguo sin estado sale como Enviado', async () => {
  const antiguo = salida([
    { descripcion: 'Equipo A', serie: 'A1', cantidad: 1, unidad: 'UND', estado: '' },
    { descripcion: 'Equipo B', serie: 'B1', cantidad: 1, unidad: 'UND', estado: 'Recibido' }
  ]);
  antiguo.items[0].estado = '';
  const guardado = JSON.parse(JSON.stringify(completarSalida(antiguo)));
  const { texto } = await abrir(await generarFormatoSalida(PLANTILLA, guardado, FIRMAS));
  const hoja = leerHoja(await texto('xl/worksheets/sheet1.xml'));
  assert.equal(textoDe(hoja, 'L16'), 'Enviado');
  assert.equal(textoDe(hoja, 'L17'), 'Recibido');
  assert.equal(textoDe(hoja, 'F16'), 'Caja');
});
