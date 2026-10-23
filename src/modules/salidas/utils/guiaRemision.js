import { crearItemSalida } from './salida.js';

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim();
}

function unir(items) {
  return items.map((i) => i.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function agruparLineas(items, tolerancia = 2) {
  const ordenados = items
    .filter((i) => String(i.str || '').trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lineas = [];
  for (const item of ordenados) {
    const ultima = lineas[lineas.length - 1];
    if (ultima && Math.abs(ultima.y - item.y) <= tolerancia) ultima.items.push(item);
    else lineas.push({ y: item.y, items: [item] });
  }
  for (const linea of lineas) linea.items.sort((a, b) => a.x - b.x);
  return lineas;
}

function buscarEtiqueta(lineas, patron) {
  for (let l = 0; l < lineas.length; l += 1) {
    const i = lineas[l].items.findIndex((item) => patron.test(normalizar(item.str)));
    if (i >= 0) return { linea: l, indice: i, item: lineas[l].items[i] };
  }
  return null;
}

function valorEnLinea(lineas, patron, { xMax = Infinity } = {}) {
  const encontrado = buscarEtiqueta(lineas, patron);
  if (!encontrado) return null;
  const { linea, item } = encontrado;
  const enEtiqueta = /:\s*(.+)$/.exec(item.str)?.[1]?.trim();
  const resto = lineas[linea].items.filter((i) => i.x > item.x && i.x < xMax);
  return [enEtiqueta, unir(resto)].filter(Boolean).join(' ').trim() || null;
}

function valorMultilinea(lineas, patron) {
  const encontrado = buscarEtiqueta(lineas, patron);
  if (!encontrado) return null;
  const { linea, item } = encontrado;
  const primeros = lineas[linea].items.filter((i) => i.x > item.x);
  if (!primeros.length) return null;
  const xValor = primeros[0].x;
  const partes = [unir(primeros)];
  let yAnterior = lineas[linea].y;
  for (let l = linea + 1; l < lineas.length; l += 1) {
    if (yAnterior - lineas[l].y > 16) break;
    const enColumna = lineas[l].items.filter((i) => Math.abs(i.x - xValor) <= 6);
    if (!enColumna.length) break;
    if (lineas[l].items.some((i) => i.x > item.x - 6 && i.x < xValor - 6)) break;
    partes.push(unir(lineas[l].items.filter((i) => i.x >= xValor - 6)));
    yAnterior = lineas[l].y;
  }
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

function fechaIso(texto) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texto || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function hora24(texto) {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]\.?\s?M\.?)?/i.exec(texto || '');
  if (!m) return '';
  let h = Number(m[1]);
  const sufijo = (m[3] || '').replace(/[.\s]/g, '').toUpperCase();
  if (sufijo === 'PM' && h < 12) h += 12;
  if (sufijo === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function datosDesdeNombreArchivo(nombre) {
  const m = /(\d{11})-(\d{2})-([A-Z0-9]{4})-(\d{1,8})/i.exec(String(nombre || ''));
  return m ? { ruc: m[1], tipo: m[2], serie: m[3].toUpperCase(), numero: m[4] } : null;
}

const UNIDADES_SUNAT = { NIU: 'UND', KGM: 'KG', MTR: 'M', LTR: 'L' };

export function normalizarUnidadGuia(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const codigo = /\(([A-Z0-9]{2,3})\)\s*$/.exec(limpio)?.[1];
  if (codigo && UNIDADES_SUNAT[codigo]) return UNIDADES_SUNAT[codigo];
  return limpio.replace(/\s*\([A-Z0-9]{2,3}\)\s*$/, '');
}

const MARCADOR_SERIE = /(?:^|[\s,;(])(?:N\.?\s?S\.?|S\/N|N\/S|SN|N[°º]?\s*(?:DE\s+)?SERIES?|NRO\.?\s*(?:DE\s+)?SERIES?|SERIES?)\s*[:.#]?\s*(?=[A-Z0-9])/i;
const TOKEN_SERIE = /^(?=.*\d)[A-Z0-9][A-Z0-9-]{2,29}$/i;

const MARCAS = ['Testo', 'Fluke', 'Metrel', 'Bosch', 'UNI-T', 'Steel Pro', 'Epson', 'MSA', '3M', 'Hioki', 'Kyoritsu', 'Megger', 'Extech', 'Amprobe', 'Klein', 'Makita', 'DeWalt', 'Stanley', 'Truper'];

function marcaConocida(texto) {
  const palabras = ` ${normalizar(texto).replace(/[^a-z0-9-]+/g, ' ')} `;
  return MARCAS.find((m) => palabras.includes(` ${normalizar(m)} `)) || '';
}

export function extraerSeries(descripcion) {
  const original = String(descripcion || '').replace(/\s+/g, ' ').trim();
  let texto = original;
  const series = [];

  const marcador = MARCADOR_SERIE.exec(texto);
  if (marcador) {
    const inicio = marcador.index + (/^[\s,;(]/.test(marcador[0]) ? 1 : 0);
    const despues = texto.slice(marcador.index + marcador[0].length);
    const piezas = despues.split(/(\s*(?:,|;|\/\/|\/|\s+y\s+|\s)\s*)/);
    let consumido = 0;
    for (let i = 0; i < piezas.length; i += 1) {
      const pieza = piezas[i];
      if (i % 2 === 1 || !pieza) { consumido += pieza.length; continue; }
      if (!TOKEN_SERIE.test(pieza)) break;
      series.push(pieza.toUpperCase());
      consumido += pieza.length;
    }
    if (series.length) {
      texto = `${texto.slice(0, inicio)} ${despues.slice(consumido)}`;
    }
  }

  let marca = '';
  texto = texto.replace(/\bmarca\s*:?\s*(.+?)(?=\s*(?:[,;]|$))/i, (_, valor) => {
    marca = valor.trim();
    return ' ';
  });

  texto = texto === original
    ? original
    : texto.replace(/\s+/g, ' ').replace(/[\s,;:-]+$/, '').replace(/^[\s,;:-]+/, '').trim();

  return { descripcion: texto || original, series: [...new Set(series)], marca: marca || marcaConocida(original) };
}

const COLUMNAS_TABLA = [
  { id: 'linea', patron: /^n[°º]$/, x: 17 },
  { id: 'normalizado', patron: /^normalizado$/, x: 42 },
  { id: 'codigo', patron: /^codigo de$/, x: 109 },
  { id: 'codigoSunat', patron: /^producto$/, x: 174 },
  { id: 'partida', patron: /^partida$/, x: 239 },
  { id: 'gtin', patron: /^gtin$/, x: 316 },
  { id: 'unidad', patron: /^unidad de$/, x: 656 },
  { id: 'cantidad', patron: /^cantidad$/, x: 727 }
];

const FIN_TABLA = /^(unidad de medida del peso bruto|peso bruto total|datos del traslado|modalidad de traslado|esta es una representacion)/;

function columnasDesdeEncabezado(lineas, indiceEncabezado) {
  const yEncabezado = lineas[indiceEncabezado].y;
  const cercanas = lineas.filter((l) => Math.abs(l.y - yEncabezado) <= 16).flatMap((l) => l.items);
  const posiciones = {};
  for (const columna of COLUMNAS_TABLA) {
    const item = cercanas.find((i) => columna.patron.test(normalizar(i.str)));
    posiciones[columna.id] = item ? item.x : columna.x;
  }
  const descripcion = cercanas.find((i) => /^descripcion detallada$/.test(normalizar(i.str)));
  const inicioDescripcion = posiciones.gtin + 30;
  const finDescripcion = posiciones.unidad - 10;
  const fondo = Math.min(...lineas.filter((l) => Math.abs(l.y - yEncabezado) <= 16).map((l) => l.y));

  function columnaDe(x) {
    if (x >= posiciones.cantidad - 15) return 'cantidad';
    if (x >= finDescripcion) return 'unidad';
    if (x >= inicioDescripcion) return 'descripcion';
    if (x >= posiciones.gtin - 10) return 'gtin';
    if (x >= posiciones.partida - 10) return 'partida';
    if (x >= posiciones.codigoSunat - 10) return 'codigoSunat';
    if (x >= posiciones.codigo - 10) return 'codigo';
    if (x >= posiciones.normalizado + 10) return 'normalizado';
    return 'linea';
  }

  return { columnaDe, fondo, encontradoDescripcion: Boolean(descripcion) };
}

function leerTabla(paginas) {
  const filas = [];
  let actual = null;

  for (const lineas of paginas) {
    const indice = lineas.findIndex((l) => l.items.some((i) => /^descripcion detallada$/.test(normalizar(i.str))));
    if (indice < 0) continue;
    const { columnaDe, fondo } = columnasDesdeEncabezado(lineas, indice);

    for (const linea of lineas) {
      if (linea.y >= fondo) continue;
      if (FIN_TABLA.test(normalizar(linea.items[0]?.str))) break;
      const celdas = {};
      for (const item of linea.items) {
        const col = columnaDe(item.x);
        celdas[col] = [celdas[col], item.str.trim()].filter(Boolean).join(' ');
      }
      if (/^\d+$/.test(celdas.linea || '')) {
        actual = {
          linea: Number(celdas.linea),
          descripcion: celdas.descripcion || '',
          unidad: celdas.unidad || '',
          cantidad: celdas.cantidad || ''
        };
        filas.push(actual);
      } else if (actual) {
        if (celdas.descripcion) actual.descripcion = `${actual.descripcion} ${celdas.descripcion}`.trim();
        if (celdas.unidad) actual.unidad = `${actual.unidad} ${celdas.unidad}`.trim();
      }
    }
  }
  return filas;
}

function itemsDesdeFilasGuia(filas) {
  const items = [];
  for (const fila of filas) {
    const { descripcion, series, marca } = extraerSeries(fila.descripcion);
    const numero = Number(String(fila.cantidad).replace(/,/g, ''));
    const cantidad = Number.isFinite(numero) && String(fila.cantidad).trim() !== '' ? numero : '';
    const base = { descripcion, marca, unidad: normalizarUnidadGuia(fila.unidad), origen: 'pdf' };

    if (!series.length) {
      items.push(crearItemSalida({ ...base, cantidad }));
      continue;
    }
    for (const serie of series) items.push(crearItemSalida({ ...base, serie, cantidad: 1 }));
    if (Number.isInteger(cantidad) && cantidad > series.length) {
      items.push(crearItemSalida({ ...base, cantidad: cantidad - series.length }));
    }
  }
  return items;
}

export function interpretarGuiaRemision(paginasItems, nombreArchivo = '') {
  const paginas = paginasItems.map((items) => agruparLineas(items));
  const primera = paginas[0] || [];
  const textoPrimera = primera.map((l) => unir(l.items)).join('\n');
  const guia = {};
  const fijar = (campo, valor) => {
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
      guia[campo] = String(valor).trim();
    }
  };

  const numero = /N[°º]\s*([A-Z0-9]{4})\s*-\s*(\d{1,8})\b/.exec(textoPrimera);
  if (numero) {
    fijar('serie', numero[1].toUpperCase());
    fijar('numero', String(Number(numero[2])));
  }
  if (/GU[IÍ]A DE REMISI[OÓ]N/i.test(textoPrimera)) {
    if (/\bTRANSPORTISTA\b/i.test(textoPrimera)) fijar('tipo', '31');
    else if (/\bREMITENTE\b/i.test(textoPrimera)) fijar('tipo', '09');
  }
  fijar('remitenteRuc', /RUC\s*N?[°º]?\s*(\d{11})/i.exec(textoPrimera)?.[1]);

  const emision = buscarEtiqueta(primera, /^fecha y hora de emision/);
  if (emision) {
    const nombre = primera
      .filter((l) => l.y > emision.item.y + 20)
      .flatMap((l) => l.items.filter((i) => i.x < 540 && !/GU[IÍ]A|REMITENTE|TRANSPORTISTA|RUC|N[°º]/i.test(i.str)));
    fijar('remitenteNombre', unir(nombre));
  }

  const textoEmision = valorEnLinea(primera, /^fecha y hora de emision/, { xMax: 370 });
  fijar('fechaEmision', fechaIso(textoEmision));
  fijar('horaEmision', hora24(textoEmision));
  fijar('fechaTraslado', fechaIso(valorEnLinea(primera, /^fecha de inicio de traslado/, { xMax: 370 })));
  fijar('motivoTraslado', valorEnLinea(primera, /^motivo de traslado/, { xMax: 370 }));
  fijar('descripcionMotivo', valorEnLinea(primera, /^descripcion de motivo/, { xMax: 370 }));
  fijar('puntoPartida', valorMultilinea(primera, /^punto de partida/));
  fijar('puntoLlegada', valorMultilinea(primera, /^punto de llegada/));
  fijar('documentoRelacionado', valorEnLinea(primera, /^documentos? relacionados?/));

  const pie = paginas.flat();
  fijar('unidadPeso', valorEnLinea(pie, /^unidad de medida del peso bruto/));
  fijar('pesoBruto', valorEnLinea(pie, /^peso bruto total de la carga/));
  fijar('modalidad', valorEnLinea(pie, /^modalidad de traslado/));

  const destinatario = valorEnLinea(primera, /^datos del destinatario/);
  if (destinatario) {
    const m = /^(.*?)\s+-\s+(.*?)\s*N[°º]\s*([A-Z0-9-]+)\s*$/i.exec(destinatario);
    if (m) {
      fijar('destinatarioNombre', m[1]);
      fijar('destinatarioDocumento', m[3]);
    } else {
      fijar('destinatarioNombre', destinatario);
    }
  }

  const delNombre = datosDesdeNombreArchivo(nombreArchivo);
  if (delNombre) {
    guia.serie ||= delNombre.serie;
    guia.numero ||= String(Number(delNombre.numero));
    guia.tipo ||= delNombre.tipo;
  }

  return { guia, items: itemsDesdeFilasGuia(leerTabla(paginas)) };
}
