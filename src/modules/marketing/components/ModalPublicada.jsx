import { useState } from 'react';
import Modal from '../../../components/Modal';
import { marcarPublicada } from '../services/marketingService';

export default function ModalPublicada({ publicacion, onClose, onHecho }) {
  const [url, setUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError('');
    try {
      onHecho(await marcarPublicada({ publicacionId: publicacion.id, eTag: publicacion.metadatos.jsonEtag, url: url.trim() }));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Marcar como publicada" size="small">
      <form onSubmit={enviar}>
        <p>«{publicacion.titulo || publicacion.nombre}» pasará a Publicada y ya no se podrá devolver a borrador.</p>
        <div className="campo">
          <label htmlFor="mp-url">Enlace de la publicación <span className="monitoreo-opcional">(opcional)</span></label>
          <input id="mp-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
        </div>
        {error && <p className="publicaciones-error" role="alert">{error}</p>}
        <div className="acciones-form">
          <button type="button" className="btn-secundario" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" className="btn-principal" disabled={enviando}>{enviando ? 'Guardando...' : 'Marcar publicada'}</button>
        </div>
      </form>
    </Modal>
  );
}
