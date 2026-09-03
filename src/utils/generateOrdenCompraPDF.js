import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import noovaLogoUrl from '../assets/noova-logo.png';
import firmaAlfredoUrl from '../assets/firmas/ing.alfredoleon.jpeg';
import firmaElenaUrl from '../assets/firmas/ingelena.jpeg';
import firmaGianfrancoUrl from '../assets/firmas/gianfranco.jpeg';
import { formatDate } from './formatDate';
import { numeroALetrasOrden } from './ordenCompra';

const AZUL = [8, 67, 104];
const CELESTE = [14, 174, 226];
const GRIS = [227, 235, 240];

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function dibujarFirmaAjustada(doc, imagen, boxX, boxY, boxW, boxH) {
  if (!imagen) return;
  const ratio = imagen.naturalWidth / imagen.naturalHeight;
  let w = boxW;
  let h = w / ratio;
  if (h > boxH) {
    h = boxH;
    w = h * ratio;
  }
  const x = boxX + (boxW - w) / 2;
  const y = boxY + (boxH - h) / 2;
  doc.addImage(imagen, 'JPEG', x, y, w, h, undefined, 'FAST');
}

function poligono(doc, puntos, color) {
  doc.setFillColor(...color);
  const deltas = puntos.slice(1).map((p, i) => {
    const prev = puntos[i];
    return [p[0] - prev[0], p[1] - prev[1]];
  });
  doc.lines(deltas, puntos[0][0], puntos[0][1], [1, 1], 'F', true);
}

function texto(doc, value, x, y, options = {}) {
  const { bold = false, size = 8, color = [20, 20, 20], ...rest } = options;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(value ?? ''), x, y, rest);
}

function dibujarMarca(doc, empresa, logo) {
  const bannerBottomY = 17;
  const xTopBanner = 108;
  const xAtBannerBottom = 103.8;

  doc.setFillColor(...AZUL);
  doc.lines(
    [
      [xTopBanner - 8, 0],
      [xAtBannerBottom - xTopBanner, bannerBottomY - 10],
      [8 - xAtBannerBottom, 0]
    ],
    8, 10, [1, 1], 'F', true
  );

  doc.setFillColor(...CELESTE);
  doc.rect(112, 10, 90, 30, 'F');
  doc.triangle(112, 10, 94, 40, 112, 40, 'F');

  doc.addImage(logo, 'PNG', 9, 21, 46, 24, undefined, 'FAST');

  const empresaX = 118;
  texto(doc, (empresa.razonSocial || 'CONTRATISTA GENERALES NOOVA S.A.C.').toUpperCase(), empresaX, 17, { bold: true, size: 8.5, color: [255, 255, 255] });
  texto(doc, `RUC: ${empresa.ruc || ''}`, empresaX, 22.5, { bold: true, size: 8.5, color: [255, 255, 255] });
  const direccion = doc.splitTextToSize((empresa.direccion || '').toUpperCase(), 78);
  direccion.slice(0, 2).forEach((line, index) => texto(doc, line, empresaX, 28 + index * 4.4, { bold: true, size: 8.5, color: [255, 255, 255] }));
  texto(doc, `CELULAR: ${(empresa.celular || empresa.telefono || '').toUpperCase()}`, empresaX, 37.5, { bold: true, size: 8.5, color: [255, 255, 255] });
}

function dibujarFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const barY = pageHeight - 16;
  const barH = 9;
  const yb = barY + barH;
  const celesteTop = barY - 4;
  const azulTop = barY + 3;

  // Celeste: bloque principal, más alto y más ancho que el azul
  poligono(doc, [[8, celesteTop], [120, celesteTop], [108, yb], [8, yb]], CELESTE);
  // Pieza separadora azul: pegada al celeste en toda su altura (mismo ángulo)
  poligono(doc, [[116, azulTop], [126, azulTop], [120, yb], [110, yb]], AZUL);
  // Azul: bloque final, ancho, llega hasta el margen derecho
  poligono(doc, [[128, azulTop], [202, azulTop], [202, yb], [122, yb]], AZUL);

  const iconSize = 7;
  const r = iconSize / 2;
  const iconGap = 10;
  const iconY = celesteTop + (yb - celesteTop - iconSize) / 2 + r;
  let cx = 14 + r;

  // Facebook: círculo blanco + "f" transparente (deja ver el celeste de fondo)
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, iconY, r, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 4.5);
  doc.setTextColor(...CELESTE);
  doc.text('f', cx, iconY + r * 0.42, { align: 'center' });
  cx += iconGap;

  // Instagram: solo el ícono en blanco, sin fondo
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.roundedRect(cx - r * 0.55, iconY - r * 0.55, r * 1.1, r * 1.1, 0.5, 0.5, 'S');
  doc.circle(cx, iconY, r * 0.3, 'S');
  doc.circle(cx + r * 0.4, iconY - r * 0.4, r * 0.08, 'F');
  cx += iconGap;

  // YouTube: rectángulo ovalado blanco + play transparente
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cx - r * 1.15, iconY - r * 0.8, r * 2.3, r * 1.6, r * 0.8, r * 0.8, 'F');
  doc.setFillColor(...CELESTE);
  doc.triangle(cx - r * 0.3, iconY - r * 0.5, cx - r * 0.3, iconY + r * 0.5, cx + r * 0.55, iconY, 'F');
  cx += iconGap;

  // LinkedIn: cuadrado blanco con esquinas redondeadas + "in" transparente
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cx - r, iconY - r, r * 2, r * 2, r * 0.45, r * 0.45, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 4.5);
  doc.setTextColor(...CELESTE);
  doc.text('in', cx, iconY + r * 0.38, { align: 'center' });
}

