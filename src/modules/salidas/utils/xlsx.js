const ATRIBUTO = /([\w:.-]+)="([^"]*)"/g;

function letraANumero(letras) {
  let n = 0;
  for (const letra of letras) n = n * 26 + (letra.charCodeAt(0) - 64);
  return n;
}

function numeroALetra(n) {
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

export function separarRef(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`Referencia de celda inválida: ${ref}`);
  return { col: letraANumero(m[1]), fila: Number(m[2]) };
}

export function armarRef(col, fila) {
  return `${numeroALetra(col)}${fila}`;
}

function caracterXmlValido(caracter) {
  const codigo = caracter.codePointAt(0);
  return codigo === 9 || codigo === 10 || codigo === 13 || (codigo >= 32 && codigo !== 0xfffe && codigo !== 0xffff);
}

export function escaparXml(texto) {
  return [...String(texto ?? '')].filter(caracterXmlValido).join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function leerAtributos(texto) {
  return [...texto.matchAll(ATRIBUTO)].map((m) => [m[1], m[2]]);
}

function escribirAtributos(atributos) {
  return atributos.map(([k, v]) => ` ${k}="${v}"`).join('');
}

function obtenerAtributo(atributos, clave) {
  return atributos.find(([k]) => k === clave)?.[1];
}

function fijarAtributo(atributos, clave, valor) {
  const i = atributos.findIndex(([k]) => k === clave);
  if (valor === null || valor === undefined) {
    if (i >= 0) atributos.splice(i, 1);
  } else if (i >= 0) {
    atributos[i][1] = String(valor);
  } else {
    atributos.push([clave, String(valor)]);
  }
}

const SHEET_DATA = /<sheetData\s*\/>|<sheetData>([\s\S]*?)<\/sheetData>/;

export function leerHoja(xml) {
  const datos = SHEET_DATA.exec(xml);
  if (!datos) throw new Error('La hoja de la plantilla no tiene datos.');
  const filas = new Map();

  for (const f of (datos[1] || '').matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const atributos = leerAtributos(f[1]);
    const celdas = new Map();
    for (const c of (f[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributosCelda = leerAtributos(c[1]);
      celdas.set(separarRef(obtenerAtributo(atributosCelda, 'r')).col, { atributos: atributosCelda, interior: c[2] || '' });
    }
    filas.set(Number(obtenerAtributo(atributos, 'r')), { atributos, celdas });
  }

  const combinadas = [...xml.matchAll(/<mergeCell ref="([^"]+)"\s*\/>/g)].map((m) => m[1]);
  return { xml, filas, combinadas };
}

export function escribirHoja(hoja) {
  let maxFila = 1;
  let minCol = Infinity;
  let maxCol = 1;

  const filasXml = [...hoja.filas.keys()].sort((a, b) => a - b).map((r) => {
    const fila = hoja.filas.get(r);
    fijarAtributo(fila.atributos, 'r', r);
    fijarAtributo(fila.atributos, 'spans', null);
    maxFila = Math.max(maxFila, r);
    const celdas = [...fila.celdas.keys()].sort((a, b) => a - b).map((col) => {
      const celda = fila.celdas.get(col);
      fijarAtributo(celda.atributos, 'r', armarRef(col, r));
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      return celda.interior
        ? `<c${escribirAtributos(celda.atributos)}>${celda.interior}</c>`
        : `<c${escribirAtributos(celda.atributos)}/>`;
    }).join('');
    return celdas ? `<row${escribirAtributos(fila.atributos)}>${celdas}</row>` : `<row${escribirAtributos(fila.atributos)}/>`;
  }).join('');

  let xml = hoja.xml.replace(SHEET_DATA, `<sheetData>${filasXml}</sheetData>`);
  const combinadas = hoja.combinadas.length
    ? `<mergeCells count="${hoja.combinadas.length}">${hoja.combinadas.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  xml = /<mergeCells\b/.test(xml)
    ? xml.replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, combinadas)
    : xml.replace('</sheetData>', `</sheetData>${combinadas}`);
  const dimension = `${armarRef(Number.isFinite(minCol) ? minCol : 1, 1)}:${armarRef(maxCol, maxFila)}`;
  return xml.replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="${dimension}"/>`);
}

function obtenerFila(hoja, numero) {
  if (!hoja.filas.has(numero)) hoja.filas.set(numero, { atributos: [['r', String(numero)]], celdas: new Map() });
  return hoja.filas.get(numero);
}

function obtenerCelda(hoja, ref) {
  const { col, fila } = separarRef(ref);
  const celdas = obtenerFila(hoja, fila).celdas;
  if (!celdas.has(col)) celdas.set(col, { atributos: [['r', ref]], interior: '' });
  return celdas.get(col);
}

export function fijarValor(hoja, ref, valor) {
  const celda = obtenerCelda(hoja, ref);
  if (valor === null || valor === undefined || valor === '') {
    fijarAtributo(celda.atributos, 't', null);
    celda.interior = '';
  } else if (typeof valor === 'number' && Number.isFinite(valor)) {
    fijarAtributo(celda.atributos, 't', null);
    celda.interior = `<v>${valor}</v>`;
  } else {
    fijarAtributo(celda.atributos, 't', 'inlineStr');
    celda.interior = `<is><t xml:space="preserve">${escaparXml(valor)}</t></is>`;
  }
}

export function ajustarTexto(hoja, ref, estilos, alto) {
  const celda = obtenerCelda(hoja, ref);
  const original = obtenerAtributo(celda.atributos, 's') || '0';
  if (!estilos.ajustados.has(original)) {
    const bloque = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(estilos.xml);
    const xfs = bloque[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
    let copia = xfs[Number(original)];
    if (/<alignment\b/.test(copia)) {
      copia = copia.replace(/ wrapText="[^"]*"/, '').replace('<alignment', '<alignment wrapText="1"');
    } else {
      copia = copia.replace(/\s*\/>$/, '><alignment wrapText="1"/></xf>');
    }
    if (!/applyAlignment=/.test(copia)) copia = copia.replace('<xf ', '<xf applyAlignment="1" ');
    estilos.xml = estilos.xml.replace(bloque[0], `<cellXfs count="${xfs.length + 1}">${bloque[2]}${copia}</cellXfs>`);
    estilos.ajustados.set(original, String(xfs.length));
  }
  fijarAtributo(celda.atributos, 's', estilos.ajustados.get(original));
  asegurarAlto(hoja, separarRef(ref).fila, alto);
}

export function asegurarAlto(hoja, numero, alto) {
  const fila = obtenerFila(hoja, numero);
  const actual = Number(obtenerAtributo(fila.atributos, 'ht')) || 0;
  if (alto > actual) {
    fijarAtributo(fila.atributos, 'ht', alto);
    fijarAtributo(fila.atributos, 'customHeight', '1');
  }
}

export function textoDe(hoja, ref) {
  const { col, fila } = separarRef(ref);
  const interior = hoja.filas.get(fila)?.celdas.get(col)?.interior || '';
  return [...interior.matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
}

function copiarFila(hoja, origen, destino) {
  const modelo = hoja.filas.get(origen);
  if (!modelo) return;
  const atributos = modelo.atributos.map(([k, v]) => [k, v]).filter(([k]) => k !== 'hidden');
  const celdas = new Map();
  for (const [col, celda] of modelo.celdas) {
    celdas.set(col, { atributos: celda.atributos.map(([k, v]) => [k, v]).filter(([k]) => k !== 't'), interior: '' });
  }
  hoja.filas.set(destino, { atributos, celdas });
}

function desplazarRef(ref, despuesDe, cantidad) {
  const { col, fila } = separarRef(ref);
  return armarRef(col, fila > despuesDe ? fila + cantidad : fila);
}

function desplazarRango(rango, despuesDe, cantidad) {
  return rango.split(':').map((ref) => desplazarRef(ref, despuesDe, cantidad)).join(':');
}

export function insertarFilas(hoja, despuesDe, cantidad, filaModelo) {
  if (cantidad <= 0) return;
  const filas = new Map();
  for (const [r, fila] of hoja.filas) filas.set(r > despuesDe ? r + cantidad : r, fila);
  hoja.filas = filas;
  for (let i = 1; i <= cantidad; i += 1) copiarFila(hoja, filaModelo, despuesDe + i);
  hoja.combinadas = hoja.combinadas.map((rango) => desplazarRango(rango, despuesDe, cantidad));
}

export function combinar(hoja, rango) {
  if (!hoja.combinadas.includes(rango)) hoja.combinadas.push(rango);
}

export function desplazarDibujo(xml, despuesDe, cantidad) {
  if (!cantidad) return xml;
  return xml.replace(
    /(<xdr:(?:from|to)>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/g,
    (_, antes, fila, despues) => `${antes}${Number(fila) + 1 > despuesDe ? Number(fila) + cantidad : fila}${despues}`
  );
}

const FUENTE_CASILLA = '<a:latin typeface="Arial Narrow" panose="020B0606020202030204" pitchFamily="34" charset="0"/>';
const PARRAFO_MARCADO = `<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="es-PE" sz="1100" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>${FUENTE_CASILLA}</a:rPr><a:t>X</a:t></a:r></a:p>`;
const PARRAFO_VACIO = `<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="es-PE" sz="1100" b="1">${FUENTE_CASILLA}</a:endParaRPr></a:p>`;

export function marcarCasilla(xml, nombreForma, marcada) {
  return xml.replace(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g, (ancla) => {
    if (!ancla.includes(`name="${nombreForma}"`)) return ancla;
    return ancla.replace(
      /(<xdr:txBody>[\s\S]*?<a:lstStyle\/>)[\s\S]*?(<\/xdr:txBody>)/,
      `$1${marcada ? PARRAFO_MARCADO : PARRAFO_VACIO}$2`
    );
  });
}

export function fechaExcel(fechaIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaIso || ''));
  if (!m) return null;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000);
}

export function dimensionesJpeg(bytes) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marcador = bytes[i + 1];
    const largo = (bytes[i + 2] << 8) + bytes[i + 3];
    if (marcador >= 0xc0 && marcador <= 0xc3) {
      return { alto: (bytes[i + 5] << 8) + bytes[i + 6], ancho: (bytes[i + 7] << 8) + bytes[i + 8] };
    }
    i += 2 + largo;
  }
  return null;
}

