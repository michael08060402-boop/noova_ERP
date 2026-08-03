import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FiEdit2, FiTrash2, FiSearch, FiPlus, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import { useMangas } from '../hooks/useMangas';
import { formatUSD } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Mangas.css';

// Lista de tipos predefinidos de mangas de ventilación y accesorios
// (basado en el catálogo oficial NOOVA / NOOVADUCT)
const TIPOS_MANGA = [
  // Mangas de ventilación
  'Manga de ventilación (Inyección)',
  'Manga de ventilación (Extracción)',
  'Espiralado',
  'Manga lateral izquierdo',
  'Manga lateral derecho',
  'Codo',
  'Conector tipo Y',
  // Accesorios
  'Accesorio de reducción',
  'Accesorio T',
  // Materiales
  'Lona PVC 500 gr/m²',
  'Lona PVC 600 gr/m²'
];

// Tipos de acople disponibles (según catálogo)
const TIPOS_ACOPLAMIENTO = ['Cierre', 'Velcro'];

const CATEGORIA_OTRO = '__OTRO__';

const FORMULARIO_VACIO = {
  codigo: '',
  nombre: '',
  categoria: '',
  tipoProducto: 'manga',
  material: '',
  diametro: '',
  longitud: '',
  tipoAcople: '',
  unidadMedida: 'PZA.',
  precio: ''
};

// Unidades de medida para mangas: PZA (pieza), ML (metros lineales), Pulgadas
const UNIDADES_MEDIDA = ['PZA.', 'ML', 'Pulgadas'];

