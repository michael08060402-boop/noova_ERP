import {
  crearItemSolicitud,
  detectarEncabezado,
  interpretarFilasSolicitud,
  interpretarTextoSolicitud,
  normalizarUnidad
} from './solicitudCotizacion';
import { abrirZip } from './zip';

function extension(nombre) {
  return String(nombre || '').toLowerCase().split('.').pop();
}

function parsearXml(texto) {
  return new DOMParser().parseFromString(texto, 'application/xml');
}

function hijos(nodo, nombreLocal) {
  return Array.from(nodo.getElementsByTagNameNS('*', nombreLocal));
}

function columnaDesdeRef(ref) {
  const letras = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase();
  let col = 0;
  for (const letra of letras) col = col * 26 + (letra.charCodeAt(0) - 64);
  return col - 1;
}

async function leerExcel(buffer) {
  const { leerTexto: leer } = await abrirZip(buffer);
  const compartidosXml = await leer('xl/sharedStrings.xml');
  const compartidos = compartidosXml
    ? hijos(parsearXml(compartidosXml), 'si').map((si) => hijos(si, 't').map((t) => t.textContent).join(''))
    : [];

  const libro = parsearXml((await leer('xl/workbook.xml')) || '<x/>');
  const relaciones = parsearXml((await leer('xl/_rels/workbook.xml.rels')) || '<x/>');
  const destinos = new Map(hijos(relaciones, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const rutas = hijos(libro, 'sheet')
    .map((hoja) => destinos.get(hoja.getAttribute('r:id')))
    .filter(Boolean)
    .map((destino) => (destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`));
  if (!rutas.length) rutas.push('xl/worksheets/sheet1.xml');

  for (const ruta of rutas) {
    const hojaXml = await leer(ruta);
    if (!hojaXml) continue;
    const filas = hijos(parsearXml(hojaXml), 'row').map((row) => {
      const fila = [];
      hijos(row, 'c').forEach((c) => {
        const tipo = c.getAttribute('t');
        const v = hijos(c, 'v')[0]?.textContent ?? '';
        let valor;
        if (tipo === 's') valor = compartidos[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = hijos(c, 't').map((t) => t.textContent).join('');
        else if (tipo === 'b') valor = v === '1' ? 'VERDADERO' : 'FALSO';
        else valor = v;
        fila[columnaDesdeRef(c.getAttribute('r'))] = valor;
      });
      return Array.from(fila, (x) => x ?? '');
    });
    if (filas.some((f) => f.some((c) => String(c).trim()))) return { filas };
  }
  return { filas: [] };
}

async function leerWord(buffer) {
  const { leerTexto: leer } = await abrirZip(buffer);
  const xml = await leer('word/document.xml');
  if (!xml) throw new Error('No se encontró el contenido del documento Word.');
  const cuerpo = hijos(parsearXml(xml), 'body')[0];
  if (!cuerpo) return { texto: '' };

  const textoParrafo = (p) => hijos(p, 't').map((t) => t.textContent).join('').trim();
  const lineas = [];
  const tablas = [];

  Array.from(cuerpo.children).forEach((nodo) => {
    if (nodo.localName === 'tbl') {
      tablas.push(hijos(nodo, 'tr').map((tr) =>
        hijos(tr, 'tc').map((tc) => hijos(tc, 'p').map(textoParrafo).filter(Boolean).join(' '))
      ));
    } else if (nodo.localName === 'p') {
      const texto = textoParrafo(nodo);
      if (!texto) return;
      const nivel = Number(hijos(nodo, 'ilvl')[0]?.getAttribute('w:val')) || 0;
      lineas.push(`${'    '.repeat(nivel)}${texto}`);
    }
  });

  return { texto: lineas.join('\n'), tablas };
}

async function leerPdf(buffer) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const paginas = [];

  for (let n = 1; n <= pdf.numPages; n += 1) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();

    const renglones = [];
    items
      .filter((it) => it.str && it.str.trim())
      .forEach((it) => {
        const [, , , , x, y] = it.transform;
        let renglon = renglones.find((r) => Math.abs(r.y - y) < 2.5);
        if (!renglon) {
          renglon = { y, partes: [] };
          renglones.push(renglon);
        }
        renglon.partes.push({ x, fin: x + (it.width || 0), texto: it.str });
      });

    paginas.push(renglones
      .sort((a, b) => b.y - a.y)
      .map(({ y, partes }) => {
        partes.sort((a, b) => a.x - b.x);
        const celdas = [];
        partes.forEach((p) => {
          const ultima = celdas[celdas.length - 1];
          if (!ultima || p.x - ultima.fin > 12) {
            celdas.push({ ...p });
          } else {
            ultima.texto += (p.x - ultima.fin > 1 ? ' ' : '') + p.texto;
            ultima.fin = p.fin;
          }
        });
        return { y, celdas: celdas.map((c) => ({ ...c, texto: c.texto.trim() })) };
      }));
  }

  if (!paginas.some((p) => p.length)) {
    throw new Error('El PDF no contiene texto seleccionable (posiblemente es un escaneo). Copie el texto o use Excel/Word.');
  }
  return paginas;
}

const RE_FIN_TABLA = /^(sub\s?total|total|condiciones|observaciones|notas?|importante|son:)/i;

function interpretarTablaPdf(paginas, unidadPorDefecto) {
  const filasPrincipales = [];
  const sueltos = [];
  let encabezado = null;

  paginas.forEach((renglones, pagina) => {
    const textos = renglones.map((r) => r.celdas.map((c) => c.texto));
    const enc = detectarEncabezado(textos, textos.length);
    if (!enc) return;
    if (!encabezado || textos[enc.fila].length >= encabezado.columnas) {
      encabezado = { ...enc, columnas: textos[enc.fila].length };
    }

    let yAnterior = renglones[enc.fila].y;
    for (let i = enc.fila + 1; i < renglones.length; i += 1) {
      const { y, celdas } = renglones[i];
      const primerTexto = celdas[0]?.texto || '';
      if (yAnterior - y > 40 || RE_FIN_TABLA.test(primerTexto)) break;
      yAnterior = y;
      if (esEncabezadoRepetido(celdas, textos[enc.fila])) continue;

      const tieneCantidad = celdas.slice(1).some((c) => /^\d+(?:[.,]\d+)?$/.test(c.texto));
      if (celdas.length >= 2 && tieneCantidad) filasPrincipales.push({ pagina, y, celdas });
      else sueltos.push({ pagina, y, celdas });
    }
  });

  if (!encabezado || !filasPrincipales.length) return null;

  sueltos.forEach((s) => {
    const cercana = filasPrincipales
      .filter((f) => f.pagina === s.pagina)
      .sort((a, b) => Math.abs(a.y - s.y) - Math.abs(b.y - s.y))[0];
    if (cercana) (cercana.extra ||= []).push(s);
  });

  const { mapa, columnas } = encabezado;
  const items = filasPrincipales.map((fila) => {
    const textos = fila.celdas.map((c) => c.texto);
    const celda = (campo) => (mapa[campo] !== undefined ? textos[mapa[campo]] || '' : '');
    const cantidad = Number(celda('cantidad').replace(',', '.'));
    let base;
    if (textos.length === columnas) {
      base = crearItemSolicitud({
        codigo: celda('codigo'),
        descripcion: celda('descripcion'),
        cantidad: cantidad > 0 ? cantidad : 1,
        unidadMedida: normalizarUnidad(celda('unidad'), unidadPorDefecto)
      }, unidadPorDefecto);
    } else {
      const numeros = textos.map((t, i) => ({ i, n: Number(t.replace(',', '.')) }))
        .filter(({ i, n }) => i > 0 && n > 0 && /^\d+(?:[.,]\d+)?$/.test(textos[i]));
      const iUnidad = textos.findIndex((t, i) => i > 0 && normalizarUnidad(t, '') !== '' && !/\d/.test(t));
      const iCodigo = mapa.codigo === undefined ? -1 : textos.findIndex((t, i) =>
        i > 0 && i !== iUnidad && /^(?=.*\d)(?=.*[a-z])[a-z0-9][\w.\-/]{1,24}$/i.test(t));
      const descripcion = textos
        .filter((t, i) => i !== iUnidad && i !== iCodigo && !/^\d+(?:[.,]\d+)?$/.test(t))
        .sort((a, b) => b.length - a.length)[0] || '';
      base = crearItemSolicitud({
        codigo: iCodigo >= 0 ? textos[iCodigo] : '',
        descripcion,
        cantidad: numeros.length ? numeros[numeros.length - 1].n : 1,
        unidadMedida: iUnidad >= 0 ? normalizarUnidad(textos[iUnidad], unidadPorDefecto) : unidadPorDefecto
      }, unidadPorDefecto);
    }

    const lineasDescripcion = [
      ...(fila.extra || []).map((s) => ({ y: s.y, texto: s.celdas.map((c) => c.texto).join(' ') })),
      { y: fila.y, texto: base.descripcion }
    ]
      .sort((a, b) => b.y - a.y)
      .map((l) => l.texto.trim())
      .filter(Boolean);
    if (!lineasDescripcion.length) return null;

    return {
      ...base,
      descripcion: lineasDescripcion[0],
      especificaciones: [lineasDescripcion.slice(1).join('\n'), base.especificaciones].filter(Boolean).join('\n')
    };
  }).filter(Boolean);

  return items.length ? { items, datos: {} } : null;
}

function esEncabezadoRepetido(celdas, encabezado) {
  return celdas.length === encabezado.length && celdas.every((c, i) => c.texto === encabezado[i]);
}

function parsearCsv(texto) {
  const primera = texto.split(/\r?\n/)[0] || '';
  const separador = [';', '\t', ','].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { celda += '"'; i += 1; }
      else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === separador) { fila.push(celda); celda = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i += 1;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += ch;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

function mejorResultado(...resultados) {
  return resultados
    .filter(Boolean)
    .sort((a, b) => b.items.length - a.items.length)[0] || { items: [], datos: {} };
}

export async function leerArchivoSolicitud(file, unidadPorDefecto = 'UNIDAD') {
  const ext = extension(file?.name);
  if (!file) throw new Error('No se seleccionó ningún archivo.');
  if (file.size > 15 * 1024 * 1024) throw new Error('El archivo supera los 15 MB.');

  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif', 'bmp'].includes(ext)) {
    throw new Error('Las imágenes no se pueden leer automáticamente. Copie el texto con "Pegar texto" o use un Excel, Word o PDF.');
  }

  if (ext === 'txt') {
    return interpretarTextoSolicitud(await file.text(), unidadPorDefecto);
  }

  if (ext === 'csv') {
    return interpretarFilasSolicitud(parsearCsv(await file.text()), unidadPorDefecto);
  }

  const buffer = await file.arrayBuffer();

  if (ext === 'xlsx') {
    const { filas } = await leerExcel(buffer);
    return interpretarFilasSolicitud(filas, unidadPorDefecto);
  }

  if (ext === 'docx') {
    const { texto, tablas } = await leerWord(buffer);
    const desdeTexto = interpretarTextoSolicitud(texto, unidadPorDefecto, { documento: true });
    const desdeTablas = tablas
      .map((t) => interpretarFilasSolicitud(t, unidadPorDefecto))
      .filter((r) => r.conEncabezado);
    const mejor = mejorResultado(...desdeTablas, desdeTexto);
    return { items: mejor.items, datos: { ...desdeTexto.datos, ...mejor.datos } };
  }

  if (ext === 'pdf') {
    const paginas = await leerPdf(buffer);
    const texto = paginas.flat().map((r) => r.celdas.map((c) => c.texto).join('  ')).join('\n');
    const desdeTexto = interpretarTextoSolicitud(texto, unidadPorDefecto, { documento: true });
    const desdeTabla = interpretarTablaPdf(paginas, unidadPorDefecto);
    const mejor = desdeTabla || desdeTexto;
    return { items: mejor.items, datos: { ...desdeTexto.datos, ...mejor.datos } };
  }

  if (ext === 'xls' || ext === 'doc') {
    throw new Error(`El formato .${ext} es antiguo. Guarde el archivo como .${ext}x e inténtelo de nuevo.`);
  }

  throw new Error('Formato no admitido. Use Excel (.xlsx), Word (.docx), PDF, CSV o TXT.');
}
