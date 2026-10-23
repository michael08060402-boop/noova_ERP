import { useEffect, useMemo, useRef, useState } from 'react';
import { FiFileText, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { abrirPdfSeguro, cargarPdfjs } from '../utils/leerGuia';
import './VisorDocumento.css';

const TIPOS_IMAGEN = { png: 'image/png', jpg: 'image/jpeg' };

export default function VisorDocumento({ archivo, aviso }) {
  const contenedor = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [error, setError] = useState('');

  const urlImagen = useMemo(() => (
    archivo && TIPOS_IMAGEN[archivo.tipo]
      ? URL.createObjectURL(new Blob([archivo.bytes], { type: TIPOS_IMAGEN[archivo.tipo] }))
      : null
  ), [archivo]);

  useEffect(() => () => { if (urlImagen) URL.revokeObjectURL(urlImagen); }, [urlImagen]);

  useEffect(() => {
    if (!archivo || archivo.tipo !== 'pdf') return undefined;
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await cargarPdfjs();
        const pdf = await abrirPdfSeguro(pdfjs, archivo.bytes);
        if (cancelado || !contenedor.current) return;
        const ancho = (contenedor.current.clientWidth || 600) - 24;
        const lienzos = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const pagina = await pdf.getPage(n);
          const base = pagina.getViewport({ scale: 1 });
          const viewport = pagina.getViewport({ scale: (ancho / base.width) * zoom * (window.devicePixelRatio || 1) });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${ancho * zoom}px`;
          canvas.className = 'visor-documento-pagina';
          await pagina.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
          lienzos.push(canvas);
        }
        if (cancelado || !contenedor.current) return;
        contenedor.current.replaceChildren(...lienzos);
        setPaginas(pdf.numPages);
        setError('');
      } catch (err) {
        console.error('Error mostrando el documento:', err);
        if (!cancelado) setError('No se pudo mostrar el PDF.');
      }
    })();
    return () => { cancelado = true; };
  }, [archivo, zoom]);

  return (
    <aside className="visor-documento">
      <div className="visor-documento-cabecera">
        <span className="visor-documento-titulo" title={archivo?.nombre}>{archivo ? archivo.nombre : 'Documento original'}</span>
        {archivo && (
          <div className="visor-documento-herramientas">
            {archivo.tipo === 'pdf' && paginas > 0 && <span className="visor-documento-paginas">{paginas} pág.</span>}
            <button type="button" className="visor-documento-boton" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} title="Alejar"><FiZoomOut size={15} /></button>
            <button type="button" className="visor-documento-boton" onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))} title="Acercar"><FiZoomIn size={15} /></button>
          </div>
        )}
      </div>
      {aviso && <div className="visor-documento-aviso">{aviso}</div>}
      {error && <div className="visor-documento-aviso visor-documento-error">{error}</div>}
      {!archivo && (
        <div className="visor-documento-vacio">
          <FiFileText size={26} />
          <p>Este formato no tiene una guía guardada.</p>
        </div>
      )}
      {archivo?.tipo === 'pdf' && <div ref={contenedor} className="visor-documento-hojas" aria-live="polite" />}
      {urlImagen && (
        <div className="visor-documento-hojas">
          <img src={urlImagen} alt={archivo.nombre} className="visor-documento-pagina" style={{ width: `${zoom * 100}%` }} />
        </div>
      )}
    </aside>
  );
}
