import { abrirZip, crearZip } from '../../../utils/zip.js';
import { mismaPersona } from '../../../utils/nombres.js';
import {
  ajustarTexto,
  armarRef,
  asegurarAlto,
  combinar,
  desplazarDibujo,
  dimensionesJpeg,
  escaparXml,
  escribirHoja,
  fechaExcel,
  fijarValor,
  insertarImagen,
  insertarFilas,
  leerHoja,
  marcarCasilla,
  separarRef
} from './xlsx.js';
import { SIN_DATO, formatearCorrelativo, formatearGuia, itemsConDatos, numeroCantidad } from './salida.js';

// Posiciones de la hoja "N° 0006" de la plantilla (formato de instrumentos y equipos).
const HOJA = {
  ruta: 'xl/worksheets/sheet2.xml',
  area: { desde: '$A$1', columnaFin: 'M', filaFin: 71 },
  celdas: {
    anio: 'L2', correlativo: 'L4', dependencia: 'B8', lugar: 'D8', fechaSalida: 'I8', fechaIngreso: 'K8',
    destino: 'B11', personaAutorizada: 'E11', jefeAutoriza: 'I11', paquete: 'B13', guiaOculta: 'J14',
    guia: 'D43', observacion: 'B69'
  },
  bienes: {
    inicio: 16,
    fin: 41,
    combinar: [['B', 'E'], ['L', 'M']],
    columnas: { descripcion: 'B', contenedor: 'F', serie: 'G', cantidad: 'H', unidad: 'I', marca: 'J', tipo: 'K', estado: 'L' },
    opcionales: ['contenedor', 'serie', 'marca', 'tipo'],
    letrasPorLinea: 80,
    altoLinea: 11
  },
  lugar: { letrasPorLinea: 44, altoLinea: 15 },
  control: {
    salida: {
      solicita: { nombre: 'B53', fecha: 'C56', hora: 'C57', firma: ['B54', 'F55'] },
      autoriza: { nombre: 'G53', fecha: 'I56', hora: 'I57', firma: ['G54', 'L55'] }
    },
    ingreso: {
      solicita: { nombre: 'B62', fecha: 'C65', hora: 'C66', firma: ['B63', 'F64'] },
      autoriza: { nombre: 'G62', fecha: 'I65', hora: 'I66', firma: ['G63', 'L64'] }
    }
  },
  casillas: {
    mantenimiento: 'Rectángulo 2', transferencia: 'Rectángulo 3', propiedad: 'Rectángulo 6', otros: 'Rectángulo 7',
    prestamo: 'Rectángulo 10', despacho: 'Rectángulo 11', devolucion: 'Rectángulo 14', trabajo: 'Rectángulo 15'
  }
};

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TIPO_HOJA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const TIPO_DIBUJO = 'application/vnd.openxmlformats-officedocument.drawing+xml';

function anioFormato(fechaIso) {
  const anio = /^(\d{4})-/.exec(fechaIso || '')?.[1] || String(new Date().getFullYear());
  return `${anio}-NV - FSI`;
}

