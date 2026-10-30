import { useRef, useState } from 'react';
import { FiCalendar, FiCheckCircle, FiCopy, FiCornerUpLeft, FiDownload, FiEdit2, FiUpload, FiHeart, FiMessageCircle, FiMoreHorizontal, FiSend, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { getRed } from './redesSociales';
import logoNoova from '../../../assets/noova-logo.png';
import { useAuth } from '../../../context/AuthContext';
import { actualizarTextoPublicacion } from '../services/marketingService';
import { combinarTextoPost, separarHashtags } from '../utils/textoPost';
import { claveEstado, estaAprobada, etiquetaEstado, puedeAprobar } from '../utils/aprobacion';
import { puedeUsarTaller } from '../utils/archivosVersion';
import ModalAprobar from './ModalAprobar';
import ModalPublicada from './ModalPublicada';
import ModalTaller from './ModalTaller';
import HistorialPublicacion from './HistorialPublicacion';

export default function VistaPreviaPost({ publicacion, children, onActualizada, onEdicionChange }) {
  const { userProfile } = useAuth();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const guardandoRef = useRef(false);
  const [modoAprobar, setModoAprobar] = useState(null);
  const [modoTaller, setModoTaller] = useState(null);
  const [marcando, setMarcando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState('');
  const puedeEditar = ['gerencia', 'administrador', 'responsable_marketing'].includes(userProfile?.role)
    && Boolean(publicacion.metadatos?.jsonEtag);
  const aprobador = puedeAprobar(userProfile, publicacion);
  const aprobada = estaAprobada(publicacion);
  const porPublicar = aprobada && claveEstado(publicacion.metadatos?.estado) !== 'publicada';
  const taller = puedeUsarTaller(userProfile, publicacion) && publicacion.tipo !== 'video';
  const editadaAMano = publicacion.metadatos?.origen === 'manual';
  const aprobacion = publicacion.metadatos?.aprobacion;
  const devuelto = publicacion.metadatos?.devuelto;
  const red = getRed(publicacion.red);
  const esInstagram = publicacion.red === 'instagram';

  function cambioDeEstado(resultado) {
    onActualizada?.({ ...publicacion, metadatos: { ...publicacion.metadatos, ...resultado } });
    setAviso(resultado.origen === 'manual' && resultado.estado === 'borrador' && !resultado.devuelto
      ? 'Versión subida. Pulsa Actualizar en Piezas para ver la imagen nueva.'
      : /publicad/i.test(resultado.estado) ? 'Publicación marcada como publicada.'
        : resultado.estado === 'aprobado' ? 'Publicación aprobada.' : 'Publicación devuelta a borrador.');
    setGuardado(false);
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(publicacion.texto || '');
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  function editar() {
    const partes = separarHashtags(publicacion.texto || '');
    setBorrador(partes.texto);
    setHashtags(partes.hashtags);
    setError('');
    setGuardado(false);
    setAviso('');
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
      {publicacion.metadatos && (
        <p className={`post-social-estado ${aprobada ? 'post-social-estado-aprobada' : ''}`} role="status">
          <strong>{etiquetaEstado(publicacion.metadatos.estado)}</strong>
          {editadaAMano && ' · editada a mano'}
          {aprobacion && ` · por ${aprobacion.por} para ${getRed(aprobacion.red)?.label || aprobacion.red}, ${aprobacion.fecha} ${aprobacion.hora}`}
          {!aprobada && devuelto?.motivo && ` · devuelta: ${devuelto.motivo}`}
        </p>
      )}
      <div className="post-social-acciones-estado">
        {puedeEditar && !editando && <button type="button" className="post-social-editar" onClick={editar} title={aprobada ? 'Editar anula la aprobación' : undefined}><FiEdit2 size={13} /> Editar texto y hashtags</button>}
        {taller && !editando && <button type="button" className="post-social-editar" onClick={() => { setAviso(''); setModoTaller('paquete'); }}><FiDownload size={13} /> Descargar paquete</button>}
        {taller && !editando && <button type="button" className="post-social-editar" onClick={() => { setAviso(''); setModoTaller('version'); }}><FiUpload size={13} /> Subir versión editada</button>}
        {aprobador && !editando && !aprobada && <button type="button" className="post-social-editar post-social-aprobar" onClick={() => { setAviso(''); setModoAprobar('aprobar'); }}><FiCheckCircle size={13} /> Aprobar</button>}
        {porPublicar && !editando && publicacion.texto && <button type="button" className="post-social-editar" onClick={copiarTexto}><FiCopy size={13} /> {copiado ? 'Copiado' : 'Copiar texto'}</button>}
        {aprobador && porPublicar && !editando && <button type="button" className="post-social-editar" disabled title="Programar la publicación llegará en una próxima versión"><FiCalendar size={13} /> Programar <span className="mk-pronto">Próximamente</span></button>}
        {aprobador && porPublicar && !editando && <button type="button" className="post-social-editar post-social-aprobar" onClick={() => { setAviso(''); setMarcando(true); }}><FiCheckCircle size={13} /> Marcar publicada</button>}
        {aprobador && !editando && claveEstado(publicacion.metadatos?.estado) !== 'publicada' && <button type="button" className="post-social-editar" onClick={() => { setAviso(''); setModoAprobar('devolver'); }}><FiCornerUpLeft size={13} /> {aprobada ? 'Anular aprobación' : 'Devolver con motivo'}</button>}
      </div>
      {aviso && <p className="post-social-guardado" role="status">{aviso}</p>}
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
      {publicacion.metadatos?.jsonEtag && <HistorialPublicacion publicacionId={publicacion.id} version={publicacion.metadatos.jsonEtag} />}
      {modoTaller && (
        <ModalTaller
          key={`${modoTaller}-${publicacion.metadatos.jsonEtag}`}
          modo={modoTaller}
          publicacion={publicacion}
          onClose={() => setModoTaller(null)}
          onCambiada={cambioDeEstado}
        />
      )}
      {marcando && (
        <ModalPublicada
          key={publicacion.metadatos.jsonEtag}
          publicacion={publicacion}
          onClose={() => setMarcando(false)}
          onHecho={cambioDeEstado}
        />
      )}
      {modoAprobar && (
        <ModalAprobar
          key={`${modoAprobar}-${publicacion.metadatos.jsonEtag}`}
          isOpen
          modo={modoAprobar}
          publicacion={publicacion}
          onClose={() => setModoAprobar(null)}
          onCambiada={cambioDeEstado}
        />
      )}
    </div>
  );
}
