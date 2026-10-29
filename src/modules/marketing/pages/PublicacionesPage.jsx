import { useEffect, useMemo, useState } from 'react';
import { FiImage, FiRefreshCw } from 'react-icons/fi';
import usePublicaciones from '../hooks/usePublicaciones';
import ModalGenerarPieza from '../components/ModalGenerarPieza';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useAuth } from '../../../context/AuthContext';
import { eliminarPublicacion } from '../services/marketingService';
import TarjetaPublicacion from '../components/TarjetaPublicacion';
import VisorPublicacion from '../components/VisorPublicacion';
import { FILTROS } from '../components/redesSociales';
import '../../../styles/shared.css';
import './Publicaciones.css';

export default function PublicacionesPage() {
  const { publicaciones, cargando, error, cargar, actualizarPublicacion, quitarPublicacion } = usePublicaciones();
  const { userProfile } = useAuth();
  const puedeEliminar = ['gerencia', 'administrador', 'responsable_marketing'].includes(userProfile?.role);
  const [porEliminar, setPorEliminar] = useState(null);
  const [errorEliminar, setErrorEliminar] = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState('todo');
  const [generando, setGenerando] = useState(false);

  const visibles = useMemo(
    () => (filtro === 'todo' ? publicaciones : publicaciones.filter((p) => p.red === filtro)),
    [publicaciones, filtro]
  );

  const contar = (key) => (
    key === 'todo' ? publicaciones.length : publicaciones.filter((p) => p.red === key).length
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmarEliminacion = async () => {
    setErrorEliminar(null);
    try {
      await eliminarPublicacion(porEliminar.id);
      quitarPublicacion(porEliminar.id);
      setPorEliminar(null);
      return true;
    } catch (err) {
      setErrorEliminar(err.message);
      setPorEliminar(null);
      return false;
    }
  };

  const cambiarImagen = (direccion) => {
    setSeleccionada((actual) => {
      if (!actual || visibles.length < 2) return actual;
      const indice = visibles.findIndex((p) => p.id === actual.id);
      return visibles[(indice + direccion + visibles.length) % visibles.length];
    });
  };

  useEffect(() => {
    if (!seleccionada) return;
    const manejarTecla = (event) => {
      if (event.key === 'Escape') setSeleccionada(null);
      if (event.target instanceof HTMLElement && (event.target.matches('textarea, input, select') || event.target.isContentEditable)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direccion = event.key === 'ArrowLeft' ? -1 : 1;
      setSeleccionada((actual) => {
        if (!actual || visibles.length < 2) return actual;
        const indice = visibles.findIndex((p) => p.id === actual.id);
        return visibles[(indice + direccion + visibles.length) % visibles.length];
      });
    };
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [seleccionada, visibles]);

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Publicaciones</h1>
          <p className="pagina-subtitulo">Borradores de imágenes y carruseles en PDF</p>
        </div>
        <div className="publicaciones-acciones">
          <button type="button" className="btn-secundario" onClick={cargar} disabled={cargando}>
            <FiRefreshCw size={14} /> Actualizar
          </button>
          <button type="button" className="btn-principal" onClick={() => setGenerando(true)}>
            <FiImage size={14} /> Generar flyer
          </button>
        </div>
      </div>

      <div className="publicaciones-filtros" role="tablist" aria-label="Filtrar por red social">
        {FILTROS.map(({ key, label, Icono }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filtro === key}
            className={`publicaciones-filtro ${filtro === key ? 'publicaciones-filtro-activo' : ''}`}
            onClick={() => setFiltro(key)}
          >
            {Icono && <Icono size={14} aria-hidden="true" />}
            {label}
            <span className="publicaciones-filtro-conteo">{contar(key)}</span>
          </button>
        ))}
      </div>

      {error && <p className="publicaciones-error" role="alert">{error}</p>}
      {cargando && (
        <div className="publicaciones-cargando" role="status" aria-live="polite">
          <span className="publicaciones-spinner" aria-hidden="true" />
          <p>Cargando publicaciones, esto puede tardar unos segundos...</p>
        </div>
      )}

      {!cargando && !error && visibles.length === 0 && (
        <p className="publicaciones-vacio">
          {filtro === 'todo' ? 'No hay imágenes ni PDF en la carpeta.' : 'No hay imágenes ni PDF para esta red social.'}
        </p>
      )}

      <div className="publicaciones-grid">
        {visibles.map((p) => (
          <TarjetaPublicacion
            key={p.id}
            publicacion={p}
            onAbrir={setSeleccionada}
            onEliminar={puedeEliminar ? setPorEliminar : undefined}
          />
        ))}
      </div>

      {errorEliminar && <p className="publicaciones-error" role="alert">{errorEliminar}</p>}

      <ConfirmDialog
        isOpen={Boolean(porEliminar)}
        onClose={() => setPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title="¿Eliminar esta publicación?"
        message={`Se eliminará "${porEliminar?.titulo || porEliminar?.nombre || ''}" con todos sus archivos. Irá a la papelera de SharePoint.`}
      />

      <ModalGenerarPieza isOpen={generando} onClose={() => setGenerando(false)} />

      {seleccionada && (
        <VisorPublicacion
          publicacion={seleccionada}
          publicaciones={visibles}
          onActualizada={(actualizada) => {
            actualizarPublicacion(actualizada);
            setSeleccionada(actualizada);
          }}
          onCambiar={cambiarImagen}
          onCerrar={() => setSeleccionada(null)}
        />
      )}
    </div>
  );
}
