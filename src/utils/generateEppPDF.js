import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './formatDate';
import { calcularTotalesCotizacion } from './formatCurrency';
import { montoEnLetras } from './numeroALetras';

import noovaLogo from '../assets/noova-logo.png';
import interbankImg from '../assets/interbank.png';

// ============================================================
// PDF DE COTIZACIÓN DE EPP — FORMATO TIPO FACTURA (Noova S.A.C.)
// ------------------------------------------------------------
// Reproduce la disposición visual de una factura peruana
// (cabecera con logo + datos del emisor, recuadro del documento,
// grilla de datos del cliente, tabla de ítems Cantidad / Unidad /
// Código / Descripción / Valor Unitario / Subtotal, monto en
// letras y recuadro de totales), PERO como COTIZACIÓN de Noova:
//
//   - Es un documento NO tributario: se rotula como COTIZACIÓN y
//     lleva la leyenda correspondiente. No imita una factura
//     electrónica de SUNAT (no incluye hash de resumen, QR ni
//     código de barras oficiales).
//   - Usa el logo y los datos de NUESTRA empresa (Noova). Los
//     datos vienen de configuracion/general y, si faltan, se usan
//     los valores conocidos de Noova como respaldo.
//   - Las cuentas bancarias son las de Noova (nunca las del
//     proveedor de la factura de compra).
//   - Soporta precios con IGV incluido (para replicar importes
//     redondos de factura) o precios sin IGV (estándar).
// ============================================================

// Datos de respaldo de Noova por si configuracion/general aún no
// tiene la empresa cargada. Se sobrescriben con lo que haya en config.
const NOOVA_FALLBACK = {
  razonSocial: 'CONTRATISTAS GENERALES NOOVA S.A.C.',
  ruc: '20550622930',
  direccion: 'Av. Cristóbal de Peralta Norte Nro. 110 Int. 702, Urb. Valle Hermoso de Monterrico, Santiago de Surco, Lima - Lima',
  establecimiento: '',
  celular: '',
  email: '',
  web: ''
};

// Cuentas bancarias de Noova (respaldo). Si config trae cuentas
// estructuradas se usan esas; si no, estas.
const NOOVA_BANCOS = [
  {
    logo: interbankImg,
    nombre: 'Interbank',
    cuentas: [
      { moneda: 'Soles', numero: '898-3003796684', cci: '003-898-003003796684-40' },
      { moneda: 'Dólares', numero: '898-3003796691', cci: '003-898-003003796691-45' },
    ],
  },
];

const COLOR_DARK = [31, 55, 75];      // Slate para encabezados de tabla / recuadros
const COLOR_ACCENT = [244, 122, 0];   // Naranja Noova para el rótulo del documento
const COLOR_LINE = [150, 150, 150];
const COLOR_LINE_SOFT = [205, 205, 205];
const COLOR_TXT = [30, 30, 30];
const COLOR_TXT_SOFT = [95, 95, 95];

function etiquetaMoneda(codigo) {
  const c = String(codigo || '').toUpperCase();
  if (c === 'S/' || c === 'PEN' || c === 'SOLES') return 'S/';
  if (c === 'US$' || c === 'USD' || c === '$' || c === 'DÓLARES' || c === 'DOLARES') return 'US$';
  return 'S/';
}

function nombreMoneda(codigo) {
  return etiquetaMoneda(codigo) === 'S/' ? 'SOLES' : 'DÓLARES AMERICANOS';
}

