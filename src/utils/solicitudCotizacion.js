export const UNIDADES_SOLICITUD = [
  'UNIDAD', 'SERVICIO', 'GLB.', 'DÍA', 'MES', 'HORA', 'VIAJE', 'KM.',
  'LT.', 'KG.', 'M.', 'M2', 'M3', 'PZ.', 'PAR', 'CAJA', 'ROLLO', 'KIT.',
  'EQ.', 'DOC.', '%.', 'MILL.'
];

function sinTildes(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const SINONIMOS_UNIDAD = [
  [/^(unidad(es)?|und|unds|uds?|u|unid|unids|pza?s?|piezas?|equipos?|vehiculos?|camionetas?)$/, 'UNIDAD'],
  [/^(servicios?|serv)$/, 'SERVICIO'],
  [/^(glb|global|globales)$/, 'GLB.'],
  [/^(dias?|d)$/, 'DÍA'],
  [/^(mes|meses)$/, 'MES'],
  [/^(horas?|hrs?|h)$/, 'HORA'],
  [/^(viajes?)$/, 'VIAJE'],
  [/^(km|kms|kilometros?)$/, 'KM.'],
  [/^(lts?|litros?|l|galon(es)?|gl|gal)$/, 'LT.'],
  [/^(kgs?|kilos?|kilogramos?)$/, 'KG.'],
  [/^(m|mts?|metros?|ml)$/, 'M.'],
  [/^(m2|metros? cuadrados?)$/, 'M2'],
  [/^(m3|metros? cubicos?)$/, 'M3'],
  [/^(pares?)$/, 'PAR'],
  [/^(cajas?|cjs?)$/, 'CAJA'],
  [/^(rollos?)$/, 'ROLLO'],
  [/^(kits?|juegos?|jgos?)$/, 'KIT.'],
  [/^(millares?|mill)$/, 'MILL.']
];

export function normalizarUnidad(valor, porDefecto = 'UNIDAD') {
  const limpio = sinTildes(valor).replace(/\.$/, '');
  if (!limpio) return porDefecto;
  const exacta = UNIDADES_SOLICITUD.find((u) => sinTildes(u).replace(/\.$/, '') === limpio);
  if (exacta) return exacta;
  const sinonimo = SINONIMOS_UNIDAD.find(([regex]) => regex.test(limpio));
  return sinonimo ? sinonimo[1] : porDefecto;
}

const PATRON_UNIDAD = '(unidad(?:es)?|und\\.?|unds\\.?|uds?\\.?|unid\\.?|pzas?\\.?|piezas?|servicios?|glb\\.?|global|d[ií]as?|mes(?:es)?|horas?|hrs?\\.?|viajes?|kms?\\.?|kil[oó]metros?|litros?|lts?\\.?|galon(?:es)?|kgs?\\.?|kilos?|metros?|mts?\\.?|m2|m3|pares?|cajas?|rollos?|kits?|juegos?|millares?)';
const NUM = '(\\d+(?:[.,]\\d+)?)';

const RE_CANTIDAD_INICIO = new RegExp(`^${NUM}\\s*(?:${PATRON_UNIDAD}\\s+(?:de\\s+)?|x\\s+|\\s+)(.{2,})$`, 'i');
const RE_CANTIDAD_FINAL_X = new RegExp(`^(.{2,}?)\\s*(?:[-–:,(]\\s*)?(?:\\bx|\\bcant(?:idad)?\\.?\\s*:?)\\s*${NUM}\\s*(?:${PATRON_UNIDAD})?\\s*\\)?\\.?$`, 'i');
const RE_CANTIDAD_FINAL_UNIDAD = new RegExp(`^(.{2,}?)\\s*[-–:(,]?\\s*${NUM}\\s*${PATRON_UNIDAD}\\s*\\)?\\.?$`, 'i');

const RE_VINETA = /^\s*(?:[-*•·▪►✓→]+|\(?\d{1,3}[.)]-?|[a-zA-Z][.)])\s+/;
const RE_META = /^\s*(asunto|referencia|ref\.?|lugar(?:\s+de\s+(?:entrega|servicio|trabajo))?|destino|observaci[oó]n(?:es)?|notas?)\s*:\s*(.+)$/i;
const RE_PAGINA = /^\s*p[aá]g(ina|\.)?\s*\d+(\s*(de|\/)\s*\d+)?\s*$/i;
const RE_ETIQUETA = /^\s*[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ°º. /]{1,30}:\s*\S/;
const RE_ENCABEZADO = /^(?:[ií]tem|n[°º.]?|nro\.?|c[oó]digo|descripci[oó]n|detalle|cantidad|cant\.?|unidad|u\.?\s?m\.?|especificaciones?|\s|[|;,\t])+$/i;

