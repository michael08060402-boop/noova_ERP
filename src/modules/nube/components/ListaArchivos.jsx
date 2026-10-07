import { FiFolder, FiFile, FiFileText, FiImage, FiFilePlus, FiExternalLink, FiEdit2, FiTrash2 } from 'react-icons/fi';

const ICONOS_ARCHIVO = {
  pdf: FiFileText,
  doc: FiFileText,
  docx: FiFileText,
  xls: FiFileText,
  xlsx: FiFileText,
  ppt: FiFileText,
  pptx: FiFileText,
  jpg: FiImage,
  jpeg: FiImage,
  png: FiImage,
  gif: FiImage,
  svg: FiImage,
  zip: FiFilePlus,
  rar: FiFilePlus,
  '7z': FiFilePlus,
};

const COLORES_CARPETA = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#EF4444',
  '#6366F1',
  '#D97706',
  '#059669',
];

function colorCarpeta(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return COLORES_CARPETA[Math.abs(hash) % COLORES_CARPETA.length];
}

function obtenerIcono(item) {
  if (item.tipo === 'carpeta') return FiFolder;
  const ext = item.extension || '';
  return ICONOS_ARCHIVO[ext] || FiFile;
}

function formatearTamano(bytes) {
  if (!bytes || bytes === 0) return '—';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let tamano = bytes;
  while (tamano >= 1024 && i < unidades.length - 1) {
    tamano /= 1024;
    i++;
  }
  return `${tamano.toFixed(i === 0 ? 0 : 1)} ${unidades[i]}`;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return '—';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function obtenerRutaPadre(rutaCompleta) {
  if (!rutaCompleta) return '';
  const partes = rutaCompleta.split('/');
  if (partes.length <= 1) return '';
  return partes.slice(0, -1).join(' / ');
}

export default function ListaArchivos({ items, onAbrirCarpeta, onAbrirArchivo, enBusqueda = false, onRenombrar, onEliminar, puedeEditar = false }) {
  if (items.length === 0) {
    return (
      <div className="nube-vacio">
        <FiFolder size={40} />
        <p>{enBusqueda ? 'No se encontraron documentos' : 'Esta carpeta esta vacia'}</p>
      </div>
    );
  }

  const ordenados = [...items].sort((a, b) => {
    if (a.tipo === 'carpeta' && b.tipo !== 'carpeta') return -1;
    if (a.tipo !== 'carpeta' && b.tipo === 'carpeta') return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <div className="nube-lista">
      <div className="nube-lista-header">
        <span className="nube-col nube-col-nombre">Nombre</span>
        <span className="nube-col nube-col-tamano">Tamano</span>
        <span className="nube-col nube-col-fecha">Modificado</span>
        <span className="nube-col nube-col-accion">Accion</span>
      </div>

      {ordenados.map(item => {
        const Icono = obtenerIcono(item);
        const esCarpeta = item.tipo === 'carpeta';
        const color = esCarpeta ? colorCarpeta(item.nombre) : null;
        const rutaPadre = enBusqueda ? obtenerRutaPadre(item.ruta) : '';

        return (
          <div
            key={item.id}
            className={`nube-item ${esCarpeta ? 'nube-item-carpeta' : 'nube-item-archivo'}`}
            onClick={() => esCarpeta ? onAbrirCarpeta(item) : null}
            role={esCarpeta ? 'button' : undefined}
            tabIndex={esCarpeta ? 0 : undefined}
            onKeyDown={(e) => {
              if (esCarpeta && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onAbrirCarpeta(item);
              }
            }}
          >
            <span className="nube-col nube-col-nombre">
              <Icono
                size={18}
                className={`nube-icono ${esCarpeta ? 'nube-icono-carpeta' : 'nube-icono-archivo'}`}
                style={esCarpeta ? { color } : undefined}
              />
              <span className="nube-nombre-contenedor">
                <span className="nube-nombre-texto" title={item.nombre}>{item.nombre}</span>
                {enBusqueda && rutaPadre && (
                  <span className="nube-ruta-busqueda" title={item.ruta}>
                    {rutaPadre}
                  </span>
                )}
                {enBusqueda && !esCarpeta && item.extension && (
                  <span className="nube-nombre-pista">.{item.extension}</span>
                )}
              </span>
            </span>
            <span className="nube-col nube-col-tamano">
              {esCarpeta ? '—' : formatearTamano(item.tamano)}
            </span>
            <span className="nube-col nube-col-fecha">
              {formatearFecha(item.fechaModificacion)}
            </span>
            <span className="nube-col nube-col-accion">
              {esCarpeta ? (
                <span className="nube-accion-texto">Abrir</span>
              ) : (
                <button
                  className="btn-accion nube-btn-descargar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAbrirArchivo(item.urlWeb);
                  }}
                  title="Abrir en SharePoint"
                  disabled={!item.urlWeb}
                >
                  <FiExternalLink size={16} />
                </button>
              )}
              {puedeEditar && !enBusqueda && (
                <>
                  <button
                    className="btn-accion"
                    onClick={(e) => { e.stopPropagation(); onRenombrar?.(item); }}
                    title="Renombrar"
                  >
                    <FiEdit2 size={15} />
                  </button>
                  <button
                    className="btn-accion btn-eliminar"
                    onClick={(e) => { e.stopPropagation(); onEliminar?.(item); }}
                    title="Eliminar"
                  >
                    <FiTrash2 size={15} />
                  </button>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
