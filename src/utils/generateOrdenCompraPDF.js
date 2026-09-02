import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import noovaLogoUrl from '../assets/noova-logo.png';
import { formatDate } from './formatDate';
import { numeroALetrasOrden } from './ordenCompra';

const AZUL = [8, 67, 104];
const CELESTE = [14, 174, 226];
const GRIS = [248, 248, 248];

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function texto(doc, value, x, y, options = {}) {
  const { bold = false, size = 8, color = [20, 20, 20], ...rest } = options;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(value ?? ''), x, y, rest);
}

function dibujarMarca(doc, empresa, logo) {
  doc.setFillColor(...AZUL);
  doc.rect(8, 10, 100, 6, 'F');
  doc.setFillColor(...CELESTE);
  doc.rect(112, 10, 90, 30, 'F');
  doc.triangle(112, 10, 94, 40, 112, 40, 'F');
  doc.addImage(logo, 'PNG', 9, 18, 40, 20, undefined, 'FAST');

  const empresaX = 112;
  texto(doc, empresa.razonSocial || 'CONTRATISTA GENERALES NOOVA S.A.C.', empresaX, 18, { size: 7.5, color: [255, 255, 255] });
  texto(doc, `RUC: ${empresa.ruc || ''}`, empresaX, 23, { size: 7.5, color: [255, 255, 255] });
  const direccion = doc.splitTextToSize(empresa.direccion || '', 84);
  direccion.slice(0, 2).forEach((line, index) => texto(doc, line, empresaX, 28 + index * 4.2, { size: 7.5, color: [255, 255, 255] }));
  texto(doc, `CELULAR: ${empresa.celular || empresa.telefono || ''}`, empresaX, 37, { size: 7.5, color: [255, 255, 255] });
}

function dibujarFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...CELESTE);
  doc.rect(8, pageHeight - 14, 92, 7, 'F');
  doc.triangle(100, pageHeight - 14, 108, pageHeight - 14, 100, pageHeight - 7, 'F');
  doc.setFillColor(...AZUL);
  doc.rect(114, pageHeight - 11, 88, 4, 'F');
  doc.triangle(109, pageHeight - 7, 114, pageHeight - 11, 114, pageHeight - 7, 'F');
  texto(doc, 'noovaconsulting.com', 12, pageHeight - 9, { size: 6.5, color: [255, 255, 255] });
}

