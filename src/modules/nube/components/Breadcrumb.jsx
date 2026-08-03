import { FiChevronRight, FiHome } from 'react-icons/fi';

// Breadcrumb de navegación del explorador de archivos
export default function Breadcrumb({ ruta, onNavegar }) {
  return (
    <nav className="nube-breadcrumb">
      <button
        className="breadcrumb-item breadcrumb-raiz"
        onClick={() => onNavegar(-1)}
        title="Inicio"
      >
        <FiHome size={14} />
        <span>Inicio</span>
      </button>

      {ruta.map((item, indice) => (
        <span key={item.id} className="breadcrumb-paso">
          <FiChevronRight size={12} className="breadcrumb-separador" />
          <button
            className={`breadcrumb-item ${indice === ruta.length - 1 ? 'breadcrumb-activo' : ''}`}
            onClick={() => indice < ruta.length - 1 && onNavegar(indice)}
            disabled={indice === ruta.length - 1}
          >
            {item.nombre}
          </button>
        </span>
      ))}
    </nav>
  );
}