function fmt(monto, codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  const locale = etiqueta === 'S/' ? 'es-PE' : 'en-US';
  const numero = Number(monto || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${etiqueta} ${numero}`;
}

function fmtNum(monto, codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  const locale = etiqueta === 'S/' ? 'es-PE' : 'en-US';
  return Number(monto || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Cuentas bancarias efectivas: config.cuentas (array) o respaldo Noova.
function obtenerBancos(config) {
  const empresa = config?.empresa || {};
  const cuentas = empresa.cuentas || config?.cuentas;
  if (Array.isArray(cuentas) && cuentas.length > 0) {
    return cuentas.map((b) => ({
      logo: b.logo || null,
      nombre: b.nombre || b.banco || 'Banco',
      cuentas: Array.isArray(b.cuentas)
        ? b.cuentas
        : [{ moneda: b.moneda || 'Soles', numero: b.numero || b.cuenta || '', cci: b.cci || '' }]
    }));
  }
  return NOOVA_BANCOS;
}

export function generateEppPDF(cotizacion, config = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - 2 * margin;

  const empresa = { ...NOOVA_FALLBACK, ...(config?.empresa || {}) };
  // No permitir que un valor vacío del config borre el respaldo de Noova.
  const emp = {
    razonSocial: empresa.razonSocial || NOOVA_FALLBACK.razonSocial,
    ruc: empresa.ruc || NOOVA_FALLBACK.ruc,
    direccion: empresa.direccion || NOOVA_FALLBACK.direccion,
    establecimiento: empresa.establecimiento || empresa.direccion || NOOVA_FALLBACK.direccion,
    celular: empresa.celular || empresa.telefono || '',
    email: empresa.email || '',
    web: empresa.web || ''
  };

  const cliente = cotizacion.cliente || {};
  const contacto =
    cotizacion.contactoSeleccionado ||
    cliente.contactoSeleccionado ||
    (cliente.contactos && cliente.contactos.length > 0 ? cliente.contactos[0] : {}) ||
    {};

  const items = cotizacion.items || [];
  const monedaCod = cotizacion.moneda;
  const totales = calcularTotalesCotizacion(items, {
    sinIGV: !!cotizacion.sinIGV,
    preciosIncluyenIGV: !!cotizacion.preciosIncluyenIGV
  });

  const fechaEmision = cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt;
  const condicionPago = cotizacion.condicionPago || 'Contado';
  const observacion = cotizacion.observacion || '';

  const HEADER_H = 34; // altura reservada para la cabecera en cada página

  // --------------------------------------------------------
  // Cabecera: logo + datos del emisor (izq) y recuadro del
  // documento (der). `compacta` para páginas de continuación.
  // --------------------------------------------------------
  function drawHeader(compacta = false) {
    const top = 10;
    // Logo
    const logoSize = compacta ? 14 : 20;
    try {
      doc.addImage(noovaLogo, 'PNG', margin, top, logoSize, logoSize);
    } catch { /* si el logo no carga, se omite sin romper el PDF */ }

    const infoX = margin + logoSize + 4;
    const infoW = contentW - logoSize - 4 - 62; // deja 62mm para el recuadro derecho

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacta ? 9 : 11);
    doc.setTextColor(...COLOR_DARK);
    const razonLines = doc.splitTextToSize(emp.razonSocial, infoW);
    doc.text(razonLines, infoX, top + (compacta ? 4 : 5));

    if (!compacta) {
      let yInfo = top + 5 + razonLines.length * 4.4 + 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_TXT_SOFT);
      const dirLines = doc.splitTextToSize(emp.direccion, infoW);
      doc.text(dirLines, infoX, yInfo);
      yInfo += dirLines.length * 3.4 + 0.5;
      const contactoLinea = [
        emp.celular ? `Cel.: ${emp.celular}` : '',
        emp.email ? `Email: ${emp.email}` : '',
        emp.web ? emp.web : ''
      ].filter(Boolean).join('   ');
      if (contactoLinea) {
        doc.text(doc.splitTextToSize(contactoLinea, infoW), infoX, yInfo);
      }
    }

    // Recuadro del documento (derecha)
    const boxW = 60;
    const boxX = pageW - margin - boxW;
    const boxH = compacta ? 16 : 24;
    doc.setDrawColor(...COLOR_DARK);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, top, boxW, boxH, 1.5, 1.5);

    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(boxX, top, boxW, compacta ? 6 : 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacta ? 8.5 : 10);
    doc.setTextColor(255, 255, 255);
    doc.text('COTIZACIÓN', boxX + boxW / 2, top + (compacta ? 4.1 : 5.4), { align: 'center' });

    doc.setTextColor(...COLOR_DARK);
    doc.setFontSize(compacta ? 7.5 : 9);
    doc.text(`RUC: ${emp.ruc}`, boxX + boxW / 2, top + (compacta ? 10 : 14), { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacta ? 8.5 : 11);
    doc.setTextColor(...COLOR_ACCENT);
    doc.text(String(cotizacion.codigo || 'S/N'), boxX + boxW / 2, top + (compacta ? 14 : 20), { align: 'center' });

    // Línea separadora bajo la cabecera
    doc.setDrawColor(...COLOR_DARK);
    doc.setLineWidth(0.4);
    doc.line(margin, top + HEADER_H - 4, pageW - margin, top + HEADER_H - 4);
  }

  // --------------------------------------------------------
  // Grilla de datos del cliente (tipo factura).
  // --------------------------------------------------------
  function drawMetaBox(y) {
    const labelW = 40;
    const rows = [
      ['Condición de pago', condicionPago],
      ['Fecha de Emisión', formatDate(fechaEmision)],
      ['Señor(es)', cliente.razonSocial || contacto.nombre || '-'],
      ['RUC', cliente.ruc || '-'],
      ['Dirección', cliente.direccion || '-'],
      ['Tipo de Moneda', nombreMoneda(monedaCod)],
    ];
    if (observacion) rows.push(['Observación', observacion]);

    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.3);

    let yy = y;
    doc.setFontSize(8.5);
    const rowHeights = rows.map(([, value]) => {
      const lines = doc.splitTextToSize(String(value || '-'), contentW - labelW - 6);
      return Math.max(6, lines.length * 4.2 + 1.8);
    });
    const totalH = rowHeights.reduce((a, b) => a + b, 0);

    // Marco exterior + separador vertical de la columna de etiquetas
    doc.rect(margin, y, contentW, totalH);
    doc.line(margin + labelW, y, margin + labelW, y + totalH);

    rows.forEach(([label, value], i) => {
      const h = rowHeights[i];
      // separadores horizontales
      if (i > 0) doc.line(margin, yy, margin + contentW, yy);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_DARK);
      doc.text(`${label}:`, margin + 2.5, yy + 4.4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_TXT);
      const lines = doc.splitTextToSize(String(value || '-'), contentW - labelW - 6);
      doc.text(lines, margin + labelW + 3, yy + 4.4);
      yy += h;
    });

    return y + totalH;
  }

  // ---- Página 1: cabecera + datos del cliente ----
  drawHeader(false);
  let y = 10 + HEADER_H;
  y = drawMetaBox(y) + 4;

  // --------------------------------------------------------
  // Tabla de ítems (Cantidad / Unidad / Código / Descripción /
  // Valor Unitario / Subtotal). El subtotal de línea = cant x VU.
  // --------------------------------------------------------
  const head = [[
    'Cantidad',
    'Unidad\nMedida',
    'Código',
    'Descripción',
    `Valor Unitario\n(${etiquetaMoneda(monedaCod)})`,
    `Subtotal\n(${etiquetaMoneda(monedaCod)})`
  ]];

  const body = items.map((item) => {
    const cant = Number(item.cantidad) || 0;
    const pu = Number(item.precioUnitario) || 0;
    const detalleExtra = [item.marca, item.modelo].filter(Boolean).join(' · ');
    const descripcion = detalleExtra
      ? `${item.descripcion || ''}\n${detalleExtra}`
      : (item.descripcion || '');
    return [
      cant.toFixed(2),
      item.unidadMedida || 'UNIDAD',
      item.codigo || '',
      descripcion,
      fmtNum(pu, monedaCod),
      fmtNum(cant * pu, monedaCod),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin, top: 10 + HEADER_H },
    tableWidth: contentW,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: COLOR_LINE_SOFT,
      lineWidth: 0.25,
      textColor: COLOR_TXT,
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLOR_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 'auto' },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 30 },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(true);
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 4;

  // --------------------------------------------------------
  // Salto de página si no hay espacio para totales + firma.
  // --------------------------------------------------------
  const BLOQUE_FINAL_H = 78;
  function asegurarEspacio(alto) {
    if (y + alto > pageH - 20) {
      doc.addPage();
      drawHeader(true);
      y = 10 + HEADER_H;
    }
  }
  asegurarEspacio(BLOQUE_FINAL_H);

  // --------------------------------------------------------
  // Recuadro de totales (derecha) + monto en letras (izquierda).
  // --------------------------------------------------------
  const totW = 66;
  const totX = pageW - margin - totW;
  const rowH = 6.2;
  const filasTot = [];
  filasTot.push(['Sub Total Ventas', fmt(totales.valorVenta, monedaCod)]);
  filasTot.push(['Descuentos', fmt(0, monedaCod)]);
  filasTot.push(['Valor Venta', fmt(totales.valorVenta, monedaCod)]);
  if (!cotizacion.sinIGV) filasTot.push(['I.G.V. (18%)', fmt(totales.igv, monedaCod)]);

  const yTot = y;
  doc.setDrawColor(...COLOR_LINE);
  doc.setLineWidth(0.3);
  doc.setFontSize(8.5);
  let yr = yTot;
  filasTot.forEach(([label, valor]) => {
    doc.rect(totX, yr, totW, rowH);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TXT);
    doc.text(label, totX + 2.5, yr + 4.2);
    doc.text(valor, totX + totW - 2.5, yr + 4.2, { align: 'right' });
    yr += rowH;
  });
  // Importe total destacado
  doc.setFillColor(...COLOR_DARK);
  doc.rect(totX, yr, totW, rowH + 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('IMPORTE TOTAL', totX + 2.5, yr + 4.8);
  doc.text(fmt(totales.total, monedaCod), totX + totW - 2.5, yr + 4.8, { align: 'right' });
  yr += rowH + 1;

  // Monto en letras (izquierda), alineado con el recuadro de totales
  const letrasW = totX - margin - 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_DARK);
  const letras = `${montoEnLetras(totales.total, monedaCod)}`;
  const letrasLines = doc.splitTextToSize(letras, letrasW);
  doc.text(letrasLines, margin, yTot + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_TXT_SOFT);
  doc.text(
    doc.splitTextToSize('Cotización — documento no tributario. No válido como comprobante de pago.', letrasW),
    margin,
    yTot + 4.2 + letrasLines.length * 4 + 2
  );

  y = Math.max(yr, yTot + 22) + 6;

  // --------------------------------------------------------
  // Condiciones comerciales (breves).
  // --------------------------------------------------------
  const validez = cotizacion.validez || '15 días';
  const tiempoEntrega = cotizacion.tiempoEntrega
    || (cotizacion.tiempoEntregaNumero
      ? `${cotizacion.tiempoEntregaNumero} ${cotizacion.tiempoEntregaUnidad || 'semanas'} recibida la OC`
      : '');
  const condiciones = [
    `• Validez de la oferta: ${validez}.`,
    tiempoEntrega ? `• Tiempo de entrega: ${tiempoEntrega}.` : '',
    '• Para la atención del pedido se solicita el envío de la Orden de Compra.',
    '• Precios incluyen IGV según se indique. Sujeto a disponibilidad de stock.'
  ].filter(Boolean);

  asegurarEspacio(condiciones.length * 4.2 + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_DARK);
  doc.text('CONDICIONES COMERCIALES', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...COLOR_TXT);
  condiciones.forEach((c) => {
    const lines = doc.splitTextToSize(c, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 3.8;
  });
  y += 4;

  // --------------------------------------------------------
  // Cuentas bancarias de Noova.
  // --------------------------------------------------------
  const bancos = obtenerBancos(config);
  asegurarEspacio(18 + bancos.length * 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_DARK);
  doc.text('CUENTAS BANCARIAS', margin, y);
  y += 3;

  bancos.forEach((banco) => {
    if (banco.logo) {
      try { doc.addImage(banco.logo, 'PNG', margin, y, 34, 11); } catch { /* omitir logo */ }
    }
    const headRow = [banco.nombre.toUpperCase(), 'MONEDA', 'N° CUENTA', 'CCI'];
    const bodyRows = (banco.cuentas || []).map((c) => [
      'Cuenta Corriente', c.moneda || '', c.numero || '-', c.cci || '-'
    ]);
    autoTable(doc, {
      startY: y + (banco.logo ? 12 : 0),
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [headRow],
      body: bodyRows,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        lineColor: COLOR_LINE_SOFT,
        lineWidth: 0.25,
        textColor: COLOR_TXT,
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLOR_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 48, halign: 'center' },
        3: { cellWidth: 58, halign: 'center' },
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 5;
  });

  // --------------------------------------------------------
  // Pie: numeración de páginas + leyenda del emisor.
  // --------------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_TXT_SOFT);
    doc.text(`${emp.razonSocial}  ·  RUC ${emp.ruc}`, margin, pageH - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  return doc;
}

export function downloadEppPDF(cotizacion, config) {
  const doc = generateEppPDF(cotizacion, config);
  doc.save(`${cotizacion.codigo || 'cotizacion-epp'}.pdf`);
}