export async function generateOrdenCompraPDF(orden, config = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const empresa = config.empresa || {};
  const proveedor = orden.proveedor || {};
  const logo = await cargarImagen(noovaLogoUrl);

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
  texto(doc, 'PROVEEDOR:', 15, 71, { size: 7, color: [10, 43, 96] });
  const camposProveedor = [
    ['RAZÓN SOCIAL:', proveedor.razonSocial],
    ['RUC:', proveedor.ruc],
    ['CONTACTO:', proveedor.contacto],
    ['DIRECCIÓN:', proveedor.direccion],
    ['TELÉFONO:', proveedor.telefono],
    ['E-MAIL:', proveedor.email]
  ];
  camposProveedor.forEach(([label, value], index) => {
    const y = 77 + index * 3.5;
    texto(doc, label, 21, y, { size: 6.6, color: [70, 70, 70] });
    const limite = index === 3 ? 58 : 65;
    texto(doc, String(value || '-').slice(0, limite), 46, y, { bold: true, size: 6.6 });
  });
  texto(doc, `FECHA:  ${formatDate(orden.fecha)}`, 118, 77, { bold: true, size: 7.2 });
  texto(doc, `TIPO DE MONEDA:  ${orden.moneda === 'S/' ? 'Soles' : 'Dólares americanos'}`, 118, 85, { bold: true, size: 7.2 });

  doc.setFillColor(...GRIS);
  doc.rect(8, 102, 194, 26, 'F');
  texto(doc, 'CONDICIONES DE COMPRA:', 15, 110, { size: 7, color: [10, 43, 96] });
  texto(doc, 'FORMA DE PAGO:', 21, 116, { size: 6.8, color: [70, 70, 70] });
  texto(doc, orden.formaPago || '-', 52, 116, { bold: true, size: 6.8 });
  texto(doc, 'LUGAR DE ENTREGA:', 21, 121, { size: 6.8, color: [70, 70, 70] });
  texto(doc, String(orden.lugarEntrega || '-').slice(0, 105), 52, 121, { bold: true, size: 6.5 });
  texto(doc, 'REFERENCIA:', 21, 126, { size: 6.8, color: [70, 70, 70] });
  texto(doc, orden.referencia || '-', 52, 126, { bold: true, size: 6.8 });

  const simbolo = orden.moneda || 'US$';
  autoTable(doc, {
    startY: 132,
    margin: { left: 8, right: 8, bottom: 58 },
    head: [['ITEM', 'CÓDIGO', 'DESCRIPCIÓN', 'U.M', 'CANT.', 'PRECIO', 'TOTAL']],
    body: (orden.items || []).map((item, index) => [
      String(index + 1).padStart(2, '0'),
      item.codigo || '-',
      item.descripcion || '',
      item.unidadMedida || 'UND.',
      Number(item.cantidad || 0).toFixed(2).replace('.00', ''),
      Number(item.precioUnitario || 0).toFixed(2),
      Number((item.cantidad || 0) * (item.precioUnitario || 0)).toFixed(2)
    ]),
    styles: { font: 'helvetica', fontSize: 7.2, textColor: [30, 30, 30], fillColor: GRIS, lineWidth: 0, cellPadding: 2.2 },
    headStyles: { fillColor: CELESTE, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', minCellHeight: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 77 },
      3: { cellWidth: 14, halign: 'center' },
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
  const totalesX = 145;
  const totalRows = [
    ['SUB-TOTAL', orden.subtotal],
    ['I.G.V. 18%', orden.igv],
    ['TOTAL', orden.total]
  ];
  totalRows.forEach(([label, value], index) => {
    texto(doc, label, totalesX, y + index * 5, { bold: true, size: 7.5, align: 'right' });
    texto(doc, simbolo, 164, y + index * 5, { bold: true, size: 7.5 });
    texto(doc, Number(value || 0).toFixed(2), 197, y + index * 5, { bold: true, size: 7.5, align: 'right' });
  });

  texto(doc, `SON: ${numeroALetrasOrden(orden.total, simbolo)}`, 9, y + 22, { bold: true, size: 7.8 });
  texto(doc, `OBSERVACIONES: ${orden.observaciones || '-'}`, 9, y + 28, { bold: true, size: 7 });
  if (orden.origenCotizacionCodigo) {
    texto(doc, `Origen interno: ${orden.origenCotizacionCodigo}`, 9, y + 33, { size: 6.3, color: [90, 90, 90] });
  }

  const firmasY = Math.min(258, Math.max(y + 48, 235));
  doc.setFillColor(...CELESTE);
  doc.rect(8, firmasY, 98, 5, 'F');
  doc.rect(110, firmasY, 92, 5, 'F');
  texto(doc, 'ELABORADO POR:', 57, firmasY + 3.5, { bold: true, size: 6.5, color: [255, 255, 255], align: 'center' });
  texto(doc, 'AUTORIZADO POR:', 156, firmasY + 3.5, { bold: true, size: 6.5, color: [255, 255, 255], align: 'center' });
  doc.setDrawColor(...AZUL);
  doc.line(25, firmasY + 18, 89, firmasY + 18);
  doc.line(126, firmasY + 18, 190, firmasY + 18);
  const ocConfig = config.ordenCompra || {};
  texto(doc, orden.elaboradoPor || ocConfig.elaboradoPor || '-', 57, firmasY + 23, { bold: true, size: 6.5, align: 'center' });
  texto(doc, orden.cargoElaborador || ocConfig.cargoElaborador || '', 57, firmasY + 27, { size: 6.2, align: 'center' });
  texto(doc, orden.autorizadoPor || ocConfig.autorizadoPor || '-', 156, firmasY + 23, { bold: true, size: 6.5, align: 'center' });
  texto(doc, orden.cargoAutorizador || ocConfig.cargoAutorizador || '', 156, firmasY + 27, { size: 6.2, align: 'center' });
  dibujarFooter(doc);
  return doc;
}

export async function downloadOrdenCompraPDF(orden, config) {
  const doc = await generateOrdenCompraPDF(orden, config);
  doc.save(`${orden.codigo || 'orden-compra'}.pdf`);
}
