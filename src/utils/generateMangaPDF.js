import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calcularSubtotal, calcularIGV, calcularTotal } from './formatCurrency';
import logoNoova from '../assets/noova-logo.png';
import imagenManga from '../assets/manga-ventilacion.png';
import interbankImg from '../assets/interbank.png';

import iconPersona from '../assets/icons/icon-user.png';
import iconDocumento from '../assets/icons/icon-document.png';
import iconCalidad from '../assets/icons/icon-quality.png';
import iconEntrega from '../assets/icons/icon-delivery.png';
import iconEscudo from '../assets/icons/icon-shield.png';
import iconVentilador from '../assets/icons/icon-fan.png';
import iconLinkedin from '../assets/icons/icon-linkedin.png';
import iconInstagram from '../assets/icons/icon-instagram.png';
import iconFacebook from '../assets/icons/icon-facebook.png';
import iconWeb from '../assets/icons/icon-web.png';

const COLOR_PRIMARY   = [11, 61, 74];
const COLOR_ACCENT    = [20, 129, 140];
const COLOR_DARK_TEXT = [51, 51, 51];
const COLOR_MUTED     = [110, 118, 120];
const COLOR_WHITE     = [255, 255, 255];
const COLOR_BORDER    = [222, 228, 229];
const COLOR_LIGHT_BG  = [237, 245, 246];
const COLOR_CARD_BG   = [242, 244, 245];
const COLOR_DIVIDER   = [190, 205, 208]; // color del separador "|"
const COLOR_ORANGE    = [244, 122, 0];   // color del footer
const COLOR_LIGHT_BLUE = [70, 150, 230]; // color del correo

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
    maximumFractionDigits: 2,
  });
  return `${etiqueta} ${numero}`;
}