export default function Mangas() {
  const { mangas, loading, addManga, editManga, removeManga } = useMangas();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    // Limpiar cualquier timeout previo para evitar que se cancele antes de tiempo
    if (window._mangaMsgTimeout) clearTimeout(window._mangaMsgTimeout);
    window._mangaMsgTimeout = setTimeout(() => setMensaje(null), 5000);
  }

  function cerrarMensaje() {
    if (window._mangaMsgTimeout) clearTimeout(window._mangaMsgTimeout);
    setMensaje(null);
  }

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [orden, setOrden] = useState('asc');
  const [guardando, setGuardando] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaCustom, setCategoriaCustom] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({ defaultValues: FORMULARIO_VACIO });

  const categoriaSeleccionada = watch('categoria');
  const tipoProductoSeleccionado = watch('tipoProducto');

  const handleCategoriaChange = (e) => {
    const valor = e.target.value;
    const esOtra = valor === CATEGORIA_OTRO;
    setCategoriaEsOtra(esOtra);
    if (!esOtra) {
      setCategoriaCustom('');
      setValue('categoria', valor, { shouldValidate: true });
    } else {
      setValue('categoria', '', { shouldValidate: true });
    }
  };

  const mangasFiltrados = useMemo(() => {
    return mangas
      .filter((m) => {
        const term = terminoBusqueda.toLowerCase();
        return (
          m.codigo?.toLowerCase().includes(term) ||
          m.nombre?.toLowerCase().includes(term) ||
          m.categoria?.toLowerCase().includes(term) ||
          m.diametro?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (orden === 'asc' || orden === 'desc') {
          const nameA = a.nombre?.toLowerCase() || '';
          const nameB = b.nombre?.toLowerCase() || '';
          return orden === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        if (orden === 'codigo-asc') return (a.codigo || '').localeCompare(b.codigo || '');
        if (orden === 'precio-asc') return (Number(a.precio) || 0) - (Number(b.precio) || 0);
        if (orden === 'precio-desc') return (Number(b.precio) || 0) - (Number(a.precio) || 0);
        return 0;
      });
  }, [mangas, terminoBusqueda, orden]);

  const mangasPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return mangasFiltrados.slice(inicio, inicio + porPagina);
  }, [mangasFiltrados, paginaActual, porPagina]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }

  function alCambiarOrden(valor) {
    setOrden(valor);
    setPaginaActual(1);
  }

  function nuevaManga() {
    setEditandoId(null);
    reset(FORMULARIO_VACIO);
    setCategoriaEsOtra(false);
    setCategoriaCustom('');
    setMostrarModal(true);
  }

  function editarManga(manga) {
    setEditandoId(manga.id);
    const categoria = manga.categoria || '';
    const esPredefinida = TIPOS_MANGA.includes(categoria);
    setCategoriaEsOtra(!esPredefinida && categoria !== '');
    setCategoriaCustom(esPredefinida ? '' : categoria);
    reset({
      codigo: manga.codigo || '',
      nombre: manga.nombre || '',
      categoria: esPredefinida ? categoria : (categoria ? CATEGORIA_OTRO : ''),
      tipoProducto: manga.tipoProducto || 'manga',
      material: manga.material || '',
      diametro: manga.diametro || '',
      longitud: manga.longitud || '',
      tipoAcople: manga.tipoAcople || '',
      unidadMedida: manga.unidadMedida || 'PZA.',
      precio: manga.precio || ''
    });
    setMostrarModal(true);
  }

  function solicitarEliminar(id) {
    setEliminarId(id);
    setMostrarConfirm(true);
  }

  async function alEnviar(data) {
    let categoriaFinal = data.categoria;
    if (categoriaEsOtra) {
      categoriaFinal = categoriaCustom.trim();
      if (!categoriaFinal) {
        mostrarMensaje('error', 'Escriba el nombre del tipo personalizado');
        return;
      }
    }

    setGuardando(true);
    try {
      const payload = {
        codigo: data.codigo,
        nombre: data.nombre,
        categoria: categoriaFinal,
        tipoProducto: data.tipoProducto || 'manga',
        material: data.material || '',
        diametro: data.diametro || '',
        longitud: data.longitud || '',
        tipoAcople: data.tipoAcople || '',
        unidadMedida: data.tipoProducto === 'accesorio' ? 'PZA.' : (data.unidadMedida || 'PZA.'),
        precio: Number(data.precio) || 0
      };
      if (editandoId) {
        await editManga(editandoId, payload);
        mostrarMensaje('success', `Manga "${data.nombre}" actualizada correctamente`);
      } else {
        await addManga(payload);
        mostrarMensaje('success', `Manga "${data.nombre}" creada correctamente`);
      }
      setMostrarModal(false);
      reset(FORMULARIO_VACIO);
      setCategoriaEsOtra(false);
      setCategoriaCustom('');
    } catch (err) {
      console.error('Error guardando manga:', err);
      mostrarMensaje('error', 'Error al guardar manga: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      const mangaEliminada = mangas.find(m => m.id === eliminarId);
      await removeManga(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
      mostrarMensaje('success', `Manga "${mangaEliminada?.nombre || ''}" eliminada correctamente`);
    } catch (err) {
      console.error('Error eliminando manga:', err);
      mostrarMensaje('error', 'Error al eliminar manga: ' + err.message);
    }
  }

  if (loading) return <Loading message="Cargando mangas de ventilación..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Mangas de Ventilación</h1>
          <p className="pagina-subtitle">{mangas.length} mangas registrados</p>
        </div>
        <button className="btn-principal" onClick={nuevaManga}>
          <FiPlus size={16} /> Nueva Manga
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo} mensaje-flash-mejorado`}>
          <span className="mensaje-flash-icono">
            {mensaje.tipo === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
          </span>
          <span className="mensaje-flash-texto">{mensaje.texto}</span>
          <button className="mensaje-flash-cerrar" onClick={cerrarMensaje} title="Cerrar">
            <FiX size={16} />
          </button>
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por código, descripción, tipo o diámetro..."
            value={terminoBusqueda}
            onChange={(e) => alCambiarBusqueda(e.target.value)}
          />
        </div>
        <select
          className="selector-orden"
          value={orden}
          onChange={(e) => alCambiarOrden(e.target.value)}
        >
          <option value="asc">Descripción A-Z</option>
          <option value="desc">Descripción Z-A</option>
          <option value="codigo-asc">Código A-Z</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
        </select>
      </div>

      <div className="tarjeta-tabla">
        {mangasFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron mangas de ventilación</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={mangasFiltrados.length}
              paginaActual={paginaActual}
              porPagina={porPagina}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={setPorPagina}
            />
            <div className="tabla-contenedor">
              <table className="tabla-datos tabla-mangas">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Material</th>
                    <th className="texto-centro">Diámetro</th>
                    <th className="texto-centro">Longitud</th>
                    <th className="texto-centro">Acople</th>
                    <th className="texto-centro">Unidad</th>
                    <th className="texto-derecha">Precio</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mangasPaginados.map((m) => (
                    <tr key={m.id}>
                      <td className="texto-codigo">{m.codigo}</td>
                      <td className="texto-negrita">{m.nombre}</td>
                      <td>
                        {m.categoria ? (
                          <span className="badge-categoria badge-categoria-manga">{m.categoria}</span>
                        ) : '-'}
                      </td>
                      <td>{m.material || '-'}</td>
                      <td className="texto-centro">{m.diametro || '-'}</td>
                      <td className="texto-centro">{m.longitud || '-'}</td>
                      <td className="texto-centro">{m.tipoAcople || '-'}</td>
                      <td className="texto-centro">{m.unidadMedida || '-'}</td>
                      <td className="texto-derecha texto-negrita">{formatUSD(m.precio || 0)}</td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => editarManga(m)} title="Editar">
                            <FiEdit2 size={16} />
                          </button>
                          <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminar(m.id)} title="Eliminar">
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={mostrarModal}
        onClose={() => setMostrarModal(false)}
        title={editandoId ? 'Editar Manga / Accesorio' : 'Nueva Manga / Accesorio'}
      >
        <form onSubmit={handleSubmit(alEnviar)} className="formulario">
          <div className="campo">
            <label>Tipo</label>
            <select
              {...register('categoria')}
              onChange={handleCategoriaChange}
              value={categoriaSeleccionada || ''}
            >
              <option value="">-- Seleccionar tipo --</option>
              {TIPOS_MANGA.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
              <option value={CATEGORIA_OTRO}>Otro (escribir...)</option>
            </select>
            {categoriaEsOtra && (
              <input
                type="text"
                value={categoriaCustom}
                onChange={(e) => setCategoriaCustom(e.target.value)}
                placeholder="Escriba el tipo personalizado"
                className="input-categoria-custom"
                autoFocus
              />
            )}
          </div>

          <div className="campo">
            <label>Código *</label>
            <input
              {...register('codigo', { required: 'El código es requerido' })}
              className={errors.codigo ? 'input-error' : ''}
              placeholder="MG-001"
            />
            {errors.codigo && <span className="mensaje-error">{errors.codigo.message}</span>}
          </div>

          <div className="campo">
            <label>Descripción *</label>
            <input
              {...register('nombre', { required: 'La descripción es requerida' })}
              className={errors.nombre ? 'input-error' : ''}
              placeholder="Descripción de la manga de ventilación"
            />
            {errors.nombre && <span className="mensaje-error">{errors.nombre.message}</span>}
          </div>

          <div className="campo">
            <label>Tipo de producto *</label>
            <select {...register('tipoProducto')}>
              <option value="manga">Manga de ventilación (venta por metro lineal)</option>
              <option value="accesorio">Accesorio de conexión (venta por pieza)</option>
            </select>
            <span className="pista-form">
              {tipoProductoSeleccionado === 'accesorio'
                ? 'Los accesorios (ej. Codo, Conector tipo Y) se venden por pieza, no por metro lineal.'
                : 'Las mangas de ventilación se venden por metro lineal.'}
            </span>
          </div>

          <div className="fila-form fila-form-2">
            <div className="campo">
              <label>Material</label>
              <select {...register('material')}>
                <option value="">-- Seleccionar material --</option>
                <option value="Lona PVC 500 gr/m²">Lona PVC 500 gr/m²</option>
                <option value="Lona PVC 600 gr/m²">Lona PVC 600 gr/m²</option>
              </select>
            </div>
            <div className="campo">
              <label>Tipo de acople</label>
              <select {...register('tipoAcople')}>
                <option value="">-- Seleccionar acople --</option>
                {TIPOS_ACOPLAMIENTO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fila-form fila-form-2">
            <div className="campo">
              <label>Diámetro</label>
              <input
                {...register('diametro')}
                placeholder='Ej: 12", 16", 20"'
              />
            </div>
            <div className="campo">
              <label>Longitud</label>
              <input
                {...register('longitud')}
                placeholder="Ej: 10 m, 15 m, 20 m"
              />
            </div>
          </div>

          <div className="campo">
            <label>Unidad de medida</label>
            <select {...register('unidadMedida')}>
              {UNIDADES_MEDIDA.map((unidad) => (
                <option key={unidad} value={unidad}>{unidad}</option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>Precio (US$) *</label>
            <input
              {...register('precio', {
                required: 'El precio es requerido',
                min: { value: 0, message: 'El precio debe ser positivo' }
              })}
              type="number"
              step="0.01"
              min="0"
              className={errors.precio ? 'input-error' : ''}
              placeholder="0.00"
            />
            {errors.precio && <span className="mensaje-error">{errors.precio.message}</span>}
          </div>

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setMostrarModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirm}
        onClose={() => setMostrarConfirm(false)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar manga?"
        message="Esta acción eliminará la manga de ventilación permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
