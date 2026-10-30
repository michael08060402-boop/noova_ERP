import { useEffect, useRef, useState } from 'react';
import Modal from '../../../components/Modal';
import { descargarPaquete, subirVersionEditada } from '../services/marketingService';
import { extensionDe, porcentaje, validarArchivoVersion } from '../utils/archivosVersion';

function Paquete({ publicacion, onClose }) {
  const [archivos, setArchivos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    descargarPaquete(publicacion.id)
      .then((items) => { if (activo) setArchivos(items); })
      .catch((fallo) => { if (activo) setError(fallo.message); });
    return () => { activo = false; };
  }, [publicacion.id]);

  return (
    <div>
      <p>Archivos de la pieza para editar. Los enlaces duran poco tiempo: si caducan, vuelve a abrir esta ventana.</p>
      {error && <p className="publicaciones-error" role="alert">{error}</p>}
      {!error && archivos === null && <p role="status">Preparando el paquete…</p>}
      {archivos && (
        <ul className="taller-lista">
          {archivos.map((a) => (
            <li key={a.nombre}><a href={a.url} download={a.nombre} target="_blank" rel="noopener noreferrer">{a.nombre}</a></li>
          ))}
        </ul>
      )}
      <div className="acciones-form"><button type="button" className="btn-principal" onClick={onClose}>Cerrar</button></div>
    </div>
  );
}

function Version({ publicacion, onClose, onCambiada }) {
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [avance, setAvance] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const actual = publicacion.nombre;

  const elegir = (event) => {
    const elegido = event.target.files?.[0] || null;
    setArchivo(elegido);
    setError(elegido ? validarArchivoVersion(elegido, actual) || '' : '');
  };

  const subir = async (event) => {
    event.preventDefault();
    const fallo = validarArchivoVersion(archivo, actual);
    if (fallo) { setError(fallo); return; }
    setEnviando(true);
    setError('');
    setAvance(0);
    try {
      const resultado = await subirVersionEditada({
        publicacionId: publicacion.id, eTag: publicacion.metadatos.jsonEtag, archivo,
        alAvanzar: (subidos, total) => setAvance(porcentaje(subidos, total))
      });
      onCambiada(resultado);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={subir}>
      <p>
        Sube tu versión editada. Debe ser <strong>{extensionDe(actual).toUpperCase()}</strong>, igual que el archivo actual
        (<code>{actual}</code>), y pesar hasta 25 MB. La versión anterior queda guardada en el historial de SharePoint.
      </p>
      <p className="taller-aviso">Al subirla, la pieza vuelve a borrador y se anula su aprobación.</p>
      <div className="campo">
        <label htmlFor="tv-archivo">Archivo editado</label>
        <input id="tv-archivo" ref={entrada} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={elegir} disabled={enviando} />
      </div>
      {enviando && (
        <div className="taller-progreso" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${avance}%` }} /><small>{avance} %</small>
        </div>
      )}
      {error && <p className="publicaciones-error" role="alert">{error}</p>}
      <div className="acciones-form">
        <button type="button" className="btn-secundario" onClick={onClose} disabled={enviando}>Cancelar</button>
        <button type="submit" className="btn-principal" disabled={enviando || !archivo || Boolean(error)}>{enviando ? 'Subiendo...' : 'Subir versión'}</button>
      </div>
    </form>
  );
}

export default function ModalTaller({ modo, publicacion, onClose, onCambiada }) {
  return (
    <Modal isOpen onClose={onClose} title={modo === 'paquete' ? 'Paquete de la pieza' : 'Subir versión editada'} size="small">
      {modo === 'paquete'
        ? <Paquete publicacion={publicacion} onClose={onClose} />
        : <Version publicacion={publicacion} onClose={onClose} onCambiada={onCambiada} />}
    </Modal>
  );
}