// Igual que formatoMonto pero SIN el prefijo de moneda (US$ / S/), para
// usar dentro de tablas cuyo encabezado de columna ya indica la moneda
// — evita mostrarla duplicada (una vez en el header, otra en cada celda).
function formatoNumero(monto, codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  const locale = etiqueta === 'S/' ? 'es-PE' : 'en-US';
  return Number(monto || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function etiquetaMonedaLarga(codigoMoneda) {
  const etiqueta = etiquetaMoneda(codigoMoneda);
  return etiqueta === 'S/' ? 'Soles (S/)' : 'Dólares Americanos (US$)';
}

function nombreMes(monthIndex) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return meses[monthIndex] || '';
}

function formatFechaLarga(date) {
  if (!date) return '';
  let d;
  if (date?.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date?._seconds !== undefined) {
    d = new Date(date._seconds * 1000);
  } else if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} de ${nombreMes(d.getMonth())} de ${d.getFullYear()}`;
}

function loadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

async function loadAllIcons() {
  const map = {
    persona: iconPersona,
    documento: iconDocumento,
    calidad: iconCalidad,
    entrega: iconEntrega,
    escudo: iconEscudo,
    ventilador: iconVentilador,
    linkedin: iconLinkedin,
    instagram: iconInstagram,
    facebook: iconFacebook,
    web: iconWeb,
  };
  const entries = await Promise.all(
    Object.entries(map).map(async ([key, url]) => {
      try {
        return [key, await loadImageAsBase64(url)];
      } catch (err) {
        console.warn(`No se pudo cargar el icono "${key}":`, err);
        return [key, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

function drawIcon(doc, base64, cx, cy, s) {
  if (!base64) return;
  doc.addImage(base64, 'PNG', cx - s / 2, cy - s / 2, s, s);
}

function drawIconBubble(doc, base64, cx, cy, r, bubbleColor = COLOR_ACCENT, iconScale = 1.15) {
  doc.setFillColor(...bubbleColor);
  doc.circle(cx, cy, r, 'F');
  drawIcon(doc, base64, cx, cy, r * iconScale);
}

// Separador vertical "|" — línea corta centrada verticalmente en su zona
function drawDivider(doc, x, yCenter, height) {
  doc.setDrawColor(...COLOR_DIVIDER);
  doc.setLineWidth(0.4);
  doc.line(x, yCenter - height / 2, x, yCenter + height / 2);
}

export async function generateMangaPDF(cotizacion, config = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageWidth - 2 * margin;

  let logoBase64 = null;
  let logoRatio = 3.2;
  try {
    logoBase64 = await loadImageAsBase64(logoNoova);
    const props = doc.getImageProperties(logoBase64);
    logoRatio = props.width / props.height;
  } catch (err) {
    console.warn('No se pudo cargar el logo NOOVA para el PDF:', err);
  }

  let mangaBase64 = null;
  try {
    mangaBase64 = await loadImageAsBase64(imagenManga);
  } catch (err) {
    console.warn('No se pudo cargar la imagen de manga de ventilación:', err);
  }

  const icons = await loadAllIcons();

  let y = margin;

  const empresa = config?.empresa || {};
  const ruc = empresa.ruc || '';

  const cliente = cotizacion.cliente || {};
  const contactoSeleccionado =
    cotizacion.contactoSeleccionado ||
    (cliente.contactos && cliente.contactos.length > 0 ? cliente.contactos[0] : {}) ||
    {};

  const moneda = etiquetaMoneda(cotizacion.moneda);
  const validez = cotizacion.validez || '15 días';
  const condicionPago = cotizacion.condicionPago || 'Contado';

  const fechaEmision = cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt;
  const fechaFormatted = formatFechaLarga(fechaEmision);

  const items = cotizacion.items || [];

  // ============================================================
  // 1. HEADER
  // ============================================================
  const headerH = 26;
  const logoW = 30;
  const logoH = logoW / logoRatio;

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, y, logoW, logoH);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('NOOVA', margin, y + 8);
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK_TEXT);
    doc.text('CONSULTING', margin, y + 13);
  }

  // Separador "|" entre el logo y el tagline
  const dividerLogoX = margin + logoW + 5;
  drawDivider(doc, dividerLogoX, y + logoH / 2, logoH * 0.75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  const taglineX = dividerLogoX + 5;
  const taglineW = 42; // acortado
  // Salto de línea fijo (no auto-wrap): "Ingeniería en ventilación" / resto
  const taglineLines = ['Ingeniería en ventilación', 'y bombeo con resultados reales'];
  doc.text(taglineLines, taglineX, y + logoH / 2 - (taglineLines.length - 1) * 1.8);

  const imgBoxX = taglineX + taglineW + 6;
  const imgBoxW = pageWidth - margin - imgBoxX;

  if (mangaBase64) {
    doc.addImage(mangaBase64, 'PNG', imgBoxX, y, imgBoxW, headerH);
  } else {
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.setFillColor(...COLOR_CARD_BG);
    doc.rect(imgBoxX, y, imgBoxW, headerH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('IMAGEN NO DISPONIBLE', imgBoxX + imgBoxW / 2, y + headerH / 2, { align: 'center' });
  }

  y += headerH + 3;

  // ============================================================
  // 2. TÍTULO
  // ============================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('COTIZACIÓN', margin, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_ACCENT);
  doc.text('MANGAS DE VENTILACIÓN', margin, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('DUCTOS FLEXIBLES PARA VENTILACIÓN', margin, y + 14);

  y += 17;

  doc.setDrawColor(...COLOR_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ============================================================
  // 3. CLIENTE + COTIZACIÓN N° — CORRECCIÓN: una sola caja gris
  // continua para ambos, separadas por una línea vertical "|"
  // en el centro (igual que la referencia)
  // ============================================================
  // Alto dinámico: antes era fijo (41) y si la Dirección u otro campo se
  // envolvía en varias líneas, el texto se salía del fondo celeste de la
  // tarjeta. Ahora se mide el contenido real antes de dibujar el fondo.
  const colPad = 9;
  const colW = contentW / 2 - colPad - 4;
  const labelW = 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  function contarLineas(value, w) {
    return doc.splitTextToSize(String(value || '---'), w - labelW - 2).length;
  }
  const lineasIzquierda =
    contarLineas(cliente.ruc, colW) +
    contarLineas(cliente.razonSocial, colW) +
    contarLineas(cliente.direccion || cotizacion.ubicacion, colW) +
    contarLineas(contactoSeleccionado.nombre || cliente.contacto, colW) +
    contarLineas(contactoSeleccionado.correo || contactoSeleccionado.email || cliente.correo || cliente.email, colW);
  const lineasDerecha =
    contarLineas(cotizacion.codigo, colW) +
    contarLineas(fechaFormatted, colW) +
    contarLineas(validez, colW) +
    contarLineas(etiquetaMonedaLarga(cotizacion.moneda), colW) +
    contarLineas(condicionPago, colW);
  const contenidoAltoMax = Math.max(lineasIzquierda, lineasDerecha) * 4.6;
  const infoBoxH = Math.max(41, 13.5 + contenidoAltoMax + 4);
  const infoBoxY = y - 2;
  doc.setFillColor(...COLOR_CARD_BG);
  doc.roundedRect(margin, infoBoxY, contentW, infoBoxH, 2, 2, 'F');

  const dividerX = margin + contentW / 2;
  drawDivider(doc, dividerX, infoBoxY + infoBoxH / 2, infoBoxH - 6);

  const colLeftX = margin + colPad;
  const colRightX = dividerX + colPad;

  drawIconBubble(doc, icons.persona, colLeftX + 3.6, y + 5, 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Cliente', colLeftX + 10.5, y + 6.3);

  let yCli = y + 13.5;
  function drawField(label, value, x, yPos, w, valueColor) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(`${label}:`, x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...(valueColor || COLOR_DARK_TEXT));
    const lines = doc.splitTextToSize(String(value || '---'), w - labelW - 2);
    doc.text(lines, x + labelW, yPos);
    return lines.length * 4.6;
  }

  yCli += drawField('RUC', cliente.ruc, colLeftX, yCli, colW);
  yCli += drawField('Razón Social', cliente.razonSocial, colLeftX, yCli, colW);
  yCli += drawField('Dirección', cliente.direccion || cotizacion.ubicacion, colLeftX, yCli, colW);
  yCli += drawField('Contacto', contactoSeleccionado.nombre || cliente.contacto, colLeftX, yCli, colW);
  yCli += drawField('Correo', contactoSeleccionado.correo || contactoSeleccionado.email || cliente.correo || cliente.email, colLeftX, yCli, colW, COLOR_LIGHT_BLUE);

  drawIconBubble(doc, icons.documento, colRightX + 3.6, y + 5, 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Cotización N°', colRightX + 10.5, y + 6.3);

  let yRight = y + 13.5;
  yRight += drawField('Código', cotizacion.codigo, colRightX, yRight, colW);
  yRight += drawField('Fecha', fechaFormatted, colRightX, yRight, colW);
  yRight += drawField('Validez', validez, colRightX, yRight, colW);
  yRight += drawField('Moneda', etiquetaMonedaLarga(cotizacion.moneda), colRightX, yRight, colW);
  yRight += drawField('Pago', condicionPago, colRightX, yRight, colW);

  y = Math.max(yCli, yRight, infoBoxY + infoBoxH) + 4;

  // ============================================================
  // 4. SALUDO
  // ============================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Estimados Señores:', margin, y);
  y += 4.3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_DARK_TEXT);
  const saludoLines = doc.splitTextToSize(
    'Tenemos el agrado de poner a su consideración nuestra cotización de mangas de ventilación, fabricadas con materiales de alta resistencia y diseñadas para garantizar máxima eficiencia, seguridad y durabilidad en operaciones mineras e industriales.',
    contentW
  );
  doc.text(saludoLines, margin, y);
  y += saludoLines.length * 3.6 + 3;

  // ============================================================
  // 5. TABLA
  // ============================================================
  const tableHeaders = [[
    'ÍTEM',
    'CÓDIGO',
    'DESCRIPCIÓN',
    'DIÁMETRO (PLG)',
    'LONGITUD',
    `PRECIO LINEAL (${moneda})`,
    `TOTAL (${moneda})`,
  ]];

  // Los accesorios de conexión (Codo, Conector tipo Y) se venden por pieza,
  // no por metro lineal; el transporte es un servicio. Todos comparten la
  // misma tabla, pero diámetro/longitud solo aplican a mangas.
  const esAccesorio = (item) => item.tipo === 'accesorio' || item.esAccesorio === true || /codo|conector\s*tipo\s*y/i.test(item.descripcion || item.nombre || '');
  const esTransporte = (item) => item.tipo === 'transporte' || /^transporte/i.test(item.descripcion || item.nombre || '');

  function longitudConEtiqueta(item) {
    const valor = Number(item.longitud ?? item.longitudMetros ?? item.longitud_m);
    if (isNaN(valor)) return { texto: item.longitud ? `Longitud\n${item.longitud}` : '—' };
    // Solo 15 m y 20 m (los valores del desplegable) se consideran
    // "longitud estándar"; el título va primero, el valor debajo.
    const esEstandar = valor === 15 || valor === 20;
    const titulo = esEstandar ? 'Longitud estándar' : 'Longitud';
    return { texto: `${titulo}\n${valor} m` };
  }

  const tableData = items.map((item, index) => {
    const esAcc = esAccesorio(item);
    const esTrans = esTransporte(item);

    let diametro = '—';
    let longitudTxt = '—';
    if (!esTrans) {
      diametro = String(item.diametro ?? item.diametroPulgadas ?? item.diametro_plg ?? item.diámetro ?? '—');
      longitudTxt = longitudConEtiqueta(item).texto;
    }

    let descripcion = item.descripcion || item.nombre || (esTrans ? 'Transporte' : '');
    // La descripción debe identificar si corresponde a Raffia o Lona PVC (solo mangas).
    if (!esAcc && !esTrans) {
      const materialRaw = String(item.material || '').toLowerCase();
      const materialLabel = materialRaw.includes('lona') ? 'Lona PVC'
        : materialRaw.includes('raffia') ? 'Raffia'
        : (item.material || '');
      const extras = [materialLabel, item.tipoAcople].filter(Boolean).join(' · ');
      if (extras && !descripcion.includes(extras)) {
        descripcion = descripcion + (descripcion ? '\n' : '') + extras;
      }
    }

    return [
      String(index + 1),
      item.codigo || '',
      descripcion,
      diametro,
      String(longitudTxt),
      formatoNumero(item.precioUnitario || 0, cotizacion.moneda),
      formatoNumero((Number(item.cantidad) || (esTrans ? 1 : 0)) * (Number(item.precioUnitario) || 0), cotizacion.moneda),
    ];
  });

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      textColor: COLOR_DARK_TEXT,
      valign: 'middle',
      font: 'helvetica',
      fontStyle: 'normal',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.8,
      minCellHeight: 7,
      lineColor: COLOR_PRIMARY,
      lineWidth: 0.2,
    },
    bodyStyles: {
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: COLOR_LIGHT_BG,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: COLOR_ACCENT },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left',   cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'right',  cellWidth: 28 },
      6: { halign: 'right',  cellWidth: 28, fontStyle: 'bold' },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 2.5;

  // ============================================================
  // 6. TOTALES
  // ============================================================
  const subtotal = calcularSubtotal(items);
  const sinIGV = !!cotizacion.sinIGV;
  const igv = sinIGV ? 0 : calcularIGV(subtotal);
  const total = sinIGV ? subtotal : calcularTotal(subtotal);

  const totW = 68;
  const totX = pageWidth - margin - totW;
  const totRowH = 5;

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.setFontSize(7.5);

  doc.setFillColor(255, 255, 255);
  doc.rect(totX, y, totW, totRowH, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_DARK_TEXT);
  doc.text('TOTAL SIN IGV', totX + 2, y + 3.5);
  doc.text(formatoMonto(subtotal, cotizacion.moneda), totX + totW - 2, y + 3.5, { align: 'right' });
  y += totRowH;

  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(totX, y, totW, totRowH + 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_WHITE);
  doc.text('TOTAL GENERAL', totX + 2, y + 3.9);
  doc.text(formatoMonto(total, cotizacion.moneda), totX + totW - 2, y + 3.9, { align: 'right' });
  y += totRowH + 1;

  if (!sinIGV) {
    doc.setFillColor(...COLOR_LIGHT_BG);
    doc.rect(totX, y, totW, totRowH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('IGV (18%)', totX + 2, y + 3.5);
    doc.setTextColor(...COLOR_DARK_TEXT);
    doc.text(formatoMonto(igv, cotizacion.moneda), totX + totW - 2, y + 3.5, { align: 'right' });
    y += totRowH;
  }
  y += 5;

  // ============================================================
  // 7. NOTAS
  // ============================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('NOTAS:', margin, y);
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(...COLOR_DARK_TEXT);
  const notas = [
    '• Otras medidas disponibles bajo pedido.',
    '• Se pueden fabricar longitudes especiales según requerimiento.',
    '• Precios válidos solo por el tiempo indicado.',
  ];
  notas.forEach((n) => {
    doc.text(n, margin, y);
    y += 3.5;
  });
  y += 3;

  // ============================================================
  // 8. CONDICIONES COMERCIALES (apartado propio, ancho completo, con
  // icono) + CALIDAD GARANTIZADA y ENTREGA debajo, alineados a la
  // izquierda.
  // ============================================================
  const condicionesComerciales = [
    'Pago: Contado',
    'La cotización es válida por 5 días, pudiendo variar el precio después de la fecha estipulada',
    'Plazo de entrega: 7-10 días hábiles después de confirmada la orden de compra',
    'Lugar de entrega: Av. Cristóbal de Peralta Nte. 110 Of. 702, Santiago de Surco',
    'Embalaje: Fardos',
    'Garantía: 12 meses por defectos de fabricación',
    'Capacitación: Gratuita online en el uso básico de los equipos',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  const condLineasCalc = condicionesComerciales.flatMap((linea, idx) =>
    doc.splitTextToSize(`${idx + 1}. ${linea}.`, contentW - 16)
  );
  const condCardH = 12 + condLineasCalc.length * 3.1 + 3;

  if (y > pageHeight - condCardH - 40) {
    doc.addPage();
    y = margin + 5;
  }
  const condCardY = y;
  doc.setFillColor(...COLOR_CARD_BG);
  doc.roundedRect(margin, condCardY, contentW, condCardH, 2, 2, 'F');

  drawIcon(doc, icons.escudo, margin + 8, condCardY + 9, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('CONDICIONES COMERCIALES', margin + 15, condCardY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(...COLOR_MUTED);
  let yCond = condCardY + 15;
  condicionesComerciales.forEach((linea, idx) => {
    const lineas = doc.splitTextToSize(`${idx + 1}. ${linea}.`, contentW - 16);
    doc.text(lineas, margin + 8, yCond);
    yCond += lineas.length * 3.1;
  });

  y = condCardY + condCardH + 4;

  // CALIDAD GARANTIZADA y ENTREGA — alineados a la izquierda, en fila.
  const infoCardsH = 20;
  if (y > pageHeight - infoCardsH - 40) {
    doc.addPage();
    y = margin + 5;
  }
  const infoCardsY = y;
  doc.setFillColor(...COLOR_CARD_BG);
  doc.roundedRect(margin, infoCardsY, contentW, infoCardsH, 2, 2, 'F');

  const mitad = contentW / 2;
  drawDivider(doc, margin + mitad, infoCardsY + infoCardsH / 2, infoCardsH - 6);

  function drawInfoSection(sectionX, sectionWidth, iconBase64, titulo, textoLines) {
    const padX = 6;
    const iconCx = sectionX + padX + 4;
    const iconCy = infoCardsY + 9;
    drawIcon(doc, iconBase64, iconCx, iconCy, 8);

    const textX = sectionX + padX + 10;
    const textW = sectionWidth - padX - 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(titulo, textX, iconCy - 1.5, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(doc.splitTextToSize(textoLines, textW), textX, iconCy - 1.5 + 5.2, { align: 'left' });
  }

  drawInfoSection(
    margin,
    mitad,
    icons.calidad,
    'CALIDAD GARANTIZADA',
    'Nuestras mangas cumplen con estándares internacionales y aseguran un óptimo rendimiento en condiciones exigentes.'
  );

  // Si varios ítems tienen el mismo tiempo de entrega, se muestra solo uno;
  // si difieren, se listan por ítem.
  const tiempoEntregaDefault = cotizacion.tiempoEntrega
    || (cotizacion.tiempoEntregaNumero && cotizacion.tiempoEntregaUnidad
      ? `${cotizacion.tiempoEntregaNumero} ${cotizacion.tiempoEntregaUnidad} recibida la OC`
      : '7 - 10 días hábiles después de confirmada la orden de compra.');
  const itemsConEntrega = items.filter((it) => !esTransporte(it));
  const tiemposUnicosManga = [...new Set(itemsConEntrega.map((it) => (it.tiempoEntrega || '').trim()).filter(Boolean))];
  let tiempoEntregaTxt;
  if (tiemposUnicosManga.length <= 1) {
    tiempoEntregaTxt = tiemposUnicosManga[0] || tiempoEntregaDefault;
  } else {
    tiempoEntregaTxt = itemsConEntrega
      .map((it, idx) => `Ítem ${idx + 1} (${it.codigo || ''}): ${it.tiempoEntrega || tiempoEntregaDefault}`)
      .join(' | ');
  }
  drawInfoSection(
    margin + mitad,
    mitad,
    icons.entrega,
    'ENTREGA',
    `Tiempo estimado: ${tiempoEntregaTxt}`
  );

  y = infoCardsY + infoCardsH + 5;

  // ============================================================
  // 8b. CUENTA BANCARIA (Interbank)
  // ============================================================
  {
    let interbankBase64 = null;
    try {
      interbankBase64 = await loadImageAsBase64(interbankImg);
    } catch (err) {
      console.warn('No se pudo cargar el logo de Interbank:', err);
    }
    const logoW2 = 34;
    const logoH2 = 11;
    if (interbankBase64) {
      doc.addImage(interbankBase64, 'PNG', margin, y, logoW2, logoH2);
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margin + logoW2 + 4, right: margin },
      tableWidth: contentW - logoW2 - 4,
      head: [['INTERBANK', 'MONEDA', 'N° CUENTA', 'CCI']],
      body: [
        ['Cuenta Corriente', 'Soles', '898-3003796684', '003-898-003003796684-40'],
        ['Cuenta Corriente', 'Dólares', '898-3003796691', '003-898-003003796691-45'],
      ],
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        lineColor: COLOR_BORDER,
        lineWidth: 0.2,
        textColor: COLOR_DARK_TEXT,
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLOR_PRIMARY,
        textColor: COLOR_WHITE,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 6.8,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 38, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' },
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 5;
  }

  // ============================================================
  // 9. CIERRE
  // ============================================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  const cierreLines = doc.splitTextToSize(
    'Agradecemos la oportunidad de presentar nuestra propuesta y quedamos atentos a sus comentarios.',
    contentW
  );
  doc.text(cierreLines, margin, y);
  y += cierreLines.length * 3.4 + 3;

  // ============================================================
  // 10. FOOTER — color naranja
  // ============================================================
  const footerH = 20;
  const footerY = pageHeight - footerH;

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, footerY, pageWidth, footerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_WHITE);
  doc.text('CONECTAMOS INGENIERÍA,', margin, footerY + 9);
  doc.text('EXPERIENCIA Y RESULTADOS.', margin, footerY + 14.5);

  const socialItems = [
    { icon: icons.linkedin, label: 'NOOVA SAC' },
    { icon: icons.instagram, label: 'noova_sac' },
    { icon: icons.facebook, label: 'NOOVA' },
    { icon: icons.web, label: 'www.noovasac.com' },
  ];

  const socialAreaX = margin + 68;
  const socialAreaW = pageWidth - margin - socialAreaX;
  const groupGap = socialAreaW / socialItems.length;
  const iconR = 3.4;
  const socialY = footerY + footerH / 2;

  socialItems.forEach((item, i) => {
    const groupX = socialAreaX + i * groupGap;
    const iconCx = groupX + iconR;

    if (i > 0) {
      // separador "|" en color claro sobre el fondo navy, antes de cada grupo
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(groupX - 4, socialY - 4, groupX - 4, socialY + 4);
    }

    drawIcon(doc, item.icon, iconCx, socialY, iconR * 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_WHITE);
    doc.text(item.label, iconCx + iconR + 2, socialY + 1.2);
  });

  if (ruc) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLOR_WHITE);
    doc.text(`RUC: ${ruc}`, margin, footerY - 2);
  }

  return doc;
}

export async function downloadMangaPDF(cotizacion, config) {
  const doc = await generateMangaPDF(cotizacion, config);
  doc.save(`${cotizacion.codigo || 'cotizacion-mangas'}.pdf`);
}
