import { useRef, useState } from 'react';
import { FiEdit2, FiHeart, FiMessageCircle, FiMoreHorizontal, FiSend, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { getRed } from './redesSociales';
import logoNoova from '../../../assets/noova-logo.png';
import { useAuth } from '../../../context/AuthContext';
import { actualizarTextoPublicacion } from '../services/marketingService';
import { combinarTextoPost, separarHashtags } from '../utils/textoPost';

export default function VistaPreviaPost({ publicacion, children, onActualizada, onEdicionChange }) {
  const { userProfile } = useAuth();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const guardandoRef = useRef(false);
  const puedeEditar = ['gerencia', 'administrador', 'responsable_marketing'].includes(userProfile?.role)
    && Boolean(publicacion.metadatos?.jsonEtag);
  const red = getRed(publicacion.red);
  const esInstagram = publicacion.red === 'instagram';

  function editar() {
    const partes = separarHashtags(publicacion.texto || '');
    setBorrador(partes.texto);
    setHashtags(partes.hashtags);
    setError('');
    setGuardado(false);
    setEditando(true);
    onEdicionChange?.(true);
  }

  function cancelar() {
    setEditando(false);
    setError('');
    onEdicionChange?.(false);
  }

  async function guardar(event) {
    event.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setError('');
    setGuardando(true);
    try {
      const textoCompleto = combinarTextoPost(borrador, hashtags);
      const resultado = await actualizarTextoPublicacion({
        publicacionId: publicacion.id,
        texto: textoCompleto,
        eTag: publicacion.metadatos.jsonEtag
      });
      onActualizada?.({
        ...publicacion,
        texto: resultado.texto,
        metadatos: { ...publicacion.metadatos, ...resultado }
      });
      setEditando(false);
      setGuardado(true);
      onEdicionChange?.(false);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  const texto = (
    <div className="post-social-texto">
      {editando ? (
        <form className="post-social-editor" onSubmit={guardar}>
          <label htmlFor="post-texto">Texto de la publicación</label>
          <textarea id="post-texto" value={borrador} onChange={(event) => setBorrador(event.target.value)} maxLength={32000} disabled={guardando} autoFocus />
          <label htmlFor="post-hashtags">Hashtags</label>
          <input id="post-hashtags" value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#Ventilación #Minería" maxLength={2000} disabled={guardando} />
          <div className="post-social-editor-botones">
            <button type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : publicacion.texto ? (
        <p>{esInstagram && <strong>Noova Consulting </strong>}{publicacion.texto}</p>
      ) : <p className="post-social-sin-texto">No hay texto disponible para esta publicación.</p>}
    </div>
  );

  return (
    <div className="post-social-vista">
      <div className="post-social-etiqueta">Vista previa aproximada · {red?.label || 'Publicación'}</div>
      {puedeEditar && !editando && <button type="button" className="post-social-editar" onClick={editar}><FiEdit2 size={13} /> Editar texto y hashtags</button>}
      {guardado && <p className="post-social-guardado" role="status">Cambios guardados en SharePoint.</p>}
      {publicacion.aviso && <p className="post-social-aviso" role="status">{publicacion.aviso}</p>}
      <article className={`post-social post-social-${publicacion.red || 'general'}`} aria-label={`Vista previa en ${red?.label || 'red social'}`}>
        <header className="post-social-cabecera">
          <img className="post-social-avatar" src={logoNoova} alt="NOOVA" />
          <div>
            <strong>Noova Consulting</strong>
            <span>{publicacion.metadatos?.estado || 'Vista previa'}</span>
          </div>
          <FiMoreHorizontal size={20} aria-hidden="true" />
        </header>
        {!esInstagram && texto}
        <div className="post-social-media">{children}</div>
        <div className="post-social-acciones" aria-hidden="true">
          {esInstagram ? <><FiHeart /><FiMessageCircle /><FiSend /></> : <><span><FiThumbsUp /> Me gusta</span><span><FiMessageCircle /> Comentar</span><span><FiShare2 /> Compartir</span></>}
        </div>
        {esInstagram && texto}
      </article>
    </div>
  );
}
