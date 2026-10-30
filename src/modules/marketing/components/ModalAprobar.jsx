import { useState } from 'react';
import Modal from '../../../components/Modal';
import { aprobarPublicacion, devolverPublicacion } from '../services/marketingService';
import { REDES } from './redesSociales';
import { hoyLima, validarAprobacion, validarMotivo } from '../utils/aprobacion';

// modo 'aprobar': confirma texto final, red, fecha y hora. modo 'devolver': pide el motivo.
export default function ModalAprobar({ isOpen, modo, publicacion, onClose, onCambiada }) {
  const pendientes = publicacion.metadatos?.pendientes || [];
  const redInicial = REDES.some((r) => r.key === publicacion.red) ? publicacion.red : '';
  const [form, setForm] = useState({ red: redInicial, fecha: hoyLima(), hora: '09:07', revisado: false, motivo: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const cambiar = (campo) => (event) => setForm((actual) => ({ ...actual, [campo]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const enviar = async (event) => {
    event.preventDefault();
    const fallo = modo === 'aprobar' ? validarAprobacion(form, pendientes) : validarMotivo(form.motivo);
    if (fallo) { setError(fallo); return; }
    setEnviando(true);
    setError(null);
    try {
      const comun = { publicacionId: publicacion.id, eTag: publicacion.metadatos.jsonEtag };
      const resultado = modo === 'aprobar'
        ? await aprobarPublicacion({ ...comun, texto: publicacion.texto || '', red: form.red, fecha: form.fecha, hora: form.hora })
        : await devolverPublicacion({ ...comun, motivo: form.motivo.trim() });
      onCambiada(resultado);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const aprobando = modo === 'aprobar';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={aprobando ? 'Aprobar publicación' : 'Devolver publicación'} size="small">
      <form onSubmit={enviar}>
        {aprobando ? (
          <>
            <div className="campo">
              <label htmlFor="ap-texto">Texto final</label>
              <textarea id="ap-texto" className="aprobar-texto" value={publicacion.texto || ''} readOnly rows={6} />
            </div>
            {pendientes.length > 0 && (
              <div className="publicaciones-error" role="alert">
                <strong>Pendientes por completar:</strong>
                <ul>{pendientes.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            <div className="campo">
              <label htmlFor="ap-red">Red</label>
              <select id="ap-red" value={form.red} onChange={cambiar('red')}>
                <option value="">Elige una red</option>
                {REDES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="ap-fecha">Fecha</label>
              <input id="ap-fecha" type="date" min={hoyLima()} value={form.fecha} onChange={cambiar('fecha')} required />
            </div>
            <div className="campo">
              <label htmlFor="ap-hora">Hora (Lima)</label>
              <input id="ap-hora" type="time" value={form.hora} onChange={cambiar('hora')} required />
            </div>
            <label className="aprobar-confirmacion">
              <input type="checkbox" checked={form.revisado} onChange={cambiar('revisado')} />
              Revisé el texto, los datos y las fotos.
            </label>
          </>
        ) : (
          <div className="campo">
            <label htmlFor="ap-motivo">Motivo</label>
            <textarea id="ap-motivo" value={form.motivo} onChange={cambiar('motivo')} rows={4} maxLength={500} autoFocus />
            <small>Si la publicación estaba aprobada, la aprobación se anula.</small>
          </div>
        )}
        {error && <p className="publicaciones-error" role="alert">{error}</p>}
        <div className="acciones-form">
          <button type="button" className="btn-secundario" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" className="btn-principal" disabled={enviando || (aprobando && pendientes.length > 0)}>
            {enviando ? 'Guardando...' : aprobando ? 'Aprobar' : 'Devolver'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