function aNumero(valor) {
  if (typeof valor === 'number') return valor;
  const n = Number(String(valor || '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function limpiarDescripcion(texto) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–:,.\s]+|[-–:,\s]+$/g, '')
    .trim();
}

export function crearItemSolicitud(campos = {}, unidadPorDefecto = 'UNIDAD') {
  return {
    codigo: '',
    descripcion: '',
    especificaciones: '',
    cantidad: 1,
    unidadMedida: unidadPorDefecto,
    ...campos
  };
}

export function interpretarLinea(linea, unidadPorDefecto = 'UNIDAD') {
  const texto = String(linea || '').replace(RE_VINETA, '').trim();
  if (texto.length < 2 || /^[\d\s.,]+$/.test(texto) || RE_ENCABEZADO.test(texto)) return null;

  const valido = (n) => Number.isFinite(n) && n > 0 && n < 100000;
  const descripcionCompleta = (d) => !/\b(por|de|del|durante|para|a|en|con|cada|hasta)$/i.test(limpiarDescripcion(d));

  let m = texto.match(RE_CANTIDAD_INICIO);
  if (m && valido(aNumero(m[1])) && !/^\s*(x|%|°|º)/i.test(m[3])) {
    const descripcion = limpiarDescripcion(m[3]);
    return {
      descripcion: descripcion.charAt(0).toUpperCase() + descripcion.slice(1),
      cantidad: aNumero(m[1]),
      unidadMedida: m[2] ? normalizarUnidad(m[2], unidadPorDefecto) : unidadPorDefecto
    };
  }

  m = texto.match(RE_CANTIDAD_FINAL_X);
  if (m && valido(aNumero(m[2])) && descripcionCompleta(m[1])) {
    return {
      descripcion: limpiarDescripcion(m[1]),
      cantidad: aNumero(m[2]),
      unidadMedida: m[3] ? normalizarUnidad(m[3], unidadPorDefecto) : unidadPorDefecto
    };
  }

  m = texto.match(RE_CANTIDAD_FINAL_UNIDAD);
  if (m && valido(aNumero(m[2])) && descripcionCompleta(m[1])) {
    return {
      descripcion: limpiarDescripcion(m[1]),
      cantidad: aNumero(m[2]),
      unidadMedida: normalizarUnidad(m[3], unidadPorDefecto)
    };
  }

  return { descripcion: limpiarDescripcion(texto), cantidad: 1, unidadMedida: unidadPorDefecto };
}

export function interpretarTextoSolicitud(texto, unidadPorDefecto = 'UNIDAD', opciones = {}) {
  const items = [];
  const datos = {};

  const lineas = String(texto || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, '    ').replace(/\s+$/, ''))
    .filter((l) => l.trim());
  const sangriaBase = lineas.length
    ? Math.min(...lineas.map((l) => l.match(/^\s*/)[0].length))
    : 0;

  lineas
    .map((l) => l.slice(sangriaBase))
    .forEach((linea) => {
      const meta = linea.match(RE_META);
      if (meta) {
        const clave = sinTildes(meta[1]);
        const valor = meta[2].trim();
        if (clave.startsWith('asunto') || clave.startsWith('ref')) datos.asunto = valor;
        else if (clave.startsWith('lugar') || clave.startsWith('destino')) datos.lugarEntrega = valor;
        else datos.observacion = [datos.observacion, valor].filter(Boolean).join('\n');
        return;
      }

      if (RE_PAGINA.test(linea)) return;
      if (opciones.documento && RE_ETIQUETA.test(linea)) return;

      const sangria = /^\s{2,}/.test(linea);
      const anterior = items[items.length - 1];
      if (sangria && anterior) {
        const detalle = limpiarDescripcion(linea.replace(RE_VINETA, ''));
        if (detalle) {
          anterior.especificaciones = [anterior.especificaciones, detalle].filter(Boolean).join('\n');
        }
        return;
      }

      const interpretado = interpretarLinea(linea, unidadPorDefecto);
      if (interpretado?.descripcion) items.push(crearItemSolicitud(interpretado, unidadPorDefecto));
    });

  return { items, datos };
}

const COLUMNAS = {
  codigo: /^(c[oó]d(igo)?\.?|sku|part\s?n|n[°º]?\s?parte)/,
  descripcion: /(descrip|detalle|producto|art[ií]culo|bien(es)?$|^servicio|nombre|concepto|requerimiento|veh[ií]culo|equipo)/,
  cantidad: /^(cant|qty|cantidad|n[°º]?\s?unid)/,
  unidad: /^(unid|u\.?\s?m|medida|und)/,
  especificaciones: /(especif|caracter|observ|nota|comentario|requisito|marca|modelo)/
};

export function detectarEncabezado(filas, limite = 15) {
  const tope = Math.min(filas.length, limite);
  for (let i = 0; i < tope; i += 1) {
    const mapa = {};
    let columnaItem;
    filas[i].forEach((celda, col) => {
      const t = sinTildes(celda);
      if (!t || t.length > 40 || /\d/.test(t)) return;
      if (/^items?$/.test(t)) columnaItem = col;
      for (const [campo, regex] of Object.entries(COLUMNAS)) {
        if (campo === 'especificaciones') {
          if (regex.test(t)) (mapa.especificaciones ||= []).push(col);
        } else if (mapa[campo] === undefined && regex.test(t)) {
          mapa[campo] = col;
          break;
        }
      }
    });
    if (mapa.descripcion === undefined && columnaItem !== undefined) mapa.descripcion = columnaItem;
    if (mapa.descripcion !== undefined && (mapa.cantidad !== undefined || mapa.unidad !== undefined || mapa.codigo !== undefined)) {
      return { fila: i, mapa };
    }
  }
  return null;
}

export function interpretarFilasSolicitud(filas, unidadPorDefecto = 'UNIDAD') {
  const tabla = (filas || [])
    .map((fila) => (fila || []).map((celda) => String(celda ?? '').trim()))
    .filter((fila) => fila.some(Boolean));
  if (!tabla.length) return { items: [], datos: {} };

  const encabezado = detectarEncabezado(tabla);
  if (encabezado) {
    const { mapa } = encabezado;
    const items = tabla.slice(encabezado.fila + 1)
      .map((fila) => {
        const descripcion = limpiarDescripcion(fila[mapa.descripcion]);
        if (!descripcion || /^(sub)?total/i.test(descripcion)) return null;
        const cantidad = aNumero(fila[mapa.cantidad]);
        const especificaciones = (mapa.especificaciones || [])
          .filter((col) => col !== mapa.descripcion)
          .map((col) => fila[col])
          .filter(Boolean)
          .join('\n');
        return crearItemSolicitud({
          codigo: mapa.codigo !== undefined ? fila[mapa.codigo] || '' : '',
          descripcion,
          especificaciones,
          cantidad: cantidad > 0 ? cantidad : 1,
          unidadMedida: mapa.unidad !== undefined
            ? normalizarUnidad(fila[mapa.unidad], unidadPorDefecto)
            : unidadPorDefecto
        }, unidadPorDefecto);
      })
      .filter(Boolean);
    return { items, datos: {}, conEncabezado: true };
  }

  if (tabla.every((fila) => fila.filter(Boolean).length <= 1)) {
    return interpretarTextoSolicitud(tabla.map((fila) => fila.find(Boolean)).join('\n'), unidadPorDefecto);
  }

  const items = tabla
    .map((fila) => {
      const textos = fila.filter((c) => c && Number.isNaN(aNumero(c)));
      const descripcion = limpiarDescripcion(textos.sort((a, b) => b.length - a.length)[0]);
      if (!descripcion || RE_ENCABEZADO.test(descripcion)) return null;
      const numeros = fila
        .map((c, col) => ({ col, n: aNumero(c) }))
        .filter(({ n }) => n > 0 && n < 100000);
      const numero = (numeros.length > 1 && numeros[0].col === 0 ? numeros[1] : numeros[0])?.n;
      const unidad = fila.find((c) => c !== descripcion && normalizarUnidad(c, '') !== '');
      return crearItemSolicitud({
        descripcion,
        cantidad: numero || 1,
        unidadMedida: unidad ? normalizarUnidad(unidad, unidadPorDefecto) : unidadPorDefecto
      }, unidadPorDefecto);
    })
    .filter(Boolean);
  return { items, datos: {} };
}
