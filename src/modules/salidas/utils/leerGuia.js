import { interpretarGuiaRemision } from './guiaRemision.js';

const TAMANO_MAXIMO_GUIA = 10 * 1024 * 1024;
const PAGINAS_MAXIMAS = 20;

const FIRMAS = [
  { tipo: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { tipo: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'jpg', bytes: [0xff, 0xd8, 0xff] }
];

function tipoDocumentoGuia(bytes) {
  return FIRMAS.find((f) => f.bytes.every((b, i) => bytes[i] === b))?.tipo || null;
}

let pdfjsPromesa = null;

export function cargarPdfjs() {
  if (!pdfjsPromesa) {
    pdfjsPromesa = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromesa;
}

export function abrirPdfSeguro(pdfjs, bytes) {
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false, stopAtErrors: false }).promise;
}

async function validarArchivoGuia(file) {
  if (!file) throw new Error('Selecciona un archivo.');
  if (!file.size) throw new Error('El archivo está vacío.');
  if (file.size > TAMANO_MAXIMO_GUIA) throw new Error('El archivo supera el máximo de 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoDocumentoGuia(bytes);
  if (!tipo) throw new Error('Formato no admitido: solo PDF, JPG o PNG.');
  return {
    bytes,
    documento: {
      nombre: String(file.name || 'documento').slice(0, 180),
      tipo,
      tamano: file.size
    }
  };
}

export async function leerDocumentoGuia(file) {
  const { bytes, documento } = await validarArchivoGuia(file);
  if (documento.tipo !== 'pdf') {
    return {
      bytes,
      documento,
      resultado: null,
      mensaje: 'Las imágenes no se leen automáticamente. Ingresa los datos mirando el documento a la derecha.'
    };
  }

  const pdfjs = await cargarPdfjs();
  const pdf = await abrirPdfSeguro(pdfjs, bytes);
  if (pdf.numPages > PAGINAS_MAXIMAS) throw new Error(`El PDF tiene ${pdf.numPages} páginas; el máximo es ${PAGINAS_MAXIMAS}.`);

  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    paginas.push(items.filter((i) => typeof i.str === 'string').map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
  }
  const conTexto = paginas.some((p) => p.some((i) => i.str.trim()));
  const documentoPdf = { ...documento, paginas: pdf.numPages };
  if (!conTexto) {
    return {
      bytes,
      documento: documentoPdf,
      resultado: null,
      mensaje: 'El PDF no tiene texto seleccionable (parece escaneado). Ingresa los datos manualmente mirando el documento.'
    };
  }
  return { bytes, documento: documentoPdf, resultado: interpretarGuiaRemision(paginas, documento.nombre), mensaje: '' };
}
