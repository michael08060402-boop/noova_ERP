import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './formatDate';
import { bloquesDeSolicitud, valorAutomatico, valorCampo } from './plantillasSolicitud';
import noovaLogo from '../assets/noova-logo.png';

const NOOVA_FALLBACK = {
  razonSocial: 'CONTRATISTAS GENERALES NOOVA S.A.C.',
  ruc: '20550622930',
  direccion: 'Av. Cristóbal de Peralta Norte Nro. 110 Int. 702, Urb. Valle Hermoso de Monterrico, Santiago de Surco, Lima - Lima',
  celular: '',
  email: '',
  web: ''
};

const COLOR_DARK = [31, 55, 75];
const COLOR_ACCENT = [244, 122, 0];
const COLOR_LINE_SOFT = [205, 205, 205];
const COLOR_TXT = [30, 30, 30];
const COLOR_TXT_SOFT = [95, 95, 95];
const CARD_BG = [246, 247, 248];
const CARD_BORDER = [224, 228, 231];

const MARGEN = 12;
const HEADER_H = 38;
const INICIO_Y = 8 + HEADER_H;
const SEPARACION = 5;
const GAP_COLUMNAS = 5;

function textoCelda(valor, tipo) {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'numero') {
    const n = Number(valor);
    if (String(valor).trim() === '' || Number.isNaN(n)) return String(valor);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(valor);
}

function filaConContenido(fila, columnas) {
  return columnas.some((c) => {
    const v = String(fila.valores?.[c.id] ?? '').trim();
    return v && !(c.tipo === 'unidad');
  });
}

