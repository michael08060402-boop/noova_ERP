import { useRef, useState } from 'react';
import { FiRefreshCw, FiAlertCircle, FiSearch, FiFolderPlus, FiUploadCloud, FiLock } from 'react-icons/fi';
import Breadcrumb from './Breadcrumb';
import ListaArchivos from './ListaArchivos';
import BarraBusqueda from './BarraBusqueda';
import Loading from '../../../components/Loading';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';

export default function Explorador({
  items,
  cargando,
  buscando,
  error,
  ruta,
  enBusqueda,
  terminoBusqueda,
  carpetaArea,
  procesando,
  cargarCarpeta,
  navegarA,
  abrirArchivo,
  buscar,
  limpiarBusqueda,
  refrescar,
  crearCarpeta,
  subirArchivo,
  renombrarItem,
  eliminarItem
}) {
  const inputArchivoRef = useRef(null);

  const [modalCarpeta, setModalCarpeta] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState('');

  const [itemARenombrar, setItemARenombrar] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const [itemAEliminar, setItemAEliminar] = useState(null);

  const [mensaje, setMensaje] = useState(null);
  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 4000);
  }

  function handleAbrirCarpeta(item) {
    if (enBusqueda) {
      limpiarBusqueda();
    }
    cargarCarpeta(item.id, item.nombre);
  }

  async function confirmarCrearCarpeta(e) {
    e.preventDefault();
    if (!nombreCarpeta.trim()) return;
    try {
      await crearCarpeta(nombreCarpeta.trim());
      setModalCarpeta(false);
      setNombreCarpeta('');
      mostrarMensaje('success', 'Carpeta creada correctamente');
    } catch (err) {
      mostrarMensaje('error', err.message || 'No se pudo crear la carpeta');
    }
  }

  async function manejarSeleccionArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      await subirArchivo(archivo);
      mostrarMensaje('success', `"${archivo.name}" subido correctamente`);
    } catch (err) {
      mostrarMensaje('error', err.message || 'No se pudo subir el archivo');
    }
  }

  function abrirRenombrar(item) {
    setItemARenombrar(item);
    setNombreNuevo(item.nombre);
  }

  async function confirmarRenombrar(e) {
    e.preventDefault();
    if (!nombreNuevo.trim() || !itemARenombrar) return;
    try {
      await renombrarItem(itemARenombrar.id, nombreNuevo.trim());
      setItemARenombrar(null);
      mostrarMensaje('success', 'Elemento renombrado correctamente');
    } catch (err) {
      mostrarMensaje('error', err.message || 'No se pudo renombrar');
    }
  }

  async function confirmarEliminar() {
    if (!itemAEliminar) return;
    try {
      await eliminarItem(itemAEliminar.id);
      setItemAEliminar(null);
      mostrarMensaje('success', 'Elemento eliminado correctamente');
    } catch (err) {
      mostrarMensaje('error', err.message || 'No se pudo eliminar');
      setItemAEliminar(null);
    }
  }

  return (
    <div className="nube-explorador">
      {carpetaArea && (
        <div className="nube-aviso-area">
          <FiLock size={13} />
          <span>Tu acceso está limitado a la carpeta <strong>{carpetaArea}</strong>. Puedes organizar y subir archivos libremente dentro de ella.</span>
        </div>
      )}

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>{mensaje.texto}</div>
      )}

      <div className="nube-barra-superior">
        <Breadcrumb ruta={ruta} onNavegar={navegarA} />
        <div className="nube-acciones">
          <button
            className="btn-secundario btn-pequeno"
            onClick={() => setModalCarpeta(true)}
            disabled={cargando || buscando || procesando || enBusqueda}
            title="Nueva carpeta"
          >
            <FiFolderPlus size={14} /> Nueva carpeta
          </button>
          <button
            className="btn-principal btn-pequeno"
            onClick={() => inputArchivoRef.current?.click()}
            disabled={cargando || buscando || procesando || enBusqueda}
            title="Subir archivo"
          >
            <FiUploadCloud size={14} /> Subir archivo
          </button>
          <input
            ref={inputArchivoRef}
            type="file"
            className="nube-input-oculto"
            onChange={manejarSeleccionArchivo}
          />
          <button
            className="btn-secundario btn-pequeno"
            onClick={refrescar}
            disabled={cargando || buscando}
            title="Refrescar"
          >
            <FiRefreshCw size={14} className={cargando || buscando ? 'nube-spin' : ''} />
            Refrescar
          </button>
        </div>
      </div>

      <BarraBusqueda
        onBuscar={buscar}
        onLimpiar={limpiarBusqueda}
        enBusqueda={enBusqueda}
        termino={terminoBusqueda}
      />

      {enBusqueda && (
        <div className="nube-modo-busqueda">
          <FiSearch size={14} />
          <span>
            {buscando
              ? 'Buscando...'
              : `${items.length} resultado${items.length !== 1 ? 's' : ''} para "${terminoBusqueda}"`
            }
          </span>
        </div>
      )}

      {error ? (
        <div className="nube-error">
          <FiAlertCircle size={20} />
          <p>{error}</p>
          <button className="btn-secundario btn-pequeno" onClick={refrescar}>
            Reintentar
          </button>
        </div>
      ) : cargando || buscando ? (
        <Loading message={buscando ? 'Buscando documentos...' : 'Cargando documentos...'} />
      ) : (
        <ListaArchivos
          items={items}
          onAbrirCarpeta={handleAbrirCarpeta}
          onAbrirArchivo={abrirArchivo}
          enBusqueda={enBusqueda}
          puedeEditar
          onRenombrar={abrirRenombrar}
          onEliminar={setItemAEliminar}
        />
      )}

      <Modal isOpen={modalCarpeta} onClose={() => setModalCarpeta(false)} title="Nueva carpeta">
        <form onSubmit={confirmarCrearCarpeta} className="formulario">
          <div className="campo">
            <label>Nombre de la carpeta *</label>
            <input
              value={nombreCarpeta}
              onChange={(e) => setNombreCarpeta(e.target.value)}
              placeholder="Ej: Proyecto Minera XYZ"
              autoFocus
            />
          </div>
          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setModalCarpeta(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={procesando}>
              {procesando ? 'Creando...' : 'Crear carpeta'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!itemARenombrar} onClose={() => setItemARenombrar(null)} title="Renombrar">
        <form onSubmit={confirmarRenombrar} className="formulario">
          <div className="campo">
            <label>Nuevo nombre *</label>
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              autoFocus
            />
          </div>
          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setItemARenombrar(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={procesando}>
              {procesando ? 'Guardando...' : 'Renombrar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!itemAEliminar}
        onClose={() => setItemAEliminar(null)}
        onConfirm={confirmarEliminar}
        title={`¿Eliminar "${itemAEliminar?.nombre || ''}"?`}
        message={itemAEliminar?.tipo === 'carpeta'
          ? 'Esta acción eliminará la carpeta y todo su contenido. ¿Está seguro?'
          : 'Esta acción eliminará el archivo permanentemente. ¿Está seguro?'}
      />
    </div>
  );
}