function anchosColumnas(hoja) {
  const defecto = Number(/defaultColWidth="([\d.]+)"/.exec(hoja.xml)?.[1] || 8.43);
  const columnas = [...hoja.xml.matchAll(/<col\b([^>]*)\/>/g)].map((m) => leerAtributos(m[1]));
  return (col) => {
    const def = columnas.find((c) => Number(obtenerAtributo(c, 'min')) <= col && col <= Number(obtenerAtributo(c, 'max')));
    return Math.round(Number(def ? obtenerAtributo(def, 'width') : defecto) * 7 + 5);
  };
}

function altoFila(hoja, fila) {
  const defecto = Number(/defaultRowHeight="([\d.]+)"/.exec(hoja.xml)?.[1] || 15);
  const ht = Number(obtenerAtributo(hoja.filas.get(fila)?.atributos || [], 'ht'));
  return Math.round((ht || defecto) * 4 / 3);
}

function ubicar(tamanos, inicio, desplazamiento) {
  let indice = inicio;
  let resto = desplazamiento;
  while (resto >= tamanos(indice)) {
    resto -= tamanos(indice);
    indice += 1;
  }
  return { indice, resto };
}

const EMU = 9525;

export function insertarImagen(dibujo, hoja, { desde, hasta, ancho, alto, rid, id }) {
  const a = separarRef(desde);
  const b = separarRef(hasta);
  const anchoCol = anchosColumnas(hoja);
  let cajaAncho = 0;
  for (let c = a.col; c <= b.col; c += 1) cajaAncho += anchoCol(c);
  let cajaAlto = 0;
  for (let f = a.fila; f <= b.fila; f += 1) cajaAlto += altoFila(hoja, f);

  const escala = Math.min((cajaAncho * 0.9) / ancho, (cajaAlto * 0.9) / alto);
  const w = Math.round(ancho * escala);
  const h = Math.round(alto * escala);
  const x = ubicar(anchoCol, a.col, Math.round((cajaAncho - w) / 2));
  const y = ubicar((f) => altoFila(hoja, f), a.fila, Math.round((cajaAlto - h) / 2));

  const ancla = `<xdr:oneCellAnchor><xdr:from><xdr:col>${x.indice - 1}</xdr:col><xdr:colOff>${x.resto * EMU}</xdr:colOff><xdr:row>${y.indice - 1}</xdr:row><xdr:rowOff>${y.resto * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${w * EMU}" cy="${h * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Firma ${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w * EMU}" cy="${h * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  return dibujo.replace('</xdr:wsDr>', `${ancla}</xdr:wsDr>`);
}