function generarPDFSolicitud(solicitud, config = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * MARGEN;
  const limiteY = pageH - 18;

  const empresa = { ...NOOVA_FALLBACK, ...(config?.empresa || {}) };
  const emp = {
    razonSocial: empresa.razonSocial || NOOVA_FALLBACK.razonSocial,
    ruc: empresa.ruc || NOOVA_FALLBACK.ruc,
    direccion: empresa.direccion || NOOVA_FALLBACK.direccion,
    celular: empresa.celular || empresa.telefono || '',
    email: empresa.email || '',
    web: empresa.web || ''
  };
  const contexto = {
    fecha: formatDate(solicitud.fechaEmision || solicitud.fecha || solicitud.createdAt),
    solicitante: solicitud.responsable || solicitud.creadoPor || '-',
    empresa: emp,
    moneda: solicitud.moneda || 'S/'
  };

  function drawHeader(compacta = false) {
    const top = 8;
    const logoH = compacta ? 14 : 20;
    const logoW = logoH * (305 / 216);
    try {
      doc.addImage(noovaLogo, 'PNG', MARGEN, top, logoW, logoH);
    } catch { }

    const boxW = 66;
    const boxX = pageW - MARGEN - boxW;
    const infoX = MARGEN + logoW + 4;
    const infoW = boxX - infoX - 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacta ? 8.5 : 10);
    doc.setTextColor(...COLOR_DARK);
    const razonLines = doc.splitTextToSize(emp.razonSocial, infoW);
    doc.text(razonLines, infoX, top + (compacta ? 4 : 5));

    if (!compacta) {
      let yInfo = top + 5 + razonLines.length * 4 + 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(...COLOR_TXT_SOFT);
      const dirLines = doc.splitTextToSize(emp.direccion, infoW);
      doc.text(dirLines, infoX, yInfo);
      yInfo += dirLines.length * 3.2 + 0.5;
      const contactoLinea = [
        emp.celular ? `Cel.: ${emp.celular}` : '',
        emp.email ? `Email: ${emp.email}` : '',
        emp.web || ''
      ].filter(Boolean).join('   ');
      if (contactoLinea) doc.text(doc.splitTextToSize(contactoLinea, infoW), infoX, yInfo);
    }

    const boxH = compacta ? 14 : 20;
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(boxX, top, boxW, compacta ? 7 : 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacta ? 7.5 : 8.3);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLICITUD DE COTIZACIÓN', boxX + boxW / 2, top + (compacta ? 4.8 : 6.5), { align: 'center' });

    doc.setTextColor(...COLOR_DARK);
    doc.setFontSize(compacta ? 7.2 : 8.5);
    doc.text(`RUC: ${emp.ruc}`, boxX + boxW / 2, top + (compacta ? 11.5 : 15.5), { align: 'center' });

    doc.setDrawColor(...COLOR_DARK);
    doc.setLineWidth(0.5);
    doc.rect(boxX, top, boxW, boxH);
    doc.setLineWidth(0.4);
    doc.line(MARGEN, top + HEADER_H - 3, pageW - MARGEN, top + HEADER_H - 3);
  }

  let y = INICIO_Y;

  function nuevaPagina() {
    doc.addPage();
    drawHeader(true);
    y = INICIO_Y;
  }

  function asegurar(alto) {
    if (y + alto > limiteY && y > INICIO_Y) nuevaPagina();
  }

  function altoTitulo(bloque) {
    return bloque.mostrarTitulo && bloque.titulo && bloque.estilo !== 'tarjeta' ? 7 : 0;
  }

  function dibujarTitulo(bloque, x, yPos) {
    if (!altoTitulo(bloque)) return yPos;
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(x, yPos + 0.6, 1.1, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(...COLOR_DARK);
    doc.text(String(bloque.titulo).toUpperCase(), x + 3, yPos + 4);
    return yPos + 7;
  }

  function filasDeCampos(bloque) {
    const visibles = (bloque.campos || [])
      .map((c) => {
        let valor = c.auto ? valorAutomatico(c.auto, contexto) : c.valor;
        if (c.tipo === 'fecha' && valor) valor = formatDate(valor);
        return { ...c, valor: String(valor ?? '').trim() };
      })
      .filter((c) => c.auto || c.valor);
    const filas = [];
    for (let i = 0; i < visibles.length; i += 1) {
      const c = visibles[i];
      const sig = visibles[i + 1];
      if (c.ancho === 'mitad' && sig && sig.ancho === 'mitad') {
        filas.push([c, sig]);
        i += 1;
      } else {
        filas.push([c]);
      }
    }
    return filas;
  }

  function altoFilaCampos(fila, ancho) {
    doc.setFontSize(8.5);
    const celdas = fila.length;
    const labelW = 40;
    const valorW = ancho / celdas - labelW - 6;
    return Math.max(...fila.map((c) => {
      const lines = doc.splitTextToSize(c.valor || '-', valorW);
      const linesLabel = doc.splitTextToSize(`${c.etiqueta}:`, labelW - 4);
      return Math.max(6, Math.max(lines.length, linesLabel.length) * 4.2 + 1.8);
    }));
  }

  function dibujarFilaCampos(fila, x, yPos, ancho, alto, primera) {
    const celdas = fila.length;
    const anchoCelda = ancho / celdas;
    const labelW = 40;
    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.3);
    if (!primera) doc.line(x, yPos, x + ancho, yPos);
    fila.forEach((c, i) => {
      const cx = x + i * anchoCelda;
      if (i > 0) doc.line(cx, yPos, cx, yPos + alto);
      doc.line(cx + labelW, yPos, cx + labelW, yPos + alto);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLOR_DARK);
      doc.text(doc.splitTextToSize(`${c.etiqueta}:`, labelW - 4), cx + 2.5, yPos + 4.4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_TXT);
      doc.text(doc.splitTextToSize(c.valor || '-', anchoCelda - labelW - 6), cx + labelW + 3, yPos + 4.4);
    });
  }

  function altoCampos(bloque, ancho) {
    return altoTitulo(bloque) + filasDeCampos(bloque).reduce((t, f) => t + altoFilaCampos(f, ancho), 0);
  }

  function dibujarCampos(bloque, x, ancho) {
    const filas = filasDeCampos(bloque);
    if (!filas.length) return;
    asegurar(altoTitulo(bloque) + (filas[0] ? altoFilaCampos(filas[0], ancho) : 0));
    y = dibujarTitulo(bloque, x, y);
    let inicioCaja = y;
    let primera = true;
    for (const fila of filas) {
      const alto = altoFilaCampos(fila, ancho);
      if (y + alto > limiteY) {
        doc.setDrawColor(...COLOR_LINE_SOFT);
        doc.rect(x, inicioCaja, ancho, y - inicioCaja);
        nuevaPagina();
        inicioCaja = y;
        primera = true;
      }
      dibujarFilaCampos(fila, x, y, ancho, alto, primera);
      primera = false;
      y += alto;
    }
    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.3);
    doc.rect(x, inicioCaja, ancho, y - inicioCaja);
  }

  function dibujarTabla(bloque) {
    const columnas = bloque.columnas || [];
    if (!columnas.length) return;
    const filas = (bloque.filas || []).filter((f) => filaConContenido(f, columnas));
    if (!filas.length) return;
    asegurar(altoTitulo(bloque) + 16);
    y = dibujarTitulo(bloque, MARGEN, y);

    const numerar = bloque.numerar !== false;
    const anchoNum = numerar ? 14 : 0;
    const totalPesos = columnas.reduce((t, c) => t + (Number(c.ancho) || 1), 0);
    const disponible = contentW - anchoNum;

    const head = [[...(numerar ? ['Ítem'] : []), ...columnas.map((c) => c.etiqueta || '')]];
    const body = filas.map((f, i) => [
      ...(numerar ? [String(i + 1).padStart(2, '0')] : []),
      ...columnas.map((c) => textoCelda(f.valores?.[c.id], c.tipo))
    ]);
    const columnStyles = {};
    if (numerar) columnStyles[0] = { halign: 'center', cellWidth: anchoNum };
    columnas.forEach((c, i) => {
      const centrado = c.tipo !== 'texto' || c.rol === 'codigo';
      columnStyles[i + (numerar ? 1 : 0)] = {
        cellWidth: (disponible * (Number(c.ancho) || 1)) / totalPesos,
        halign: centrado ? 'center' : 'left',
        ...(c.tipo === 'numero' ? { fontStyle: 'bold' } : {})
      };
    });

    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: INICIO_Y, bottom: pageH - limiteY },
      tableWidth: contentW,
      styles: { fontSize: 7.7, cellPadding: 2.1, lineColor: COLOR_LINE_SOFT, lineWidth: 0.25, textColor: COLOR_TXT, valign: 'middle' },
      headStyles: { fillColor: COLOR_DARK, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.4, valign: 'middle' },
      columnStyles,
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawHeader(true);
      }
    });
    y = doc.lastAutoTable?.finalY || y;
  }

  function lineasLista(bloque) {
    return (bloque.elementos || []).map((t) => String(t || '').trim()).filter(Boolean);
  }

  function altoTarjeta(bloque, ancho) {
    doc.setFontSize(6.45);
    const contenido = lineasLista(bloque).reduce((t, texto) => {
      const wrapped = doc.splitTextToSize(texto, ancho - 11);
      return t + Math.max(5.15, wrapped.length * 3.1 + 1.9);
    }, 0);
    return Math.max(18, 12.8 + contenido + 1.5);
  }

  function dibujarTarjeta(bloque, x, yPos, ancho, alto) {
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, yPos, ancho, alto, 1.6, 1.6, 'FD');
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(x, yPos, ancho, 1.1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...COLOR_DARK);
    doc.text(String(bloque.titulo || '').toUpperCase(), x + 5.5, yPos + 6.7);
    let yy = yPos + 12.8;
    lineasLista(bloque).forEach((texto, index) => {
      if (index > 0) {
        doc.setDrawColor(...CARD_BORDER);
        doc.setLineWidth(0.18);
        doc.line(x + 5.5, yy - 2.35, x + ancho - 5.5, yy - 2.35);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.45);
      doc.setTextColor(...COLOR_TXT);
      const wrapped = doc.splitTextToSize(texto, ancho - 11);
      doc.text(wrapped, x + 5.5, yy);
      yy += Math.max(5.15, wrapped.length * 3.1 + 1.9);
    });
  }

  function lineasDeTexto(bloque, ancho) {
    doc.setFontSize(8);
    if (bloque.tipo === 'texto') return doc.splitTextToSize(String(bloque.contenido || '').trim(), ancho);
    return lineasLista(bloque).flatMap((t) => doc.splitTextToSize(`•  ${t}`, ancho - 2));
  }

  function altoTexto(bloque, ancho) {
    return altoTitulo(bloque) + lineasDeTexto(bloque, ancho).length * 4 + 1;
  }

  function dibujarTexto(bloque, x, ancho) {
    const lineas = lineasDeTexto(bloque, ancho);
    if (!lineas.length) return;
    asegurar(altoTitulo(bloque) + 8);
    y = dibujarTitulo(bloque, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TXT);
    for (const linea of lineas) {
      if (y + 4 > limiteY) nuevaPagina();
      doc.text(linea, x + (bloque.tipo === 'lista' ? 1 : 0), y + 3.2);
      y += 4;
    }
    y += 1;
  }

  function esVacio(bloque) {
    if (bloque.tipo === 'campos') return !filasDeCampos(bloque).length;
    if (bloque.tipo === 'tabla') return !(bloque.filas || []).some((f) => filaConContenido(f, bloque.columnas || []));
    if (bloque.tipo === 'lista') return !lineasLista(bloque).length;
    return !String(bloque.contenido || '').trim();
  }

  function altoBloque(bloque, ancho) {
    if (bloque.tipo === 'campos') return altoCampos(bloque, ancho);
    if (bloque.tipo === 'lista' && bloque.estilo === 'tarjeta') return altoTarjeta(bloque, ancho);
    return altoTexto(bloque, ancho);
  }

  function dibujarBloque(bloque, x, ancho) {
    if (bloque.tipo === 'campos') return dibujarCampos(bloque, x, ancho);
    if (bloque.tipo === 'tabla') return dibujarTabla(bloque);
    if (bloque.tipo === 'lista' && bloque.estilo === 'tarjeta') {
      const alto = altoTarjeta(bloque, ancho);
      asegurar(alto);
      dibujarTarjeta(bloque, x, y, ancho, alto);
      y += alto;
      return undefined;
    }
    return dibujarTexto(bloque, x, ancho);
  }

  drawHeader(false);
  const bloques = bloquesDeSolicitud(solicitud).filter((b) => !esVacio(b));

  for (let i = 0; i < bloques.length; i += 1) {
    const bloque = bloques[i];
    const sig = bloques[i + 1];
    if (i > 0) y += SEPARACION;
    const emparejable = (b) => b && b.ancho === 'mitad' && b.tipo !== 'tabla';
    if (emparejable(bloque) && emparejable(sig)) {
      const anchoMitad = (contentW - GAP_COLUMNAS) / 2;
      const alto = Math.max(altoBloque(bloque, anchoMitad), altoBloque(sig, anchoMitad));
      if (alto <= limiteY - INICIO_Y) {
        asegurar(alto);
        const yInicio = y;
        [bloque, sig].forEach((b, k) => {
          y = yInicio;
          const x = MARGEN + k * (anchoMitad + GAP_COLUMNAS);
          if (b.tipo === 'lista' && b.estilo === 'tarjeta') dibujarTarjeta(b, x, yInicio, anchoMitad, alto);
          else dibujarBloque(b, x, anchoMitad);
        });
        y = yInicio + alto;
        i += 1;
        continue;
      }
    }
    dibujarBloque(bloque, MARGEN, contentW);
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.25);
    doc.line(MARGEN, pageH - 12, pageW - MARGEN, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_TXT_SOFT);
    doc.text(`Página ${i} de ${totalPages}`, pageW - MARGEN, pageH - 7.8, { align: 'right' });
  }

  return doc;
}

export function pdfSolicitudBytes(solicitud, config) {
  return generarPDFSolicitud(solicitud, config).output('arraybuffer');
}

function nombreArchivoSolicitud(solicitud = {}) {
  const fecha = (() => {
    const d = new Date(solicitud.fechaEmision || solicitud.fecha || solicitud.createdAt || Date.now());
    return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  })();
  const referencia = String(valorCampo(bloquesDeSolicitud(solicitud), 'asunto') || solicitud.asunto || solicitud.plantillaNombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .reduce((acc, parte) => (`${acc}-${parte}`.length <= 41 ? `${acc}-${parte}` : acc), '')
    .slice(1);
  return `solicitud-cotizacion-${referencia ? `${referencia}-` : ''}${fecha}.pdf`;
}

export function downloadSolicitudPDF(solicitud, config) {
  generarPDFSolicitud(solicitud, config).save(nombreArchivoSolicitud(solicitud));
}
