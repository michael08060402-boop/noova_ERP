// Estilo del documento de referencia (LearnMining): logo en cada hoja, títulos centrados, tablas con grilla y estados de color
import {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun,
  Header, Footer, PageNumber, HeadingLevel, VerticalAlign, PageOrientation,
} from 'docx';
import { readFileSync } from 'node:fs';

export const F = 'Arial';
export const K = { cab: '0B4F6C', teal: '1A7A99', texto: '1A1A1A', gris: '666666', borde: '9AA5AE', suave: 'F3F7F9' };
export const ESTADO = {
  'Completado': { fill: '2DB36B', color: '000000' }, 'Listo': { fill: '2DB36B', color: '000000' },
  'Parcial': { fill: 'FFD84D', color: '000000' }, 'En curso': { fill: 'FFD84D', color: '000000' },
  'Pendiente': { fill: 'E5484D', color: 'FFFFFF' }, 'Por decidir': { fill: '1F7AC9', color: 'FFFFFF' },
  'Alto': { fill: 'E5484D', color: 'FFFFFF' }, 'Medio': { fill: 'FFD84D', color: '000000' }, 'Bajo': { fill: '2DB36B', color: '000000' },
};
export const GEO = {
  portrait: { w: 11906, h: 16838, m: { top: 1300, bottom: 1000, left: 1134, right: 1134, header: 450, footer: 450 }, cw: 9638, px: 642, py: 940 },
  landscape: { w: 11906, h: 16838, m: { top: 1250, bottom: 850, left: 850, right: 850, header: 450, footer: 400 }, cw: 15138, px: 1008, py: 640 },
};

export function runs(texto, base = {}) {
  return String(texto).split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '').map((p) => {
    const b = p.startsWith('**') && p.endsWith('**');
    return new TextRun({ font: F, ...base, text: b ? p.slice(2, -2) : p, bold: b || base.bold });
  });
}

export function P(t, o = {}) {
  return new Paragraph({
    alignment: o.align, keepNext: o.keepNext, keepLines: true, pageBreakBefore: o.pageBreakBefore, indent: o.indent,
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 276 },
    children: runs(t, { size: o.size ?? 20, color: o.color ?? K.texto, italics: o.italics, bold: o.bold }),
  });
}

export function H1(texto, o = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, keepNext: true, pageBreakBefore: o.pageBreakBefore,
    spacing: { before: o.before ?? 0, after: 200 },
    children: [new TextRun({ text: texto.toUpperCase(), font: F, bold: true, size: 26, color: '000000' })],
  });
}
export function H2(texto, o = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, keepNext: true, pageBreakBefore: o.pageBreakBefore,
    spacing: { before: o.before ?? 220, after: 90 },
    children: [new TextRun({ text: texto, font: F, bold: true, size: 21, color: K.teal })],
  });
}

export function bullets(items, o = {}) {
  return items.map((t, i) => new Paragraph({
    numbering: { reference: 'bul', level: 0 }, keepLines: true,
    spacing: { before: 0, after: i === items.length - 1 ? (o.after ?? 120) : 50, line: 264 },
    children: runs(t, { size: o.size ?? 20, color: K.texto }),
  }));
}

const B = { style: BorderStyle.SINGLE, size: 4, color: K.borde };
const BORDES = { top: B, bottom: B, left: B, right: B };

function contenido(c, size) {
  const obj = typeof c === 'object' && c !== null && !Array.isArray(c) ? c : { t: c };
  if (typeof obj.t === 'string' && ESTADO[obj.t] && obj.estado !== false) {
    const e = ESTADO[obj.t];
    return { obj: { ...obj, fill: e.fill, align: AlignmentType.CENTER, bold: true, color: e.color }, lineas: [obj.t] };
  }
  return { obj, lineas: String(obj.t ?? '').split('\n') };
}

