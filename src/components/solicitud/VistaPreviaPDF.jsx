import { useEffect, useRef, useState } from 'react';

let pdfjsPromesa = null;
function cargarPdfjs() {
  if (!pdfjsPromesa) {
    pdfjsPromesa = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromesa;
}

export default function VistaPreviaPDF({ solicitud, config }) {
  const contenedor = useRef(null);
  const [estado, setEstado] = useState('cargando');
  const [paginas, setPaginas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      try {
        const [{ pdfSolicitudBytes }, pdfjs] = await Promise.all([import('../../utils/generateSolicitudPDF'), cargarPdfjs()]);
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfSolicitudBytes(solicitud, config)) }).promise;
        if (cancelado || !contenedor.current) return;
        const ancho = contenedor.current.clientWidth || 600;
        const lienzos = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const pagina = await pdf.getPage(n);
          const base = pagina.getViewport({ scale: 1 });
          const escala = (ancho / base.width) * (window.devicePixelRatio || 1);
          const viewport = pagina.getViewport({ scale: escala });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'vista-previa-pagina';
          await pagina.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
          lienzos.push(canvas);
        }
        if (cancelado || !contenedor.current) return;
        contenedor.current.replaceChildren(...lienzos);
        setPaginas(pdf.numPages);
        setEstado('listo');
      } catch (err) {
        console.error('Error generando la vista previa:', err);
        if (!cancelado) setEstado('error');
      }
    }, 450);
    return () => { cancelado = true; clearTimeout(temporizador); };
  }, [solicitud, config]);

  return (
    <div className="vista-previa">
      <div className="vista-previa-cabecera">
        <span>Vista previa del PDF</span>
        {estado === 'listo' && <span className="vista-previa-paginas">{paginas} página{paginas === 1 ? '' : 's'}</span>}
        {estado === 'error' && <span className="vista-previa-error">No se pudo generar</span>}
      </div>
      <div ref={contenedor} className="vista-previa-hojas" aria-live="polite" />
    </div>
  );
}