function fechaTexto(fechaIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function valorBien(item, campo) {
  if (!item) return '';
  if (campo === 'cantidad') return numeroCantidad(item.cantidad) ?? '';
  const texto = String(item[campo] ?? '').trim();
  return !texto && HOJA.bienes.opcionales.includes(campo) ? SIN_DATO : texto;
}

function llenarBienes(hoja, items, contexto) {
  const { inicio, fin, combinar: rangos, columnas, letrasPorLinea, altoLinea } = HOJA.bienes;
  const extra = Math.max(0, items.length - (fin - inicio + 1));
  insertarFilas(hoja, fin, extra, fin);
  for (let r = fin + 1; r <= fin + extra; r += 1) {
    for (const [a, b] of rangos) combinar(hoja, `${a}${r}:${b}${r}`);
  }
  for (let r = inicio; r <= fin + extra; r += 1) {
    const item = items[r - inicio];
    for (const [campo, columna] of Object.entries(columnas)) {
      const valor = valorBien(item, campo);
      fijarValor(hoja, `${columna}${r}`, valor);
      const lineas = campo === 'descripcion' ? Math.ceil(String(valor).length / letrasPorLinea) : 1;
      if (lineas > 1) ajustarTexto(hoja, `${columna}${r}`, contexto.estilos, lineas * altoLinea + 4);
    }
  }
  return extra;
}

async function construirHoja(zip, salida, contexto) {
  const rels = await zip.leerTexto(HOJA.ruta.replace('worksheets/', 'worksheets/_rels/') + '.rels');
  const rutaDibujo = /Target="\.\.\/(drawings\/drawing\d+\.xml)"/.exec(rels)?.[1];
  const rutaImpresora = /Target="\.\.\/(printerSettings\/printerSettings\d+\.bin)"/.exec(rels)?.[1];
  const hoja = leerHoja(await zip.leerTexto(HOJA.ruta));
  let dibujo = await zip.leerTexto(`xl/${rutaDibujo}`);
  let relsDibujo = await zip.leerTexto(`xl/drawings/_rels/${rutaDibujo.split('/').pop()}.rels`);

  const extra = llenarBienes(hoja, itemsConDatos(salida.items), contexto);
  dibujo = desplazarDibujo(dibujo, HOJA.bienes.fin, extra);
  const mover = (ref) => {
    const { col, fila } = separarRef(ref);
    return armarRef(col, fila > HOJA.bienes.fin ? fila + extra : fila);
  };

  const { formato, guia } = salida;
  const escribir = (clave, valor) => fijarValor(hoja, mover(HOJA.celdas[clave]), valor);
  escribir('anio', anioFormato(formato.fechaSalida));
  escribir('correlativo', formatearCorrelativo(formato.correlativo));
  escribir('dependencia', formato.dependencia);
  escribir('lugar', formato.lugar);
  escribir('fechaSalida', fechaExcel(formato.fechaSalida) ?? '');
  escribir('fechaIngreso', fechaTexto(formato.fechaIngreso));
  escribir('destino', formato.destino);
  escribir('personaAutorizada', formato.personaAutorizada);
  escribir('jefeAutoriza', formato.jefeAutoriza);
  escribir('paquete', `PAQUETE Nº ${formato.paquete || ''}`.trim());
  escribir('guiaOculta', formatearGuia(guia));
  escribir('guia', formatearGuia(guia));
  escribir('observacion', formato.observacion);
  const lineasLugar = Math.ceil(String(formato.lugar || '').length / HOJA.lugar.letrasPorLinea);
  asegurarAlto(hoja, separarRef(HOJA.celdas.lugar).fila, lineasLugar * HOJA.lugar.altoLinea + 4);

  let idForma = 1000;
  for (const [control, firmas] of Object.entries(HOJA.control)) {
    for (const [rol, celdas] of Object.entries(firmas)) {
      const datos = formato[control]?.[rol] || {};
      fijarValor(hoja, mover(celdas.nombre), datos.nombre || '');
      fijarValor(hoja, mover(celdas.fecha), fechaTexto(datos.fecha));
      fijarValor(hoja, mover(celdas.hora), datos.hora || '');
      const imagen = contexto.firmas.find((f) => mismaPersona(f.nombre, datos.nombre));
      if (!imagen) continue;
      idForma += 1;
      const rid = `rIdFirma${idForma}`;
      relsDibujo = relsDibujo.replace('</Relationships>', `<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${imagen.archivo}"/></Relationships>`);
      dibujo = insertarImagen(dibujo, hoja, {
        desde: mover(celdas.firma[0]),
        hasta: mover(celdas.firma[1]),
        ancho: imagen.ancho,
        alto: imagen.alto,
        rid,
        id: idForma
      });
      contexto.usadas.add(imagen);
    }
  }

  for (const [motivo, forma] of Object.entries(HOJA.casillas)) {
    dibujo = marcarCasilla(dibujo, forma, formato.motivo === motivo);
  }

  return {
    xml: escribirHoja(hoja),
    dibujo,
    relsDibujo,
    impresora: rutaImpresora ? await zip.leerBytes(`xl/${rutaImpresora}`) : null,
    area: `${HOJA.area.desde}:$${HOJA.area.columnaFin}$${HOJA.area.filaFin + extra}`
  };
}

function nombreHoja(salida) {
  return (formatearCorrelativo(salida.formato?.correlativo) || formatearGuia(salida.guia) || 'Salida')
    .replace(/[[\]:*?/\\]/g, '-')
    .slice(0, 31);
}

export function nombreArchivoSalida(salida) {
  const partes = [formatearCorrelativo(salida.formato?.correlativo), formatearGuia(salida.guia)].filter(Boolean);
  return `Formato de salida ${partes.join(' - ')}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
}

export async function generarFormatoSalida(plantilla, salida, { firmas = [] } = {}) {
  const zip = await abrirZip(plantilla);
  const archivos = [];
  const agregar = (nombre, datos) => archivos.push({ nombre, datos });
  const contexto = {
    estilos: { xml: await zip.leerTexto('xl/styles.xml'), ajustados: new Map() },
    firmas: firmas
      .map((firma, i) => ({ ...firma, ...dimensionesJpeg(firma.bytes), archivo: `firma${i + 1}.jpeg` }))
      .filter((firma) => firma.ancho),
    usadas: new Set()
  };
  const hoja = await construirHoja(zip, salida, contexto);
  const nombre = escaparXml(nombreHoja(salida));

  let tipos = await zip.leerTexto('[Content_Types].xml');
  tipos = tipos.replace(/<Override PartName="\/xl\/(?:worksheets\/sheet|drawings\/drawing)\d+\.xml"[^>]*\/>/g, '');
  if (!/Extension="jpeg"/.test(tipos)) tipos = tipos.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
  agregar('[Content_Types].xml', tipos.replace('</Types>', `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TIPO_HOJA}"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="${TIPO_DIBUJO}"/></Types>`));

  const libro = (await zip.leerTexto('xl/workbook.xml'))
    .replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets><sheet name="${nombre}" sheetId="1" r:id="rIdHoja1"/></sheets>`)
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, `<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${nombre.replace(/'/g, "''")}'!${hoja.area}</definedName></definedNames>`)
    .replace(/ activeTab="\d+"/, '');
  agregar('xl/workbook.xml', libro);

  const relLibro = (await zip.leerTexto('xl/_rels/workbook.xml.rels'))
    .replace(/<Relationship [^>]*Type="[^"]*\/worksheet"[^>]*\/>/g, '')
    .replace('</Relationships>', `<Relationship Id="rIdHoja1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  agregar('xl/_rels/workbook.xml.rels', relLibro);

  agregar('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Hojas de cálculo</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${nombre}</vt:lpstr></vt:vector></TitlesOfParts><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`);

  const ahora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = (await zip.leerTexto('docProps/core.xml'))
    .replace(/(<dcterms:created [^>]*>)[^<]*/, `$1${ahora}`)
    .replace(/(<dcterms:modified [^>]*>)[^<]*/, `$1${ahora}`);
  agregar('docProps/core.xml', core);

  for (const ruta of ['_rels/.rels', 'xl/theme/theme1.xml', 'xl/sharedStrings.xml', 'xl/media/image1.png']) {
    const datos = await zip.leerBytes(ruta);
    if (datos) agregar(ruta, datos);
  }
  for (const imagen of contexto.usadas) agregar(`xl/media/${imagen.archivo}`, imagen.bytes);
  agregar('xl/styles.xml', contexto.estilos.xml);

  let xml = hoja.xml.replace(/ tabSelected="1"/g, '').replace('<sheetView ', '<sheetView tabSelected="1" ');
  if (!hoja.impresora) xml = xml.replace(/(<pageSetup\b[^>]*?) r:id="[^"]*"/, '$1');
  agregar('xl/worksheets/sheet1.xml', xml);
  const relsHoja = [`<Relationship Id="rId2" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/>`];
  if (hoja.impresora) {
    relsHoja.push(`<Relationship Id="rId1" Type="${REL}/printerSettings" Target="../printerSettings/printerSettings1.bin"/>`);
    agregar('xl/printerSettings/printerSettings1.bin', hoja.impresora);
  }
  agregar('xl/worksheets/_rels/sheet1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsHoja.join('')}</Relationships>`);
  agregar('xl/drawings/drawing1.xml', hoja.dibujo);
  agregar('xl/drawings/_rels/drawing1.xml.rels', hoja.relsDibujo);

  return crearZip(archivos);
}
