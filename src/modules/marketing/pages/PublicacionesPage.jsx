import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import usePublicaciones from '../hooks/usePublicaciones';
import TarjetaPublicacion from '../components/TarjetaPublicacion';
import VisorPublicacion from '../components/VisorPublicacion';
import { FILTROS } from '../components/redesSociales';
import '../../../styles/shared.css';
import './Publicaciones.css';

export default function PublicacionesPage() {
  const { publicaciones, cargando, error, cargar } = usePublicaciones();
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState('todo');

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
        <button type="button" className="btn-secundario" onClick={cargar} disabled={cargando}>
          <FiRefreshCw size={14} /> Actualizar
        </button>
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
          <TarjetaPublicacion key={p.id} publicacion={p} onAbrir={setSeleccionada} />
        ))}
      </div>

      {seleccionada && (
        <VisorPublicacion
          publicacion={seleccionada}
          publicaciones={visibles}
          onCambiar={cambiarImagen}
          onCerrar={() => setSeleccionada(null)}
        />
      )}
    </div>
  );
}
