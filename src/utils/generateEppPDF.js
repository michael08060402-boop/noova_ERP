import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './formatDate';
import noovaLogo from '../assets/noova-logo.png';

// ============================================================
// SOLICITUD DE COTIZACIÓN DE EPP — NOOVA S.A.C.
// ------------------------------------------------------------
// Este formato se utiliza para solicitar precios a un proveedor.
// No representa una cotización comercial emitida por Noova ni un
// comprobante tributario.
// ============================================================

const NOOVA_FALLBACK = {
  razonSocial: 'CONTRATISTAS GENERALES NOOVA S.A.C.',
  ruc: '20550622930',
  direccion: 'Av. Cristóbal de Peralta Norte Nro. 110 Int. 702, Urb. Valle Hermoso de Monterrico, Santiago de Surco, Lima - Lima',
  establecimiento: '',
  celular: '',
  email: '',
  web: ''
};

const COLOR_DARK = [31, 55, 75];
const COLOR_ACCENT = [244, 122, 0];
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

export function generateEppPDF(cotizacion, config = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - 2 * margin;

  const empresa = { ...NOOVA_FALLBACK, ...(config?.empresa || {}) };
  const emp = {
    razonSocial: empresa.razonSocial || NOOVA_FALLBACK.razonSocial,
    ruc: empresa.ruc || NOOVA_FALLBACK.ruc,
    direccion: empresa.direccion || NOOVA_FALLBACK.direccion,
    establecimiento: empresa.establecimiento || empresa.direccion || NOOVA_FALLBACK.direccion,
    celular: empresa.celular || empresa.telefono || '',
    email: empresa.email || '',
    web: empresa.web || ''
  };

  // En una solicitud de cotización, Noova es quien solicita la oferta.
  // El responsable queda registrado en la cotización al momento de crearla.
  const solicitante = cotizacion.responsable || cotizacion.creadoPor || '-';

  const items = cotizacion.items || [];
  const monedaCod = cotizacion.moneda;
  const fechaEmision = cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt;
  const observacion = cotizacion.observacion || '';
  const HEADER_H = 38;

  function drawHeader(compacta = false) {
    const top = 8;

    // Logo original de Noova Consulting.
    // Mantiene aproximadamente el tamaño visual del formato anterior,
    // pero respetando la proporción real del logo original (305 x 216).
    const logoH = compacta ? 14 : 20;
    const logoW = logoH * (305 / 216);
    try {
      doc.addImage(noovaLogo, 'PNG', margin, top, logoW, logoH);
    } catch {
      // Si el logo no carga, el PDF sigue generándose.
    }

    const boxW = 66;
    const boxX = pageW - margin - boxW;
    const infoX = margin + logoW + 4;
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

      if (contactoLinea) {
        doc.text(doc.splitTextToSize(contactoLinea, infoW), infoX, yInfo);
      }
    }

    const boxH = compacta ? 14 : 20;

    // Cabecera naranja + marco azul con esquinas rectas. El marco se
    // dibuja al final para evitar los cortes/solapes visibles en las esquinas.
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

    doc.setDrawColor(...COLOR_DARK);
    doc.setLineWidth(0.4);
    doc.line(margin, top + HEADER_H - 3, pageW - margin, top + HEADER_H - 3);
  }

  function drawMetaBox(y) {
    const labelW = 40;
    const rows = [
      ['Fecha de Emisión', formatDate(fechaEmision)],
      ['Solicitante', solicitante],
      ['Empresa', emp.razonSocial],
      ['RUC', emp.ruc],
      ['Dirección', emp.direccion],
      ['Tipo de Moneda', nombreMoneda(monedaCod)]
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

    doc.rect(margin, y, contentW, totalH);
    doc.line(margin + labelW, y, margin + labelW, y + totalH);

    rows.forEach(([label, value], i) => {
      const h = rowHeights[i];
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

  drawHeader(false);
  let y = 8 + HEADER_H;
  y = drawMetaBox(y) + 4;

  // Solicitud a proveedor: el ERP envía únicamente la identificación del
  // ítem, descripción, unidad y cantidad. El proveedor responde con su propia
  // propuesta económica; por eso este formato no incluye columnas de precio.
  const head = [[
    'Ítem',
    'Código',
    'Descripción',
    'Unidad',
    'Cantidad'
  ]];

  const body = items.map((item, index) => {
    const cant = Number(item.cantidad) || 0;
    const detalleExtra = [item.marca, item.modelo].filter(Boolean).join(' · ');
    const descripcion = detalleExtra
      ? `${item.descripcion || ''}\n${detalleExtra}`
      : (item.descripcion || '');

    return [
      String(index + 1).padStart(2, '0'),
      item.codigo || '',
      descripcion,
      item.unidadMedida || 'UNIDAD',
      cant ? (Number.isInteger(cant) ? String(cant) : cant.toFixed(2)) : ''
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin, top: 8 + HEADER_H },
    tableWidth: contentW,
    styles: {
      fontSize: 7.7,
      cellPadding: 2.1,
      lineColor: COLOR_LINE_SOFT,
      lineWidth: 0.25,
      textColor: COLOR_TXT,
      valign: 'middle'
    },
    headStyles: {
      fillColor: COLOR_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.4,
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 24 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(true);
    }
  });

  y = (doc.lastAutoTable?.finalY || y) + 5;


  // La solicitud no calcula totales: el proveedor devuelve su estructura
  // económica en su propia propuesta.

  // ============================================================
  // CONDICIONES + DATOS BANCARIOS
  // ------------------------------------------------------------
  // Se muestran inmediatamente después de la tabla de ítems. Son dos
  // bloques informativos para indicar al proveedor qué datos debe incluir
  // en su respuesta. No se dejan campos para escribir sobre este PDF.
  // ============================================================
  const CARD_BG = [246, 247, 248];
  const CARD_BORDER = [224, 228, 231];
  const CARD_GAP = 5;
  const CARD_W = (contentW - CARD_GAP) / 2;
  const CARD_H = 40;

  function asegurarEspacioTarjetas() {
    // Las tarjetas van inmediatamente después de la tabla. Si no caben
    // completas, pasan juntas a la siguiente página.
    if (y + CARD_H > pageH - 18) {
      doc.addPage();
      drawHeader(true);
      y = 8 + HEADER_H;
    }
  }

  function drawBloqueInformativo(x, yPos, ancho, titulo, lineas) {
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, yPos, ancho, CARD_H, 1.6, 1.6, 'FD');

    // Acento superior sobrio para mantener continuidad con la marca.
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(x, yPos, ancho, 1.1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...COLOR_DARK);
    doc.text(titulo, x + 5.5, yPos + 6.7);

    let yy = yPos + 12.8;
    lineas.forEach((texto, index) => {
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

  asegurarEspacioTarjetas();

  const cardsY = y;
  const leftX = margin;
  const rightX = margin + CARD_W + CARD_GAP;

  drawBloqueInformativo(
    leftX,
    cardsY,
    CARD_W,
    'CONDICIONES DE LA OFERTA',
    [
      'Indicar validez de la oferta.',
      'Indicar tiempo de entrega.',
      'Indicar condiciones de pago.',
      'Indicar si los precios incluyen IGV.',
      'Indicar si el envío está incluido o se cotiza como servicio adicional.'
    ]
  );

  drawBloqueInformativo(
    rightX,
    cardsY,
    CARD_W,
    'DATOS BANCARIOS PARA PAGO',
    [
      'Indicar entidad bancaria.',
      'Indicar tipo de cuenta.',
      'Indicar moneda de la cuenta.',
      'Indicar N.° de cuenta.',
      'Indicar CCI.'
    ]
  );

  y = cardsY + CARD_H;

  // Footer mínimo: separador + paginación. No repite código, razón social ni RUC.
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_LINE_SOFT);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_TXT_SOFT);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 7.8, { align: 'right' });
  }

  return doc;
}

export function downloadEppPDF(cotizacion, config) {
  const doc = generateEppPDF(cotizacion, config);
  const fechaArchivo = (() => {
    const d = new Date(cotizacion?.fechaEmision || cotizacion?.fecha || cotizacion?.createdAt || Date.now());
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  })();
  doc.save(`solicitud-cotizacion-${fechaArchivo}.pdf`);
}
