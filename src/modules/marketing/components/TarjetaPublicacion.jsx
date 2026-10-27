import { formatDate } from '../../../utils/formatDate';
import { getRed } from './redesSociales';
import { FiFileText } from 'react-icons/fi';

export default function TarjetaPublicacion({ publicacion, onAbrir }) {
  const red = getRed(publicacion.red);

  return (
    <button
      type="button"
      className="publicacion-card"
      onClick={() => onAbrir(publicacion)}
    >
      <div className="publicacion-imagen">
        {publicacion.urlMiniatura ? (
          <img src={publicacion.urlMiniatura} alt={publicacion.nombre} loading="lazy" />
        ) : (
          <span className="publicacion-sin-imagen">
            {publicacion.tipo === 'pdf' ? <><FiFileText size={36} /> Documento PDF</> : 'Sin vista previa'}
          </span>
        )}
        {publicacion.tipo === 'pdf' && <span className="publicacion-tipo-pdf">PDF</span>}
        {red && (
          <span className={`publicacion-red publicacion-red-${red.key}`} title={red.label}>
            <red.Icono size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="publicacion-info">
        <span className="publicacion-nombre" title={publicacion.nombre}>{publicacion.nombre}</span>
        <span className="publicacion-fecha">{formatDate(publicacion.fechaModificacion)}</span>
      </div>
    </button>
  );
}
