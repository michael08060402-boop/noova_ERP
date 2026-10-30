import { formatDate } from '../../../utils/formatDate';
import { getRed } from './redesSociales';
import { FiFileText, FiImage, FiTrash2 } from 'react-icons/fi';
import { claveEstado, etiquetaEstado } from '../utils/aprobacion';

export default function TarjetaPublicacion({ publicacion, onAbrir, onEliminar }) {
  const red = getRed(publicacion.red);
  const estado = publicacion.metadatos?.estado;
  const titulo = publicacion.titulo || publicacion.nombre;

  return (
    <article className="mk-pieza">
      <button type="button" className="mk-pieza-abrir" onClick={() => onAbrir(publicacion)}>
        <div className="mk-pieza-imagen">
          {publicacion.urlMiniatura ? (
            <img src={publicacion.urlMiniatura} alt={publicacion.nombre} loading="lazy" />
          ) : (
            <span className="mk-pieza-vacia">
              {publicacion.tipo === 'pdf' ? <FiFileText size={30} aria-hidden="true" /> : <FiImage size={30} aria-hidden="true" />}
              {publicacion.tipo === 'pdf' ? 'Documento PDF' : 'Sin vista previa'}
            </span>
          )}
          {red && <span className="mk-red" style={{ background: red.color }} title={red.label}><red.Icono size={13} aria-hidden="true" /></span>}
          {publicacion.tipo === 'pdf' && <span className="mk-pieza-tipo">PDF</span>}
        </div>
        <div className="mk-pieza-info">
          <span className={`mk-estado mk-estado-${claveEstado(estado)}`}><i aria-hidden="true" />{etiquetaEstado(estado)}</span>
          <strong title={titulo}>{titulo}</strong>
          <small>{formatDate(publicacion.fechaModificacion)}{publicacion.metadatos?.origen === 'manual' ? ' · editada a mano' : ''}</small>
        </div>
      </button>
      {onEliminar && (
        <button type="button" className="mk-pieza-eliminar" onClick={() => onEliminar(publicacion)} aria-label={`Eliminar ${titulo}`} title="Eliminar">
          <FiTrash2 size={14} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
