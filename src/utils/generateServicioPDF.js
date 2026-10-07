import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './formatDate';
import { calcularSubtotal, calcularIGV, calcularTotal } from './formatCurrency';

import headerImg from '../assets/header.png';
import footerImg from '../assets/footer.png';
import interbankImg from '../assets/interbank.png';

const IMG_FULL_HEADER = headerImg;
const IMG_FULL_FOOTER = footerImg;

const BANCOS_PDF = [
  {
    logo: interbankImg,
    nombre: 'Interbank',
    cuentas: [
      { tipo: 'Cuenta Corriente', moneda: 'Soles', numero: '898-3003796684', cci: '003-898-003003796684-40' },
      { tipo: 'Cuenta Corriente', moneda: 'Dólares', numero: '898-3003796691', cci: '003-898-003003796691-45' },
    ],
  },
];

const INCLUYE_SERVICIO = [
  'Personal técnico especializado',
  'Supervisión y reporte de resultados',
  'Cumplimiento de normativas vigentes'
];

function etiquetaMoneda(codigo) {
  if (!codigo) return 'US$';
  const c = String(codigo).toUpperCase();
  if (c === 'S/' || c === 'PEN' || c === 'SOLES') return 'S/';
  return 'US$';
}

function formatoMonto(monto, codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  const locale = etiqueta === 'S/' ? 'es-PE' : 'en-US';
  const numero = Number(monto || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${etiqueta} ${numero}`;
}

function formatoNumero(monto, codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  const locale = etiqueta === 'S/' ? 'es-PE' : 'en-US';
  return Number(monto || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function drawFieldRow(doc, x, y, label, value, labelW = 24, contentW = 182) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(label + ':', x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const maxW = contentW - labelW;
  const lines = doc.splitTextToSize(String(value || ''), maxW);
  doc.text(lines, x + labelW, y);

  return lines.length * 4.8;
}

function generateServicioPDF(cotizacion, config = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  let y = 30;

  const COLOR_ORANGE = [244, 122, 0];
  const COLOR_TEAL = [20, 74, 99];
  const COLOR_BORDER = [180, 180, 180];

  const empresa = config?.empresa || {};
  const razonSocial = empresa.razonSocial || '';
  const ruc = empresa.ruc || '';
  const direccion = empresa.direccion || '';
  const lemaAnual = empresa.lemaAnual || '';
  const celularEmpresa = empresa.celular || empresa.telefono || '';

  const responsable = cotizacion.responsable || '';
  const cargoResponsable = cotizacion.cargoResponsable || '';
  const emailResponsable = cotizacion.emailResponsable || '';
  const telefonoResponsable = cotizacion.telefonoResponsable || '';

  const moneda = etiquetaMoneda(cotizacion.moneda);
  const validez = cotizacion.validez || '15 días';
  const condicionPago = cotizacion.condicionPago || 'Contado';
  const tiempoEntrega = cotizacion.tiempoEntrega
    || (cotizacion.tiempoEntregaNumero && cotizacion.tiempoEntregaUnidad
      ? `${cotizacion.tiempoEntregaNumero} ${cotizacion.tiempoEntregaUnidad} recibida la OC`
      : '03 semanas recibida la OC');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`"${lemaAnual}"`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  const headerBoxH = 8;
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(margin, y, contentW, headerBoxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`COTIZACIÓN: ${cotizacion.codigo || ''}`, margin + 4, y + 5.5);

  const fechaEmision = cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt;
  const fechaFormatted = formatDate(fechaEmision);
  doc.text(`FECHA:  ${fechaFormatted}`, pageWidth - margin - 4, y + 5.5, { align: 'right' });

  y += headerBoxH + 7;

  y += drawFieldRow(doc, margin, y, 'Proveedor', razonSocial);
  y += drawFieldRow(doc, margin, y, 'RUC', ruc);
  y += drawFieldRow(doc, margin, y, 'Dirección', direccion);
  y += drawFieldRow(doc, margin, y, 'Contacto', responsable);
  y += drawFieldRow(doc, margin, y, 'Celular', telefonoResponsable || celularEmpresa);
  y += drawFieldRow(doc, margin, y, 'E-mail', emailResponsable);

  y -= 1;
  doc.setDrawColor(...COLOR_TEAL);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  y += 2;

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DATOS DEL CLIENTE', margin + contentW / 2, y + 4.8, { align: 'center' });
  y += 7 + 4;

  const cliente = cotizacion.cliente || {};
  const contactoSeleccionado =
    cotizacion.contactoSeleccionado ||
    cliente.contactoSeleccionado ||
    (cliente.contactos && cliente.contactos.length > 0 ? cliente.contactos[0] : {}) ||
    {};

  y += drawFieldRow(doc, margin, y, 'Cliente', cliente.razonSocial);
  y += drawFieldRow(doc, margin, y, 'RUC', cliente.ruc);
  y += drawFieldRow(doc, margin, y, 'Dirección', cliente.direccion);
  y += drawFieldRow(doc, margin, y, 'Contacto', contactoSeleccionado.nombre || cliente.contacto);
  y += drawFieldRow(doc, margin, y, 'Celular', contactoSeleccionado.celular || cliente.celular || cliente.telefono);
  y += drawFieldRow(doc, margin, y, 'E-mail', contactoSeleccionado.email || cliente.email);

  y -= 1;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const todosLosItems = cotizacion.items || [];
  const tableHeaders = [
    ['ITEM', 'CÓDIGO', 'DESCRIPCIÓN', 'UNIDAD', 'CANT.', `PRECIO UNIT.\n(${moneda})`, `TOTAL\n(${moneda})`],
  ];

  const tableData = todosLosItems.map((item, index) => [
    (index + 1).toString(),
    item.codigo || '',
    item.descripcion || '',
    item.unidadMedida || 'SERVICIO',
    (Number(item.cantidad) || 0).toFixed(2),
    formatoNumero(item.precioUnitario || 0, cotizacion.moneda),
    formatoNumero((Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), cotizacion.moneda),
  ]);

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: y,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: COLOR_BORDER,
      lineWidth: 0.3,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: COLOR_TEAL,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      minCellHeight: 9,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 13, cellPadding: { top: 3, right: 1, bottom: 3, left: 1 } },
      1: { halign: 'center', cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 25 },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 4;

  const subtotal = calcularSubtotal(todosLosItems);
  const sinIGV = !!cotizacion.sinIGV;
  const igv = sinIGV ? 0 : calcularIGV(subtotal);
  const total = sinIGV ? subtotal : calcularTotal(subtotal);

  const totW = 65;
  const totX = pageWidth - margin - totW;
  const totRowH = 6;

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.setFontSize(8.5);

  doc.rect(totX, y, totW, totRowH);
  doc.setFont('helvetica', 'normal');
  doc.text('SUB-TOTAL', totX + 3, y + 4.2);
  doc.text(formatoMonto(subtotal, cotizacion.moneda), totX + totW - 3, y + 4.2, { align: 'right' });
  y += totRowH;

  if (!sinIGV) {
    doc.rect(totX, y, totW, totRowH);
    doc.text('I.G.V. 18%', totX + 3, y + 4.2);
    doc.text(formatoMonto(igv, cotizacion.moneda), totX + totW - 3, y + 4.2, { align: 'right' });
    y += totRowH;
  }

  doc.rect(totX, y, totW, totRowH);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totX + 3, y + 4.2);
  doc.text(formatoMonto(total, cotizacion.moneda), totX + totW - 3, y + 4.2, { align: 'right' });
  y += totRowH + 6;

  {
    const incluyeItems = INCLUYE_SERVICIO;

    doc.setFillColor(...COLOR_TEAL);
    doc.rect(margin, y, contentW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('INCLUYE:', margin + contentW / 2, y + 4.5, { align: 'center' });
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const incluyeBodyH = incluyeItems.length * 5 + 4;
    doc.setDrawColor(...COLOR_BORDER);
    doc.rect(margin, y, contentW, incluyeBodyH);

    let yItem = y + 5.5;
    incluyeItems.forEach((txt) => {
      const lines = doc.splitTextToSize(`•  ${txt}`, contentW - 8);
      doc.text(lines, margin + 4, yItem);
      yItem += 5;
    });

    y += incluyeBodyH;
  }

  doc.addPage();
  y = 30;

  const itemsConEntrega = todosLosItems.filter((it) => it.tipo !== 'transporte');
  const tiemposEntregaItems = itemsConEntrega.map((it) => (it.tiempoEntrega || '').trim()).filter(Boolean);
  const tiemposUnicos = [...new Set(tiemposEntregaItems)];
  const lineasTiempoEntrega = [];
  if (tiemposUnicos.length <= 1) {
    lineasTiempoEntrega.push(`3.- Inicio del servicio: ${tiemposUnicos[0] || tiempoEntrega}.`);
  } else {
    itemsConEntrega.forEach((it, idx) => {
      lineasTiempoEntrega.push(`3.${idx + 1}.- Inicio del servicio ítem ${idx + 1} (${it.codigo || it.descripcion || ''}): ${(it.tiempoEntrega || tiempoEntrega)}.`);
    });
  }

  const condiciones = [
    `1.- Moneda: ${moneda === 'S/' ? 'Soles (S/).' : 'dólares americanos.'}`,
    `2.- Forma de Pago: ${condicionPago}.`,
    ...lineasTiempoEntrega,
    `4.- Validez de Oferta: ${validez}.`,
    '5.- Observación: Para la atención del servicio se solicita el envío de la OC. por parte del cliente.',
    `6.- Lugar de prestación: ${String(direccion || '').trim().replace(/\.+$/, '')}.`,
    '7.- Alcance: El servicio se ejecuta según el alcance y cronograma coordinados con el cliente antes de su inicio.',
    '8.- Precios: Los precios son referenciales y pueden ajustarse según el alcance final solicitado.'
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('CONDICIONES DE VENTA:', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);

  for (const cond of condiciones) {
    const condLines = doc.splitTextToSize(cond, contentW);
    doc.text(condLines, margin, y);
    y += condLines.length * 4.2;
  }
  y += 7;

  const logoH = 16;
  const logoW = 50;
  const separacionLogoTabla = 2;
  const separacionBancos = 6;

  BANCOS_PDF.forEach((banco) => {
    doc.addImage(banco.logo, 'PNG', margin, y, logoW, logoH);
    y += logoH + separacionLogoTabla;

    const tieneCCI = banco.cuentas.some(c => c.cci && c.cci.trim() !== '');

    const headRow = tieneCCI
      ? [banco.nombre.toUpperCase(), 'MONEDA', 'N° CUENTA', 'CCI']
      : [banco.nombre.toUpperCase(), 'MONEDA', 'N° CUENTA'];

    const bodyRows = banco.cuentas.map(c => tieneCCI
      ? [c.tipo, c.moneda, c.numero, c.cci || '-']
      : [c.tipo, c.moneda, c.numero]
    );

    const columnStyles = tieneCCI
      ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' },
      }
      : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 'auto', halign: 'center' },
      };

    autoTable(doc, {
      startY: y,
      margin: { left: margin },
      tableWidth: contentW,
      head: [headRow],
      body: bodyRows,
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: COLOR_BORDER,
        lineWidth: 0.3,
        textColor: [30, 30, 30],
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLOR_TEAL,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5,
      },
      columnStyles,
    });

    y = (doc.lastAutoTable?.finalY || y) + separacionBancos;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Sin otro particular, y a la espera de su pronto requerimiento nos suscribimos ante Ud.', margin, y);
  y += 5;
  doc.text('Atentamente,', margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text((responsable || '').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text((cargoResponsable || '').toUpperCase(), pageWidth / 2, y, { align: 'center' });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.addImage(IMG_FULL_HEADER, 'PNG', 0, 0, pageWidth, 22);
    doc.addImage(IMG_FULL_FOOTER, 'PNG', 0, pageHeight - 13, pageWidth, 13);
  }

  return doc;
}

export function downloadServicioPDF(cotizacion, config) {
  const doc = generateServicioPDF(cotizacion, config);
  doc.save(`${cotizacion.codigo || 'cotizacion-servicios'}.pdf`);
}
