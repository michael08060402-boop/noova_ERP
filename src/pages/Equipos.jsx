import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FiEdit2, FiTrash2, FiSearch, FiPlus } from 'react-icons/fi';
import { useEquipos } from '../hooks/useEquipos';
import { formatUSD } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Equipos.css';

// Lista de tipos predefinidos
const TIPOS_EQUIPO = [
  'Termómetro',
  'Data Logger - °C',
  'Data Logger - %HR y °C',
  'Data Logger - interface',
  'Data Logger - %HR, °C, hPa',
  'Data Logger - %HR, °C, vib.',
  'Medidor de pH',
  'Analizador de gases',
  'Medidor de CO ambiente',
  'Medidor de TPM',
  'Anemómetro',
  'Balómetro',
  'Tacómetro',
  'Estroboscopio',
  'Presión diferencial',
  'Presión absoluta',
  'Luxómetro',
  'Termohigrómetro',
  'Medidor de humedad en materiales',
  'Equipo multifunción - humedad',
  'Equipo multifunción - temperatura',
  'Termómetro infrarrojo',
  'Sonómetro',
  'Saveris 2',
  'testo 160'
];

const CATEGORIA_OTRO = '__OTRO__';

const FORMULARIO_VACIO = {
  codigo: '',
  nombre: '',
  categoria: '',
  unidadMedida: 'UNIDAD',
  precio: ''
};

const UNIDADES_MEDIDA = ['UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'];

export default function Equipos() {
  const { equipos, loading, addEquipo, editEquipo, removeEquipo } = useEquipos();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
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

  const equiposFiltrados = useMemo(() => {
    return equipos
      .filter((e) => {
        const term = terminoBusqueda.toLowerCase();
        return (
          e.codigo?.toLowerCase().includes(term) ||
          e.nombre?.toLowerCase().includes(term) ||
          e.categoria?.toLowerCase().includes(term)
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
  }, [equipos, terminoBusqueda, orden]);

  const equiposPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return equiposFiltrados.slice(inicio, inicio + porPagina);
  }, [equiposFiltrados, paginaActual, porPagina]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }

  function alCambiarOrden(valor) {
    setOrden(valor);
    setPaginaActual(1);
  }

  function nuevoEquipo() {
    setEditandoId(null);
    reset(FORMULARIO_VACIO);
    setCategoriaEsOtra(false);
    setCategoriaCustom('');
    setMostrarModal(true);
  }

  function editarEquipo(equipo) {
    setEditandoId(equipo.id);
    const categoria = equipo.categoria || '';
    const esPredefinida = TIPOS_EQUIPO.includes(categoria);
    setCategoriaEsOtra(!esPredefinida && categoria !== '');
    setCategoriaCustom(esPredefinida ? '' : categoria);
    reset({
      codigo: equipo.codigo || '',
      nombre: equipo.nombre || '',
      categoria: esPredefinida ? categoria : (categoria ? CATEGORIA_OTRO : ''),
      unidadMedida: equipo.unidadMedida || 'UNIDAD',
      precio: equipo.precio || ''
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
        unidadMedida: data.unidadMedida || 'UNIDAD',
        precio: Number(data.precio) || 0
      };
      if (editandoId) {
        await editEquipo(editandoId, payload);
      } else {
        await addEquipo(payload);
      }
      setMostrarModal(false);
      reset(FORMULARIO_VACIO);
      setCategoriaEsOtra(false);
      setCategoriaCustom('');
    } catch (err) {
      console.error('Error guardando equipo:', err);
      mostrarMensaje('error', 'Error al guardar equipo: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeEquipo(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
    } catch (err) {
      console.error('Error eliminando equipo:', err);
      mostrarMensaje('error', 'Error al eliminar equipo: ' + err.message);
    }
  }

  if (loading) return <Loading message="Cargando equipos..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Equipos</h1>
          <p className="pagina-subtitle">{equipos.length} equipos registrados</p>
        </div>
        <button className="btn-principal" onClick={nuevoEquipo}>
          <FiPlus size={16} /> Nuevo Equipo
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por código, descripción o tipo..."
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
        {equiposFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron equipos</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={equiposFiltrados.length}
              paginaActual={paginaActual}
              porPagina={porPagina}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={setPorPagina}
            />
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th className="texto-derecha">Precio</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equiposPaginados.map((e) => (
                    <tr key={e.id}>
                      <td className="texto-codigo">{e.codigo}</td>
                      <td className="texto-negrita">{e.nombre}</td>
                      <td>
                        {e.categoria ? (
                          <span className="badge-categoria">{e.categoria}</span>
                        ) : '-'}
                      </td>
                      <td className="texto-derecha texto-negrita">{formatUSD(e.precio || 0)}</td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => editarEquipo(e)} title="Editar">
                            <FiEdit2 size={16} />
                          </button>
                          <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminar(e.id)} title="Eliminar">
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
        title={editandoId ? 'Editar Equipo' : 'Nuevo Equipo'}
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
              {TIPOS_EQUIPO.map((tipo) => (
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
              placeholder="EQ-001"
            />
            {errors.codigo && <span className="mensaje-error">{errors.codigo.message}</span>}
          </div>

          <div className="campo">
            <label>Descripción *</label>
            <input
              {...register('nombre', { required: 'La descripción es requerida' })}
              className={errors.nombre ? 'input-error' : ''}
              placeholder="Descripción del equipo"
            />
            {errors.nombre && <span className="mensaje-error">{errors.nombre.message}</span>}
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
        title="¿Eliminar equipo?"
        message="Esta acción eliminará el equipo permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
