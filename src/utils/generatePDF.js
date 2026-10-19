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

function generateCotizacionPDF(cotizacion, config = {}) {
  const doc = new jsPDF({ format:'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  // Header (22 mm) y footer (13 mm) se estampan al final en cada página: el contenido no debe pisarlos.
  const TOPE_SUPERIOR = 30;
  const MARGEN_INFERIOR = 18;
  const LIMITE_INFERIOR = pageHeight - MARGEN_INFERIOR;

  let y = TOPE_SUPERIOR;

  function asegurarEspacio(alto) {
    if (y + alto > LIMITE_INFERIOR) {
      doc.addPage();
      y = TOPE_SUPERIOR;
    }
  }

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
    ['ITEM', 'CÓDIGO', 'DESCRIPCIÓN', 'CANT.', `PRECIO UNIT.\n(${moneda})`, `TOTAL\n(${moneda})`],
  ];

  const tableData = todosLosItems.map((item, index) => [
    (index + 1).toString(),
    item.codigo || '',
    item.descripcion || item.equipo?.nombre || '',
    (Number(item.cantidad) || 0).toFixed(2),
    formatoNumero(item.precioUnitario || 0, cotizacion.moneda),
    formatoNumero((Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), cotizacion.moneda),
  ]);

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: y,
    margin: { top: TOPE_SUPERIOR, left: margin, right: margin, bottom: MARGEN_INFERIOR },
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
      0: { halign: 'center', cellWidth: 17, cellPadding: { top: 3, right: 1, bottom: 3, left: 1 } },
      1: { halign: 'center', cellWidth: 24 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
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
  asegurarEspacio(totRowH * (sinIGV ? 2 : 3));

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
    const incluyeItems = [
      'Protocolo de calibración de fábrica',
      'Garantía oficial Testo',
      'Soporte técnico postventa'
    ];

    const incluyeBodyH = incluyeItems.length * 5 + 4;
    asegurarEspacio(6.5 + incluyeBodyH);

    doc.setFillColor(...COLOR_TEAL);
    doc.rect(margin, y, contentW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('INCLUYE:', margin + contentW / 2, y + 4.5, { align: 'center' });
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
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
  y = TOPE_SUPERIOR;

  const itemsConEntrega = todosLosItems.filter((it) => it.tipo !== 'transporte');
  const tiemposEntregaItems = itemsConEntrega.map((it) => (it.tiempoEntrega || '').trim()).filter(Boolean);
  const tiemposUnicos = [...new Set(tiemposEntregaItems)];
  const lineasTiempoEntrega = [];
  if (tiemposUnicos.length <= 1) {
    lineasTiempoEntrega.push(`3.- Tiempo de entrega: ${tiemposUnicos[0] || tiempoEntrega}.`);
  } else {
    itemsConEntrega.forEach((it, idx) => {
      lineasTiempoEntrega.push(`3.${idx + 1}.- Tiempo de entrega ítem ${idx + 1} (${it.codigo || it.descripcion || ''}): ${(it.tiempoEntrega || tiempoEntrega)}.`);
    });
  }

  const condiciones = [
    `1.- Moneda: ${moneda === 'S/' ? 'Soles (S/).' : 'dólares americanos.'}`,
    `2.- Forma de Pago: ${condicionPago}.`,
    ...lineasTiempoEntrega,
    `4.- Validez de Oferta: ${validez}.`,
    '5.- Observación: Para la atención del pedido se solicita el envío de la OC. por parte del cliente.',
    `6.- Lugar de entrega: ${String(direccion || '').trim().replace(/\.+$/, '')}.`
  ];

  const esCotizacionDeServicios = todosLosItems.length > 0
    && todosLosItems.every((it) => it.tipo === 'transporte');
  if (!esCotizacionDeServicios) {
    condiciones.push(
      '7.- Garantía: NOOVA brinda doce (12) meses de garantía que cubren únicamente defectos de fabricación.',
      '8.- Stock: Sujeto a disponibilidad.',
      '9.- Capacitación: Gratuita online en el uso básico de los equipos.'
    );
  }

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
    asegurarEspacio(condLines.length * 4.2);
    doc.text(condLines, margin, y);
    y += condLines.length * 4.2;
  }
  y += 7;

  const logoH = 16;
  const logoW = 50;
  const separacionLogoTabla = 2;
  const separacionBancos = 6;

  BANCOS_PDF.forEach((banco) => {
    // Logo, cabecera y cuentas deben quedar juntos en la misma página.
    asegurarEspacio(logoH + separacionLogoTabla + 8 + banco.cuentas.length * 7);
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
      margin: { top: TOPE_SUPERIOR, left: margin, bottom: MARGEN_INFERIOR },
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

  asegurarEspacio(5 + 18 + 4.5 + 4);
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

export function downloadCotizacionPDF(cotizacion, config) {
  const doc = generateCotizacionPDF(cotizacion, config);
  doc.save(`${cotizacion.codigo || 'cotizacion'}.pdf`);
}

function numeroALetras(num) {
  num = parseFloat(num);
  if (isNaN(num)) return 'CERO Y 00/100';

  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);

  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince',
                      'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
                   'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos',
                    'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function convertirDecenas(n) {
    if (n < 10) return unidades[n];
    if (n < 20) return especiales[n - 10];
    if (n === 20) return 'veinte';
    if (n < 30) return 'veinti' + unidades[n - 20];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return decenas[d];
    return decenas[d] + ' y ' + unidades[u];
  }

  function convertirCentenas(n) {
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    let resultado = '';
    if (c > 0) resultado = centenas[c];
    if (resto > 0) {
      if (resultado) resultado += ' ';
      resultado += convertirDecenas(resto);
    }
    return resultado;
  }

  function convertirMiles(n) {
    if (n < 1000) return convertirCentenas(n);
    const m = Math.floor(n / 1000);
    const resto = n % 1000;
    let prefijo;
    if (m === 1) prefijo = 'mil';
    else prefijo = convertirCentenas(m) + ' mil';
    if (resto > 0) return prefijo + ' ' + convertirCentenas(resto);
    return prefijo;
  }

  function convertirMillones(n) {
    if (n < 1000000) return convertirMiles(n);
    const mm = Math.floor(n / 1000000);
    const resto = n % 1000000;
    let prefijo;
    if (mm === 1) prefijo = 'un millon';
    else prefijo = convertirMiles(mm) + ' millones';
    if (resto > 0) return prefijo + ' ' + convertirMiles(resto);
    return prefijo;
  }

  let resultado;
  if (entero === 0) {
    resultado = 'cero';
  } else {
    resultado = convertirMillones(entero);
  }

  const decStr = decimales.toString().padStart(2, '0');
  return (resultado + ' Y ' + decStr + '/100').toUpperCase();
}

function generateFacturaPDF(factura, config = {}) {
  const doc = new jsPDF({ format: 'letter', unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 11.5;
  const contentW = pageWidth - 2 * margin;
  const topMargin = 26.5;

  const norm = (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
      .toUpperCase()
      .replace(/OFICINA/g, 'OF.')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const UNIDADES_LITERAL = ['UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'];
  const normalizarUnidad = (u) => {
    if (!u) return 'UNIDAD';
    const upper = String(u).toUpperCase().trim();
    if (UNIDADES_LITERAL.includes(upper)) return upper;
    const sinPunto = upper.replace(/\.$/, '');
    if (UNIDADES_LITERAL.includes(sinPunto + '.')) return sinPunto + '.';
    const map = {
      'LT': 'LT.', 'LITRO': 'LT.', 'LITROS': 'LT.',
      'KG': 'KG.', 'KILOGRAMO': 'KG.', 'KILOS': 'KG.',
      'DOC': 'DOC.', 'DOCENA': 'DOC.', 'DOCE': 'DOC.',
      'PZ': 'PZ.', 'PIEZA': 'PZ.', 'PIEZAS': 'PZ.',
      'EQ': 'EQ.', 'EQUIVALENTE': 'EQ.',
      'M': 'M.', 'METRO': 'M.', 'METROS': 'M.',
      'KIT': 'KIT.',
      '%': '%.', 'PORCENTAJE': '%.',
      'MILL': 'MILL.', 'MILLAR': 'MILL.', 'MILLARES': 'MILL.',
    };
    return map[sinPunto] || upper;
  };

  const empresa = config?.empresa || {};
  const ruc = empresa.ruc || '20550622930';
  const esNoova = !empresa.ruc || String(empresa.ruc) === '20550622930';
  const razonSocial = norm(esNoova
    ? 'CONTRATISTAS GENERALES NOOVA SOCIEDAD ANONIMA CERRADA - NOOVA S.A.C.'
    : empresa.razonSocial || ''
  );
  const direccionEmpresa = norm(esNoova
    ? 'AV. CRISTOBAL DE PERALTA NORT 110 URB. VALLE HERMOSO DE MONTERRI DPTO. 702 - SANTIAGO DE SURCO - LIMA - LIMA'
    : empresa.direccion || ''
  );

  const tipoComprobante = factura.tipo || 'Factura';
  const tipoLabel = String(tipoComprobante).toUpperCase().includes('BOLETA')
    ? 'BOLETA ELECTRONICA'
    : 'FACTURA ELECTRONICA';
  const serie = (factura.serie || '').toUpperCase();
  const numero = factura.numero || '';
  const moneda = etiquetaMoneda(factura.moneda);
  const simboloMoneda = moneda === 'S/' ? 'S/' : '$';
  const nombreMoneda = moneda === 'S/' ? 'SOLES' : 'DOLAR AMERICANO';

  const fechaEmision = factura.fechaEmision || factura.fecha || factura.createdAt;
  const fechaFormatted = formatDate(fechaEmision);
  const formaPago = String(factura.formaPago || 'Contado');
  const guiaRemision = norm(factura.guiaRemision || '');
  const ordenCompra = norm(factura.ordenCompra || '');
  const observacion = norm(factura.observaciones || '');

  const cliente = factura.cliente || {};
  const items = factura.items || [];

  const subTotalVentas = factura.subtotal || 0;
  const anticipos = Number(factura.anticipos) || 0;
  const descuentos = Number(factura.descuentos) || 0;
  const valorVentaGratuita = Number(factura.valorVentaGratuita) || 0;
  const valorVenta = Math.max(0, subTotalVentas - anticipos - descuentos);
  const isc = Number(factura.isc) || 0;
  const igv = Number(factura.igv) || 0;
  const icbperTotal = Number(factura.icbper) || 0;
  const otrosCargos = Number(factura.otrosCargos) || 0;
  const otrosTributos = Number(factura.otrosTributos) || 0;
  const redondeo = Number(factura.redondeo) || 0;
  const importeTotal = Number(factura.total) || (valorVenta + igv + isc + icbperTotal + otrosCargos + otrosTributos + redondeo);

  const detraccionCfg = factura.detraccion || {};
  const aplicarDetraccion = detraccionCfg.aplicar !== false
    && (Number(factura.montoDetraccion) > 0 || Number(detraccionCfg.monto) > 0);
  const cuentaBancoNacion = norm(detraccionCfg.cuenta || '00076048290');
  const porcentajeDetraccion = Number(detraccionCfg.porcentaje || 12) || 12;
  const montoDetraccion = Number(
    factura.montoDetraccion ||
    detraccionCfg.monto ||
    0
  );
  const bienServicioDetraccion = norm(detraccionCfg.bienServicio || '037');
  const medioPagoDetraccion = norm(detraccionCfg.medioPago || '001');

  const fmt = (n) => parseFloat(Number(n) || 0).toFixed(2);

  let y = topMargin;

  const headerTop = y;
  const headerH = 75;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, headerTop, contentW, headerH);

  let yL = headerTop + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  let rsLine1 = razonSocial;
  let rsLine2 = '';
  const dashIdx = razonSocial.indexOf(' - ');
  if (dashIdx > 0) {
    rsLine1 = razonSocial.substring(0, dashIdx + 2);
    rsLine2 = razonSocial.substring(dashIdx + 3);
  }
  doc.text(rsLine1, margin + 5, yL);
  yL += 10;
  if (rsLine2) {
    doc.text(rsLine2, margin + 5, yL);
    yL += 10;
  }
  yL += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const formatAddress3 = (addr) => {
    if (!addr) return [];
    if (addr.includes('\n')) return addr.split('\n').map(l => l.trim());
    const parts = addr.split(' - ');
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const deIdx = firstPart.lastIndexOf(' DE ');
      if (deIdx > 0 && firstPart.length - deIdx > 15) {
        return [
          firstPart.substring(0, deIdx + 3),
          firstPart.substring(deIdx + 4) + ' -',
          parts.slice(1).join(' - ')
        ];
      }
    }
    return doc.splitTextToSize(addr, 240);
  };
  const dirLines = formatAddress3(direccionEmpresa);
  doc.text(dirLines, margin + 5, yL);

  const boxW = 205;
  const boxX = pageWidth - margin - boxW - 2;
  const boxY = headerTop + 19;
  const boxH = 40;

  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxW, boxH);

  let yR = boxY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(tipoLabel, boxX + boxW / 2, yR, { align: 'center' });
  yR += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`RUC: ${ruc}`, boxX + boxW / 2, yR, { align: 'center' });
  yR += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${serie}-${numero}`, boxX + boxW / 2, yR, { align: 'center' });

  y = headerTop + headerH + 3;

  let yCli = y + 14;

  const leftX = margin + 2;
  const labelW = 100;
  const colonX = leftX + labelW;
  const valueX = colonX + 4;
  const valMaxW = 220;
  const rightX = margin + contentW * 0.55;
  const rightLabelW = 110;
  const rightColonX = rightX + rightLabelW;
  const rightValueX = rightColonX + 4;
  const rightValMaxW = 120;
  const rowH = 9;
  const fSize = 7.5;

  function evCli(etiqueta, valor, xPos, yPos, _etiquetaW, _etiquetaBold, maxW, opts = {}) {
    const isRight = opts.isRight === true;
    const colX = isRight ? rightColonX : colonX;
    const valX = isRight ? rightValueX : valueX;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fSize);
    doc.setTextColor(0, 0, 0);
    doc.text(etiqueta, xPos, yPos);
    doc.text(':', colX, yPos);
    doc.setFont('helvetica', 'bold');
    const w = maxW || valMaxW;
    const valLines = doc.splitTextToSize(String(valor || ''), Math.max(w, 20));
    doc.text(valLines, valX, yPos);
    return valLines.length * rowH;
  }

  yCli += Math.max(
    evCli('Fecha de Emisión', fechaFormatted, leftX, yCli, labelW, false, 175),
    evCli('Forma de pago', formaPago, rightX, yCli, rightLabelW, false, rightValMaxW, { isRight: true })
  );

  yCli += Math.max(
    evCli('Señor(es)', norm(cliente.razonSocial || '-'), leftX, yCli, labelW, false, 175),
    evCli('Guía de remisión remitente', guiaRemision || '-', rightX, yCli, rightLabelW, false, rightValMaxW, { isRight: true })
  );

  yCli += evCli('RUC', norm(cliente.ruc || '-'), leftX, yCli, labelW, false);

  const estabLines = doc.splitTextToSize(
    norm(direccionEmpresa || '-'),
    valMaxW
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fSize);
  doc.setTextColor(0, 0, 0);
  doc.text('Establecimiento del Emisor', leftX, yCli);
  doc.text(':', colonX, yCli);
  doc.setFont('helvetica', 'bold');
  doc.text(estabLines, valueX, yCli);
  yCli += estabLines.length * rowH;

  yCli += evCli('Tipo de Moneda', nombreMoneda, leftX, yCli, labelW, false);

  yCli += evCli('Observación', observacion, leftX, yCli, labelW, false);

  y = yCli + 8;

  const colCant = 40;
  const colUnidad = 65;
  const colCodigo = 70;
  const colValor = 60;
  const colIcbper = 50;
  const colDesc = contentW - colCant - colUnidad - colCodigo - colValor - colIcbper;

  const tableData = items.map((item) => {
    const cod = norm(item.codigo || '');
    return [
      fmt(item.cantidad),
      normalizarUnidad(item.unidadMedida),
      cod,
      norm(item.descripcion || ''),
      fmt(item.precioUnitario),
      fmt(item.icbper || 0),
    ];
  });

  autoTable(doc, {
    head: [['Cantidad', 'Unidad Medida', 'Código', 'Descripción', 'Valor Unitario', 'ICBPER']],
    body: tableData,
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: { top: 0, bottom: 0, left: 0, right: 0 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      valign: 'middle',
      font: 'helvetica',
      fontStyle: 'normal',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: { top: 0, bottom: 0.5, left: 0, right: 0 },
      cellPadding: 2,
    },
    bodyStyles: {
      lineColor: [0, 0, 0],
      lineWidth: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: colCant },
      1: { halign: 'center', cellWidth: colUnidad },
      2: { halign: 'left', cellWidth: colCodigo },
      3: { halign: 'left', cellWidth: colDesc },
      4: { halign: 'right', cellWidth: colValor },
      5: { halign: 'right', cellWidth: colIcbper },
    },
  });

  const tableTopY = y;
  const tableBottomY = doc.lastAutoTable?.finalY || y;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, tableTopY, contentW, tableBottomY - tableTopY);

  y = tableBottomY + 4;

  const totTop = y;

  const filasTotales = 11;
  const filaH = 12;
  const totH = filasTotales * filaH + 16;

  const totRightX = margin + contentW * 0.54;
  const totRightW = margin + contentW - totRightX;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(totRightX, totTop, totRightW, totH);

  const sonX = margin + 4;
  const sonW = totRightX - margin - 8;
  let ySon = totTop + 38;

  const montoLetras = factura.totalLetras
    ? factura.totalLetras.replace(/^SON:\s*/i, '').replace(/\s+(SOLES|DOLAR\s+AMERICANO)$/i, '').trim()
    : numeroALetras(importeTotal);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const vvogLabel = 'Valor de venta de operaciones gratuitas';
  doc.text(vvogLabel, sonX, ySon);
  const vvogBoxW = 50;
  const vvogBoxX = sonX + doc.getTextWidth(vvogLabel) + 8;
  const vvogBoxH = filaH;
  const vvogBoxY = ySon - 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(vvogBoxX, vvogBoxY, vvogBoxW, vvogBoxH);
  doc.setFont('helvetica', 'bold');
  doc.text(`${simboloMoneda} ${fmt(valorVentaGratuita)}`, vvogBoxX + vvogBoxW / 2, vvogBoxY + vvogBoxH / 2 + 2, { align: 'center' });
  ySon += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const sonText = `SON: ${montoLetras} ${nombreMoneda}`;
  let sonFontSize = 8;
  while (sonFontSize > 5 && doc.getTextWidth(sonText) > sonW) {
    sonFontSize -= 0.5;
    doc.setFontSize(sonFontSize);
  }
  doc.text(sonText, sonX, ySon);
  ySon += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(`orden de compra: ${String(ordenCompra || '-').toLowerCase()}`, sonX, ySon);

  const valorBoxW = 132;
  const valorBoxX = margin + contentW - valorBoxW - 4;
  const valorBoxH = filaH - 1;
  const totLabelRightX = valorBoxX - 4;
  let yTot = totTop + 14;

  function filaTotal(label, value, isBold) {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(label, totLabelRightX, yTot, { align: 'right' });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    const boxY = yTot - 6;
    doc.rect(valorBoxX, boxY, valorBoxW, valorBoxH);
    doc.text(`${simboloMoneda} ${fmt(value)}`, valorBoxX + valorBoxW - 4, boxY + valorBoxH / 2 + 2, { align: 'right' });
    yTot += filaH;
  }

  filaTotal('Sub Total Ventas', subTotalVentas, false);
  filaTotal('Anticipos', anticipos, false);
  filaTotal('Descuentos', descuentos, false);
  filaTotal('Valor Venta', valorVenta, false);
  filaTotal('ISC', isc, false);
  filaTotal('IGV', igv, false);
  filaTotal('ICBPER', icbperTotal, false);
  filaTotal('Otros Cargos', otrosCargos, false);
  filaTotal('Otros Tributos', otrosTributos, false);
  filaTotal('Monto de redondeo', redondeo, false);
  filaTotal('Importe Total', importeTotal, false);

  y = totTop + totH + 4;

  if (aplicarDetraccion) {
    const detTop = y;
    let yDet = detTop + 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Información de la detracción', margin + 8, yDet);
    yDet += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const detX = margin + 8;
    const detValueX = detX + 135;
    doc.text('Leyenda:', detX, yDet);
    doc.text('Operación sujeta al Sistema de Pago de Obligaciones Tributarias con el Gobierno Central', detValueX, yDet);
    yDet += 11;
    doc.text('Bien o Servicio:', detX, yDet);
    doc.text(`${bienServicioDetraccion}  Demás servicios gravados con el IGV`, detValueX, yDet);
    yDet += 11;
    doc.text('Medio de pago:', detX, yDet);
    const medioPagoLabel = medioPagoDetraccion === '001'
      ? '001  Depósito en cuenta'
      : `${medioPagoDetraccion}`;
    doc.text(medioPagoLabel, detValueX, yDet);
    yDet += 11;
    doc.text('Nro. Cta. Banco de la Nación:', detX, yDet);
    doc.text(cuentaBancoNacion, detValueX, yDet);
    doc.text('Porcentaje de detracción:', detX + 230, yDet);
    doc.text(Number(porcentajeDetraccion).toFixed(2), detX + 365, yDet);
    doc.text('Monto detracción:', detX + 420, yDet);
    doc.text(`S/ ${Number(montoDetraccion).toFixed(2)}`, detX + 520, yDet, { align: 'right' });
    yDet += 8;

    const detH = yDet - detTop;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, detTop, contentW, detH);
    doc.setLineWidth(0.3);
    doc.rect(margin + 2, detTop + 2, contentW - 4, detH - 4);

    y = detTop + detH + 6;
  }

  const leyTop = y;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const leyenda = 'Esta es una representación impresa de la factura electrónica, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL.';
  const leyendaLines = doc.splitTextToSize(leyenda, contentW - 16);
  let yLey = leyTop + 15;
  const centerX = margin + contentW / 2;
  leyendaLines.forEach(line => {
    doc.text(line, centerX, yLey, { align: 'center' });
    yLey += 15;
  });
  yLey -= 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin + 2, leyTop, contentW - 4, yLey - leyTop);

  const marcoTop = topMargin;
  const marcoBottom = yLey;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, marcoTop, margin + contentW, marcoTop);
  doc.line(margin, marcoTop, margin, marcoBottom);
  doc.line(margin + contentW, marcoTop, margin + contentW, marcoBottom);
  doc.line(margin, marcoBottom, margin + contentW, marcoBottom);
  doc.line(margin, marcoBottom + 3, margin + contentW, marcoBottom + 3);

  return doc;
}

export function downloadFacturaPDF(factura, config) {
  const doc = generateFacturaPDF(factura, config);
  const serie = factura.serie || '';
  const numero = factura.numero || '';
  doc.save(`${serie}-${numero}.pdf`);
}
