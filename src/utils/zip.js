const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos) {
  let crc = 0xffffffff;
  for (let i = 0; i < datos.length; i += 1) crc = TABLA_CRC[(crc ^ datos[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function transformar(datos, stream) {
  const salida = new Blob([datos]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}

export async function abrirZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (vista.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo está dañado o no es un documento de Office válido.');

  const total = vista.getUint16(fin + 10, true);
  let pos = vista.getUint32(fin + 16, true);
  const decoder = new TextDecoder();
  const entradas = new Map();

  for (let n = 0; n < total; n += 1) {
    if (vista.getUint32(pos, true) !== 0x02014b50) break;
    const metodo = vista.getUint16(pos + 10, true);
    const tamComprimido = vista.getUint32(pos + 20, true);
    const largoNombre = vista.getUint16(pos + 28, true);
    const largoExtra = vista.getUint16(pos + 30, true);
    const largoComentario = vista.getUint16(pos + 32, true);
    const offsetLocal = vista.getUint32(pos + 42, true);
    const nombre = decoder.decode(bytes.subarray(pos + 46, pos + 46 + largoNombre));
    entradas.set(nombre, { metodo, tamComprimido, offsetLocal });
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }

  async function leerBytes(nombre) {
    const entrada = entradas.get(nombre);
    if (!entrada) return null;
    const { metodo, tamComprimido, offsetLocal } = entrada;
    const inicio = offsetLocal + 30
      + vista.getUint16(offsetLocal + 26, true)
      + vista.getUint16(offsetLocal + 28, true);
    const datos = bytes.subarray(inicio, inicio + tamComprimido);
    if (metodo === 0) return datos.slice();
    if (metodo !== 8) throw new Error(`Compresión no soportada en ${nombre}.`);
    return transformar(datos, new DecompressionStream('deflate-raw'));
  }

  async function leerTexto(nombre) {
    const contenido = await leerBytes(nombre);
    return contenido === null ? null : decoder.decode(contenido);
  }

  return { nombres: [...entradas.keys()], leerBytes, leerTexto };
}

export async function crearZip(archivos) {
  const encoder = new TextEncoder();
  const partes = [];
  const central = [];
  let offset = 0;

  for (const { nombre, datos } of archivos) {
    const nombreBytes = encoder.encode(nombre);
    const original = typeof datos === 'string' ? encoder.encode(datos) : datos;
    const comprimido = await transformar(original, new CompressionStream('deflate-raw'));
    const crc = crc32(original);

    const local = new Uint8Array(30 + nombreBytes.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true);
    vl.setUint16(8, 8, true);
    vl.setUint16(12, 0x21, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, comprimido.length, true);
    vl.setUint32(22, original.length, true);
    vl.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);

    const cabecera = new Uint8Array(46 + nombreBytes.length);
    const vc = new DataView(cabecera.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 8, true);
    vc.setUint16(14, 0x21, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, comprimido.length, true);
    vc.setUint32(24, original.length, true);
    vc.setUint16(28, nombreBytes.length, true);
    vc.setUint32(42, offset, true);
    cabecera.set(nombreBytes, 46);

    partes.push(local, comprimido);
    central.push(cabecera);
    offset += local.length + comprimido.length;
  }

  const tamCentral = central.reduce((suma, c) => suma + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, offset, true);

  const total = new Uint8Array(offset + tamCentral + 22);
  let pos = 0;
  for (const parte of [...partes, ...central, fin]) {
    total.set(parte, pos);
    pos += parte.length;
  }
  return total;
}
