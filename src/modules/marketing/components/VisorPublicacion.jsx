import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronLeft, FiChevronRight, FiFileText, FiSend, FiX } from 'react-icons/fi';
import { getRed } from './redesSociales';
import { useAuth } from '../../../context/AuthContext';
import { crearObservacion, listarObservaciones } from '../services/observacionesService';

const formatoFechaObservacion = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

function Observaciones({ publicacion }) {
  const { currentUser, userProfile } = useAuth();
  const [notas, setNotas] = useState([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [reintento, setReintento] = useState(0);
  const solicitudRef = useRef(null);
  const enviandoRef = useRef(false);
  const montadoRef = useRef(false);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enviada) return;
    const temporizador = window.setTimeout(() => setEnviada(false), 3000);
    return () => window.clearTimeout(temporizador);
  }, [enviada]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorCarga('');
    listarObservaciones(publicacion.id)
      .then((items) => { if (activo) setNotas(items); })
      .catch((fallo) => { if (activo) setErrorCarga(fallo.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [publicacion.id, reintento]);

  async function enviar(event) {
    event.preventDefault();
    if (!texto.trim() || enviandoRef.current || cargando || !currentUser || !userProfile) return;
    enviandoRef.current = true;
    setEnviando(true);
    setEnviada(false);
    setError('');
    try {
      solicitudRef.current ||= crypto.randomUUID();
      const nota = await crearObservacion({
        publicacionId: publicacion.id,
        texto: texto.trim(),
        solicitudId: solicitudRef.current
      });
      if (!montadoRef.current) return;
      setNotas((anteriores) => [nota, ...anteriores.filter((item) => item.id !== nota.id)]);
      setTexto('');
      solicitudRef.current = null;
      setEnviada(true);
    } catch (fallo) {
      if (montadoRef.current) setError(fallo.message);
    } finally {
      enviandoRef.current = false;
      if (montadoRef.current) setEnviando(false);
    }
  }

  return (
    <aside className="publicacion-observaciones" aria-labelledby="observaciones-titulo">
      <h2 id="observaciones-titulo">Observaciones ({cargando || errorCarga ? '…' : notas.length})</h2>
      <div className="publicacion-observaciones-lista" aria-live="polite" role="region" aria-label="Comentarios de la publicación" tabIndex={0}>
        {cargando && <p className="publicacion-observaciones-aviso" role="status">Cargando observaciones…</p>}
        {errorCarga && (
          <div className="publicacion-observaciones-error" role="alert">
            <p>{errorCarga}</p>
            <button type="button" disabled={enviando} onClick={() => setReintento((valor) => valor + 1)}>Reintentar</button>
          </div>
        )}
        {!cargando && !errorCarga && notas.length === 0 && <p className="publicacion-observaciones-aviso">Todavía no hay comentarios.</p>}
        {notas.map((nota) => (
          <article key={nota.id}>
            <div className="publicacion-observacion-meta">
              <strong className="publicacion-observacion-autor" title={nota.usuarioNombre}>{nota.usuarioNombre}</strong>
              <time dateTime={nota.fecha}>{formatoFechaObservacion.format(new Date(nota.fecha))}</time>
            </div>
            <p>{nota.texto}</p>
          </article>
        ))}
      </div>
      <form onSubmit={enviar}>
        <label className="publicacion-solo-lector" htmlFor="publicacion-observacion">Escribe una observación</label>
        <textarea
          id="publicacion-observacion"
          placeholder="Escribe una observación…"
          value={texto}
          onChange={(event) => {
            setTexto(event.target.value);
            solicitudRef.current = null;
            setEnviada(false);
            setError('');
          }}
          maxLength={500}
          disabled={enviando}
        />
        <span className="publicacion-observacion-contador">{texto.length} / 500</span>
        <button
          type="submit"
          className="publicacion-observacion-enviar"
          disabled={!texto.trim() || enviando || cargando || !currentUser || !userProfile}
          aria-label={enviando ? 'Enviando observación' : 'Enviar observación'}
          title={enviando ? 'Enviando…' : 'Enviar observación'}
          aria-busy={enviando}
        >
          <FiSend size={18} aria-hidden="true" />
        </button>
        {error && <p role="alert">{error}</p>}
        {enviada && <p className="publicacion-observaciones-aviso" role="status">Observación enviada.</p>}
      </form>
    </aside>
  );
}

export default function VisorPublicacion({ publicacion, publicaciones, onCambiar, onCerrar }) {
  const red = getRed(publicacion.red);
  const indice = publicaciones.findIndex((item) => item.id === publicacion.id);
  const cerrarRef = useRef(null);
  const [proporcionImagen, setProporcionImagen] = useState(null);
  const proporcion = proporcionImagen?.id === publicacion.id ? proporcionImagen.valor : null;

  useEffect(() => {
    const anterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    return () => {
      document.body.style.overflow = overflowAnterior;
      anterior?.focus();
    };
  }, []);

  function manejarTecla(event) {
    if (event.key !== 'Tab') return;
    const elementos = event.currentTarget.querySelectorAll('button:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]');
    const primero = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo?.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero?.focus();
    }
  }

  return createPortal(
    <div className="publicacion-visor publicacion-revision-overlay" onClick={onCerrar}>
      <section
        className={`publicacion-revision ${publicacion.tipo === 'pdf' ? 'publicacion-revision-documento' : ''}`}
        style={proporcion ? { '--publicacion-ancho-imagen': `min(660px, calc((100dvh - 170px) * ${proporcion}))` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publicacion-visor-titulo"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={manejarTecla}
      >
        <header className="publicacion-revision-cabecera">
          <div className="publicacion-revision-identidad">
            <span className={`publicacion-revision-red ${red ? `publicacion-red-${red.key}` : ''}`} title={red?.label || 'Sin red de destino'}>
              {red ? <red.Icono size={30} aria-hidden="true" /> : <FiFileText size={28} aria-hidden="true" />}
              <span className="publicacion-solo-lector">{red?.label || 'Sin red de destino'}</span>
            </span>
            <h2 id="publicacion-visor-titulo" title={publicacion.nombre}>{publicacion.nombre}</h2>
          </div>
          <nav className="publicacion-revision-controles" aria-label="Recorrer publicaciones">
            <button type="button" onClick={() => onCambiar(-1)} disabled={publicaciones.length < 2} aria-label="Publicación anterior"><FiChevronLeft size={26} /></button>
            <span aria-live="polite">{indice < 0 ? 1 : indice + 1} de {publicaciones.length}</span>
            <button type="button" onClick={() => onCambiar(1)} disabled={publicaciones.length < 2} aria-label="Publicación siguiente"><FiChevronRight size={26} /></button>
          </nav>
          <button ref={cerrarRef} type="button" className="publicacion-revision-cerrar" onClick={onCerrar} aria-label="Cerrar"><FiX size={30} /></button>
        </header>
        <div className="publicacion-revision-cuerpo">
          <div className="publicacion-revision-preview">
            {publicacion.tipo === 'pdf' ? (
              <div className="publicacion-pdf-acceso">
                {(publicacion.urlDocumento || publicacion.urlWeb) ? (
                  <a href={publicacion.urlDocumento || publicacion.urlWeb} target="_blank" rel="noopener noreferrer">Abrir PDF para visualizar carrusel ↗</a>
                ) : <span>PDF no disponible. Actualiza las publicaciones.</span>}
              </div>
            ) : <img
              key={publicacion.id}
              src={publicacion.urlGrande || publicacion.urlMiniatura}
              alt={publicacion.nombre}
              onLoad={(event) => {
                const imagen = event.currentTarget;
                if (imagen.naturalHeight > 0) {
                  setProporcionImagen({ id: publicacion.id, valor: imagen.naturalWidth / imagen.naturalHeight });
                }
              }}
            />}
          </div>
          <Observaciones key={publicacion.id} publicacion={publicacion} />
        </div>
      </section>
    </div>,
    document.body
  );
}
