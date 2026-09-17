import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FiEdit2, FiTrash2, FiSearch, FiPlus } from 'react-icons/fi';
import { useEpp } from '../hooks/useEpp';
import { useAuth } from '../context/AuthContext';
import { puede } from '../services/userService';
import { formatUSD } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Equipos.css';
import './EPP.css';

// Categorías predefinidas de EPP (equipos de protección personal para minería
// e industria). El usuario también puede escribir una categoría personalizada.
const CATEGORIAS_EPP = [
  'Protección de cabeza',
  'Protección respiratoria',
  'Protección ocular',
  'Protección auditiva',
  'Protección de manos',
  'Protección de pies',
  'Protección contra caídas',
  'Ropa de trabajo',
  'Iluminación',
  'Señalización',
  'Primeros auxilios'
];

const CATEGORIA_OTRO = '__OTRO__';

const FORMULARIO_VACIO = {
  codigo: '',
  nombre: '',
  categoria: '',
  marca: '',
  modelo: '',
  unidadMedida: 'UNIDAD',
  precio: '',
  descripcion: ''
};

const UNIDADES_MEDIDA = ['UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'];

export default function EPP() {
  const { epp, loading, addEpp, editEpp, removeEpp } = useEpp();
  const { userProfile } = useAuth();
  const puedeCrear = puede(userProfile, 'epp', 'create');

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

  const eppFiltrados = useMemo(() => {
    return epp
      .filter((e) => {
        const term = terminoBusqueda.toLowerCase();
        const coincideBusqueda = (
          e.codigo?.toLowerCase().includes(term) ||
          e.nombre?.toLowerCase().includes(term) ||
          e.categoria?.toLowerCase().includes(term) ||
          e.marca?.toLowerCase().includes(term) ||
          e.modelo?.toLowerCase().includes(term)
        );
        return coincideBusqueda;
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
  }, [epp, terminoBusqueda, orden]);

  const eppPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return eppFiltrados.slice(inicio, inicio + porPagina);
  }, [eppFiltrados, paginaActual, porPagina]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }


  function alCambiarOrden(valor) {
    setOrden(valor);
    setPaginaActual(1);
  }

  function nuevoEpp() {
    setEditandoId(null);
    reset(FORMULARIO_VACIO);
    setCategoriaEsOtra(false);
    setCategoriaCustom('');
    setMostrarModal(true);
  }

  function editarEpp(item) {
    setEditandoId(item.id);
    const categoria = item.categoria || '';
    const esPredefinida = CATEGORIAS_EPP.includes(categoria);
    setCategoriaEsOtra(!esPredefinida && categoria !== '');
    setCategoriaCustom(esPredefinida ? '' : categoria);
    reset({
      codigo: item.codigo || '',
      nombre: item.nombre || '',
      categoria: esPredefinida ? categoria : (categoria ? CATEGORIA_OTRO : ''),
      marca: item.marca || '',
      modelo: item.modelo || '',
      unidadMedida: item.unidadMedida || 'UNIDAD',
      precio: item.precio ?? '',
      descripcion: item.descripcion || ''
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
        mostrarMensaje('error', 'Escriba el nombre de la categoría personalizada');
        return;
      }
    }

    setGuardando(true);
    try {
      const payload = {
        codigo: data.codigo,
        nombre: data.nombre,
        categoria: categoriaFinal,
        marca: data.marca || '',
        modelo: data.modelo || '',
        unidadMedida: data.unidadMedida || 'UNIDAD',
        precio: Number(data.precio) || 0,
        descripcion: data.descripcion || ''
      };
      if (editandoId) {
        await editEpp(editandoId, payload);
      } else {
        await addEpp(payload);
      }
      setMostrarModal(false);
      reset(FORMULARIO_VACIO);
      setCategoriaEsOtra(false);
      setCategoriaCustom('');
    } catch (err) {
      console.error('Error guardando EPP:', err);
      mostrarMensaje('error', 'Error al guardar EPP: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeEpp(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
      return true;
    } catch (err) {
      console.error('Error eliminando EPP:', err);
      mostrarMensaje('error', 'Error al eliminar EPP: ' + err.message);
      return false;
    }
  }

  if (loading) return <Loading message="Cargando EPP..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">EPP</h1>
          <p className="pagina-subtitle">{epp.length} equipos de protección personal registrados</p>
        </div>
        {puedeCrear && (
          <button className="btn-principal" onClick={nuevoEpp}>
            <FiPlus size={16} /> Nuevo EPP
          </button>
        )}
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
            placeholder="Buscar por código, nombre, categoría, marca o modelo..."
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
        {eppFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron EPP</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={eppFiltrados.length}
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
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Unidad</th>
                    <th className="texto-derecha">Precio</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {eppPaginados.map((e) => (
                    <tr key={e.id}>
                      <td className="texto-codigo">{e.codigo}</td>
                      <td className="texto-negrita">{e.nombre}</td>
                      <td>
                        {e.categoria ? (
                          <span className="badge-categoria">{e.categoria}</span>
                        ) : '-'}
                      </td>
                      <td>{e.marca || '-'}</td>
                      <td>{e.modelo || '-'}</td>
                      <td>{e.unidadMedida || 'UNIDAD'}</td>
                      <td className="texto-derecha texto-negrita">{formatUSD(e.precio || 0)}</td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => editarEpp(e)} title="Editar">
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
        title={editandoId ? 'Editar EPP' : 'Nuevo EPP'}
      >
        <form onSubmit={handleSubmit(alEnviar)} className="formulario">
          <div className="campo">
            <label>Código *</label>
            <input
              {...register('codigo', { required: 'El código es requerido' })}
              className={errors.codigo ? 'input-error' : ''}
              placeholder="EPP-001"
            />
            {errors.codigo && <span className="mensaje-error">{errors.codigo.message}</span>}
          </div>

          <div className="campo">
            <label>Nombre *</label>
            <input
              {...register('nombre', { required: 'El nombre es requerido' })}
              className={errors.nombre ? 'input-error' : ''}
              placeholder="Ej: Casco de seguridad con barbiquejo"
            />
            {errors.nombre && <span className="mensaje-error">{errors.nombre.message}</span>}
          </div>

          <div className="campo">
            <label>Categoría</label>
            <select
              {...register('categoria')}
              onChange={handleCategoriaChange}
              value={categoriaSeleccionada || ''}
            >
              <option value="">-- Seleccionar categoría --</option>
              {CATEGORIAS_EPP.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
              <option value={CATEGORIA_OTRO}>Otro (escribir...)</option>
            </select>
            {categoriaEsOtra && (
              <input
                type="text"
                value={categoriaCustom}
                onChange={(e) => setCategoriaCustom(e.target.value)}
                placeholder="Escriba la categoría personalizada"
                className="input-categoria-custom"
                autoFocus
              />
            )}
          </div>

          <div className="fila-form fila-form-2">
            <div className="campo">
              <label>Marca</label>
              <input
                {...register('marca')}
                placeholder="Ej: 3M, MSA, MSA Fall..."
              />
            </div>
            <div className="campo">
              <label>Modelo</label>
              <input
                {...register('modelo')}
                placeholder="Ej: 818344"
              />
            </div>
          </div>

          <div className="fila-form fila-form-2">
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
          </div>

          <div className="campo">
            <label>Descripción</label>
            <textarea
              {...register('descripcion')}
              rows={3}
              placeholder="Descripción técnica del EPP (norma, certificación, características...)"
            />
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
        title="¿Eliminar EPP?"
        message="Esta acción eliminará el EPP permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
