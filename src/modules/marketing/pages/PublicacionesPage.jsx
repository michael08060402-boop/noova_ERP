import { useState } from 'react';
import { FiChevronDown, FiImage, FiRefreshCw } from 'react-icons/fi';
import TarjetaPublicacion from '../components/TarjetaPublicacion';
import { FILTROS } from '../components/redesSociales';
import { claveEstado } from '../utils/aprobacion';
import './Publicaciones.css';

const ESTADOS = [
  { key: 'todas', label: 'Todas' },
  { key: 'borrador', label: 'Borradores' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'publicada', label: 'Publicadas' }
];

const PASO = 10;

export function filtrarPublicaciones(publicaciones, filtroRed, filtroEstado) {
  return publicaciones.filter((p) => (filtroRed === 'todo' || p.red === filtroRed)
    && (filtroEstado === 'todas' || claveEstado(p.metadatos?.estado) === filtroEstado));
}

// Sección «Piezas» del tablero: presentación pura, no sabe de funciones en la nube.
export default function PublicacionesVista({
  publicaciones, cargando, error, errorEliminar, filtroRed, filtroEstado,
  onFiltroRed, onFiltroEstado, onActualizar, onAbrir, onEliminar
}) {
  const porRed = (p) => filtroRed === 'todo' || p.red === filtroRed;
  const porEstado = (p) => filtroEstado === 'todas' || claveEstado(p.metadatos?.estado) === filtroEstado;
  const visibles = filtrarPublicaciones(publicaciones, filtroRed, filtroEstado);
  const [limite, setLimite] = useState(PASO);
  const mostradas = visibles.slice(0, limite);
  // Al cambiar de filtro se vuelve a la primera tanda.
  const filtrar = (funcion) => (valor) => { setLimite(PASO); funcion(valor); };
  const contarEstado = (key) => publicaciones.filter((p) => porRed(p) && (key === 'todas' || claveEstado(p.metadatos?.estado) === key)).length;
  const contarRed = (key) => publicaciones.filter((p) => (key === 'todo' || p.red === key) && porEstado(p)).length;

  return (
    <section id="piezas" className="mk-piezas-seccion" aria-labelledby="piezas-titulo">
      <div className="mk-barra">
        <h2 id="piezas-titulo" className="mk-seccion-titulo">Piezas</h2>
        <div className="mk-acciones">
          <div className="mk-segmentos" role="tablist" aria-label="Filtrar por estado">
            {ESTADOS.map(({ key, label }) => (
              <button key={key} type="button" role="tab" aria-selected={filtroEstado === key} className="mk-segmento" onClick={() => filtrar(onFiltroEstado)(key)}>
                {label} <small>{contarEstado(key)}</small>
              </button>
            ))}
          </div>
          <button type="button" className="mk-boton-icono" onClick={onActualizar} disabled={cargando} aria-label="Actualizar piezas" title="Actualizar">
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="mk-chips" role="group" aria-label="Filtrar por red social">
        {FILTROS.map(({ key, label, Icono, color }) => (
          <button key={key} type="button" aria-pressed={filtroRed === key} className={`mk-chip ${Icono ? '' : 'mk-chip-todas'}`} onClick={() => filtrar(onFiltroRed)(key)}>
            {Icono && <span className="mk-red" style={{ background: color }}><Icono size={12} aria-hidden="true" /></span>}
            {label} <small>{contarRed(key)}</small>
          </button>
        ))}
      </div>

      {error && <p className="mk-error" role="alert">{error}</p>}

      {cargando ? (
        <div className="mk-piezas" role="status" aria-label="Cargando piezas">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="mk-esqueleto" />)}
        </div>
      ) : visibles.length === 0 && !error ? (
        <div className="mk-vacio">
          <FiImage size={34} aria-hidden="true" />
          <strong>{publicaciones.length === 0 ? 'Todavía no hay piezas' : 'Ninguna pieza coincide con el filtro'}</strong>
          <span>{publicaciones.length === 0 ? 'Genera la primera con el botón «Generar pieza».' : 'Prueba con otra red u otro estado.'}</span>
        </div>
      ) : (
        <div className="mk-piezas">
          {mostradas.map((p) => <TarjetaPublicacion key={p.id} publicacion={p} onAbrir={onAbrir} onEliminar={onEliminar} />)}
        </div>
      )}

      {!cargando && visibles.length > limite && (
        <div className="mk-ver-mas">
          <button type="button" className="btn-secundario" onClick={() => setLimite((actual) => actual + PASO)}>
            <FiChevronDown size={15} /> Ver más <small>({visibles.length - limite} restantes)</small>
          </button>
        </div>
      )}

      {errorEliminar && <p className="mk-error" role="alert">{errorEliminar}</p>}
    </section>
  );
}