export async function generateOrdenCompraPDF(orden, config = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const empresa = config.empresa || {};
  const proveedor = orden.proveedor || {};
  const logo = await cargarImagen(noovaLogoUrl);
  const firmaAlfredo = await cargarImagen(firmaAlfredoUrl);
  const firmaElena = await cargarImagen(firmaElenaUrl);
  const firmaGianfranco = await cargarImagen(firmaGianfrancoUrl);
  const FIRMAS_ELABORADOR = { elena: firmaElena, gianfranco: firmaGianfranco };
  const firmaElaborador = FIRMAS_ELABORADOR[orden.firmadoPorId] || null;

  dibujarMarca(doc, empresa, logo);
  texto(doc, `ORDEN DE COMPRA N°: ${orden.codigo || 'PENDIENTE'}`, 105, 54, {
    bold: true,
    size: 11,
    color: [10, 43, 96],
    align: 'center'
  });

  doc.setFillColor(...GRIS);
  doc.rect(8, 63, 100, 36, 'F');
  doc.rect(110, 63, 92, 36, 'F');
  texto(doc, 'PROVEEDOR:', 15, 71, { bold: true, size: 7.6, color: [10, 43, 96] });
  const camposProveedor = [
    ['RAZÓN SOCIAL:', proveedor.razonSocial],
    ['RUC:', proveedor.ruc],
    ['CONTACTO:', proveedor.contacto],
    ['DIRECCIÓN:', proveedor.direccion],
    ['TELÉFONO:', proveedor.telefono],
    ['E-MAIL:', proveedor.email]
  ];
  camposProveedor.forEach(([label, value], index) => {
    const y = 77 + index * 3.7;
    texto(doc, label, 21, y, { bold: true, size: 7, color: [70, 70, 70] });
    const limite = index === 3 ? 58 : 65;
    texto(doc, String(value || '-').slice(0, limite).toUpperCase(), 46, y, { bold: true, size: 7 });
  });
  texto(doc, `FECHA:  ${formatDate(orden.fecha)}`, 118, 77, { bold: true, size: 7.8 });
  texto(doc, `TIPO DE MONEDA:  ${(orden.moneda === 'S/' ? 'Soles' : 'Dólares americanos').toUpperCase()}`, 118, 85, { bold: true, size: 7.8 });

  doc.setFillColor(...GRIS);
  doc.rect(8, 102, 194, 26, 'F');
  texto(doc, 'CONDICIONES DE COMPRA:', 15, 110, { bold: true, size: 7.6, color: [10, 43, 96] });
  texto(doc, 'FORMA DE PAGO:', 21, 116, { bold: true, size: 7.4, color: [70, 70, 70] });
  texto(doc, (orden.formaPago || '-').toUpperCase(), 52, 116, { bold: true, size: 7.4 });
  texto(doc, 'LUGAR DE ENTREGA:', 21, 121, { bold: true, size: 7.4, color: [70, 70, 70] });
  texto(doc, String(orden.lugarEntrega || '-').slice(0, 105).toUpperCase(), 52, 121, { bold: true, size: 7 });
  texto(doc, 'REFERENCIA:', 21, 126, { bold: true, size: 7.4, color: [70, 70, 70] });
  texto(doc, (orden.referencia || '-').toUpperCase(), 52, 126, { bold: true, size: 7.4 });

  const simbolo = orden.moneda || 'US$';
  autoTable(doc, {
    startY: 132,
    margin: { left: 8, right: 8, bottom: 58 },
    head: [['ITEM', 'CÓDIGO', 'DESCRIPCIÓN', 'U.M', 'CANT.', 'PRECIO', 'TOTAL']],
    body: (orden.items || []).map((item, index) => [
      String(index + 1).padStart(2, '0'),
      (item.codigo || '-').toUpperCase(),
      (item.descripcion || '').toUpperCase(),
      (item.unidadMedida || 'UND.').toUpperCase(),
      Number(item.cantidad || 0).toFixed(2).replace('.00', ''),
      Number(item.precioUnitario || 0).toFixed(2),
      Number((item.cantidad || 0) * (item.precioUnitario || 0)).toFixed(2)
    ]),
    styles: { font: 'helvetica', fontSize: 7.6, textColor: [30, 30, 30], fillColor: GRIS, lineWidth: 0, cellPadding: 2.4 },
    headStyles: { fillColor: CELESTE, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', minCellHeight: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 80 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' }
    },
    didDrawPage: () => {
      if (doc.internal.getNumberOfPages() > 1) dibujarMarca(doc, empresa, logo);
      dibujarFooter(doc);
    }
  });

  let y = doc.lastAutoTable.finalY + 8;
  if (y > 218) {
    doc.addPage();
    dibujarMarca(doc, empresa, logo);
    y = 55;
  }
  const totalesLabelX = 150;
  const totalesValueX = 200;
  const totalRows = [
    ['SUB-TOTAL', orden.subtotal],
    ['I.G.V. 18%', orden.igv],
    ['TOTAL', orden.total]
  ];
  totalRows.forEach(([label, value], index) => {
    const rowY = y + index * 5.5;
    const esTotal = label === 'TOTAL';
    texto(doc, label, totalesLabelX, rowY, { bold: true, size: esTotal ? 9 : 8, align: 'right' });
    texto(doc, `${simbolo} ${Number(value || 0).toFixed(2)}`, totalesValueX, rowY, { bold: true, size: esTotal ? 9 : 8, align: 'right' });
  });

  texto(doc, `SON: ${numeroALetrasOrden(orden.total, simbolo).toUpperCase()}`, 9, y + 22, { bold: true, size: 8.3 });
  texto(doc, `OBSERVACIONES: ${(orden.observaciones || '-').toUpperCase()}`, 9, y + 28, { bold: true, size: 7.6 });
  if (orden.origenCotizacionCodigo) {
    texto(doc, `Origen interno: ${orden.origenCotizacionCodigo}`, 9, y + 33, { size: 6.3, color: [90, 90, 90] });
  }

  const firmasY = Math.min(216, Math.max(y + 48, 190));
  doc.setFillColor(...CELESTE);
  doc.rect(8, firmasY, 98, 5, 'F');
  doc.rect(110, firmasY, 92, 5, 'F');
  texto(doc, 'ELABORADO POR:', 57, firmasY + 3.5, { bold: true, size: 7.6, color: [255, 255, 255], align: 'center' });
  texto(doc, 'AUTORIZADO POR:', 156, firmasY + 3.5, { bold: true, size: 7.6, color: [255, 255, 255], align: 'center' });
  dibujarFirmaAjustada(doc, firmaElaborador, 19, firmasY + 6, 76, 36);
  dibujarFirmaAjustada(doc, firmaAlfredo, 118, firmasY + 6, 76, 36);
  doc.setDrawColor(...AZUL);
  doc.line(25, firmasY + 44, 89, firmasY + 44);
  doc.line(126, firmasY + 44, 190, firmasY + 44);
  const ocConfig = config.ordenCompra || {};
  texto(doc, (orden.elaboradoPor || ocConfig.elaboradoPor || '-').toUpperCase(), 57, firmasY + 50, { bold: true, size: 7.6, align: 'center' });
  texto(doc, orden.cargoElaborador || ocConfig.cargoElaborador || '', 57, firmasY + 54.5, { size: 7.2, align: 'center' });
  texto(doc, 'ALFREDO LANDEO LEÓN LANDEO', 156, firmasY + 50, { bold: true, size: 7.6, align: 'center' });
  texto(doc, 'GERENTE GENERAL NOOVA S.A.C.', 156, firmasY + 54.5, { size: 7.2, align: 'center' });
  dibujarFooter(doc);
  return doc;
}

export async function downloadOrdenCompraPDF(orden, config) {
  const doc = await generateOrdenCompraPDF(orden, config);
  doc.save(`${orden.codigo || 'orden-compra'}.pdf`);
}