export function tbl({ cols, head, rows, size = 17, zebra = false, filaCab = true, alignHead = AlignmentType.CENTER }) {
  const total = cols.reduce((a, b) => a + b, 0);
  const pad = { top: 60, bottom: 60, left: 90, right: 90 };
  const filas = [];
  if (head) {
    filas.push(new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA }, margins: pad, verticalAlign: VerticalAlign.CENTER, borders: BORDES,
      shading: { type: ShadingType.CLEAR, fill: K.cab, color: 'auto' },
      children: [new Paragraph({ alignment: alignHead, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: h, font: F, bold: true, size, color: 'FFFFFF' })] })],
    })) }));
  }
  rows.forEach((r, ri) => {
    filas.push(new TableRow({ cantSplit: true, children: r.map((c, i) => {
      const { obj, lineas } = contenido(c, size);
      const fill = obj.fill || (zebra && ri % 2 ? K.suave : 'FFFFFF');
      return new TableCell({
        width: { size: cols[i], type: WidthType.DXA }, margins: pad, verticalAlign: obj.valign || VerticalAlign.CENTER, borders: BORDES, columnSpan: obj.span,
        shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
        children: lineas.map((l, k) => new Paragraph({
          alignment: obj.align, keepLines: true, spacing: { before: 0, after: k === lineas.length - 1 ? 0 : 50, line: 250 },
          children: runs(l, { size: obj.size ?? size, color: obj.color ?? K.texto, bold: obj.bold }),
        })),
      });
    }) }));
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: cols, rows: filas });
}

// Cuadro destacado de una sola celda (objetivo final, avisos)
export function caja(titulo, lineas, ancho = 9638, fill = 'E7F3F7', borde = K.cab) {
  const b = { style: BorderStyle.SINGLE, size: 8, color: borde };
  const hijos = [];
  if (titulo) hijos.push(new Paragraph({ keepNext: true, spacing: { before: 0, after: 70 }, children: [new TextRun({ text: titulo, font: F, bold: true, size: 21, color: K.cab })] }));
  (Array.isArray(lineas) ? lineas : [lineas]).forEach((l, i, a) => hijos.push(new Paragraph({ keepLines: true, spacing: { before: 0, after: i === a.length - 1 ? 0 : 80, line: 276 }, children: runs(l, { size: 21, color: K.texto }) })));
  return new Table({ width: { size: ancho, type: WidthType.DXA }, columnWidths: [ancho], rows: [new TableRow({ cantSplit: true, children: [new TableCell({
    width: { size: ancho, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 220, right: 220 },
    shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, borders: { top: b, bottom: b, left: b, right: b }, children: hijos })] })] });
}

export function dimsPng(r) { const b = readFileSync(r); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
export function imagen(ruta, maxW, maxH, { escala = 2.4, tope = 1.1, alt = '' } = {}) {
  const d = dimsPng(ruta);
  const nw = d.w / escala, nh = d.h / escala;
  const f = Math.min(maxW / nw, maxH / nh, tope);
  return new ImageRun({ type: 'png', data: readFileSync(ruta), transformation: { width: Math.round(nw * f), height: Math.round(nh * f) }, altText: { title: alt, description: alt, name: alt } });
}

export function cabeceras(geo, logoRuta) {
  const g = GEO[geo];
  return {
    headers: { default: new Header({ children: [new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ type: 'png', data: readFileSync(logoRuta), transformation: { width: 50, height: 35 }, altText: { title: 'Noova', description: 'Logo de Noova Consulting', name: 'logo' } })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [
      new TextRun({ text: 'Página ', font: F, size: 16, color: K.gris }), new TextRun({ children: [PageNumber.CURRENT], font: F, size: 16, color: K.gris }),
      new TextRun({ text: ' de ', font: F, size: 16, color: K.gris }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: F, size: 16, color: K.gris })] })] }) },
  };
}
export function propsSeccion(geo) {
  const g = GEO[geo];
  return { page: { size: { width: g.w, height: g.h, orientation: geo === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: g.m.top, bottom: g.m.bottom, left: g.m.left, right: g.m.right, header: g.m.header, footer: g.m.footer } } };
}
export { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, VerticalAlign, ImageRun };
