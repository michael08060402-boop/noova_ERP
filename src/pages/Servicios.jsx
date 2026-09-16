import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FiEdit2, FiTrash2, FiSearch, FiPlus } from 'react-icons/fi';
import { useServicios } from '../hooks/useServicios';
import { formatUSD, formatCurrency } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Equipos.css';
import './Servicios.css';

// Líneas de servicios PROPIOS de Noova. Este catálogo NO incluye envío,
// flete, courier, transporte ni cargos logísticos: esos cargos se registran
// como filas libres dentro de la cotización, nunca aquí.
const LINEAS_SERVICIO = [
  'Ventilación minera',
  'Bombeo',
  'Drenaje',
  'Monitoreo',
  'Mediciones',
  'Ingeniería',
  'Consultoría',
  'Montaje',
  'Mantenimiento',
  'Capacitación técnica'
];

const LINEA_OTRO = '__OTRO__';

const FORMULARIO_VACIO = {
  codigo: '',
  nombre: '',
  linea: '',
  descripcionTecnica: '',
  unidadCobro: 'SERVICIO',
  precioReferencial: '',
  moneda: 'US$',
  activo: true
};

const UNIDADES_COBRO = ['SERVICIO', 'HORA', 'DÍA', 'MES', 'VISITA', 'PROYECTO', 'UNIDAD', 'M.', 'M2', 'ML'];

const MONEDAS = [
  { codigo: 'US$', label: 'Dólares (US$)' },
  { codigo: 'S/', label: 'Soles (S/)' }
];

function formatPrecio(monto, moneda) {
  return moneda === 'S/' ? formatCurrency(monto) : formatUSD(monto);
}

export default function Servicios() {
  const { servicios, loading, addServicio, editServicio, removeServicio } = useServicios();

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
  const [filtroEstado, setFiltroEstado] = useState('');
  const [orden, setOrden] = useState('asc');
  const [guardando, setGuardando] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [lineaEsOtra, setLineaEsOtra] = useState(false);
  const [lineaCustom, setLineaCustom] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({ defaultValues: FORMULARIO_VACIO });

  const lineaSeleccionada = watch('linea');

  const handleLineaChange = (e) => {
    const valor = e.target.value;
    const esOtra = valor === LINEA_OTRO;
    setLineaEsOtra(esOtra);
    if (!esOtra) {
      setLineaCustom('');
      setValue('linea', valor, { shouldValidate: true });
    } else {
      setValue('linea', '', { shouldValidate: true });
    }
  };

  const serviciosFiltrados = useMemo(() => {
    return servicios
      .filter((s) => {
        const term = terminoBusqueda.toLowerCase();
        const coincideBusqueda = (
          s.codigo?.toLowerCase().includes(term) ||
          s.nombre?.toLowerCase().includes(term) ||
          s.linea?.toLowerCase().includes(term) ||
          s.descripcionTecnica?.toLowerCase().includes(term)
        );
        const coincideEstado = !filtroEstado
          || (filtroEstado === 'activos' ? s.activo !== false : s.activo === false);
        return coincideBusqueda && coincideEstado;
      })
      .sort((a, b) => {
        if (orden === 'asc' || orden === 'desc') {
          const nameA = a.nombre?.toLowerCase() || '';
          const nameB = b.nombre?.toLowerCase() || '';
          return orden === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        if (orden === 'codigo-asc') return (a.codigo || '').localeCompare(b.codigo || '');
        if (orden === 'precio-asc') return (Number(a.precioReferencial) || 0) - (Number(b.precioReferencial) || 0);
        if (orden === 'precio-desc') return (Number(b.precioReferencial) || 0) - (Number(a.precioReferencial) || 0);
        return 0;
      });
  }, [servicios, terminoBusqueda, filtroEstado, orden]);

  const serviciosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return serviciosFiltrados.slice(inicio, inicio + porPagina);
  }, [serviciosFiltrados, paginaActual, porPagina]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }

  function alCambiarEstado(valor) {
    setFiltroEstado(valor);
    setPaginaActual(1);
  }

  function alCambiarOrden(valor) {
    setOrden(valor);
    setPaginaActual(1);
  }

  function nuevoServicio() {
    setEditandoId(null);
    reset(FORMULARIO_VACIO);
    setLineaEsOtra(false);
    setLineaCustom('');
    setMostrarModal(true);
  }

  function editarServicio(servicio) {
    setEditandoId(servicio.id);
    const linea = servicio.linea || '';
    const esPredefinida = LINEAS_SERVICIO.includes(linea);
    setLineaEsOtra(!esPredefinida && linea !== '');
    setLineaCustom(esPredefinida ? '' : linea);
    reset({
      codigo: servicio.codigo || '',
      nombre: servicio.nombre || '',
      linea: esPredefinida ? linea : (linea ? LINEA_OTRO : ''),
      descripcionTecnica: servicio.descripcionTecnica || '',
      unidadCobro: servicio.unidadCobro || 'SERVICIO',
      precioReferencial: servicio.precioReferencial ?? '',
      moneda: servicio.moneda || 'US$',
      activo: servicio.activo !== false
    });
    setMostrarModal(true);
  }

  function solicitarEliminar(id) {
    setEliminarId(id);
    setMostrarConfirm(true);
  }

  async function alEnviar(data) {
    let lineaFinal = data.linea;
    if (lineaEsOtra) {
      lineaFinal = lineaCustom.trim();
      if (!lineaFinal) {
        mostrarMensaje('error', 'Escriba el nombre de la línea personalizada');
        return;
      }
    }

    setGuardando(true);
    try {
      const payload = {
        codigo: data.codigo,
        nombre: data.nombre,
        linea: lineaFinal,
        descripcionTecnica: data.descripcionTecnica || '',
        unidadCobro: data.unidadCobro || 'SERVICIO',
        precioReferencial: Number(data.precioReferencial) || 0,
        moneda: data.moneda || 'US$',
        activo: data.activo !== false
      };
      if (editandoId) {
        await editServicio(editandoId, payload);
      } else {
        await addServicio(payload);
      }
      setMostrarModal(false);
      reset(FORMULARIO_VACIO);
      setLineaEsOtra(false);
      setLineaCustom('');
    } catch (err) {
      console.error('Error guardando servicio:', err);
      mostrarMensaje('error', 'Error al guardar servicio: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeServicio(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
    } catch (err) {
      console.error('Error eliminando servicio:', err);
      mostrarMensaje('error', 'Error al eliminar servicio: ' + err.message);
    }
  }

  if (loading) return <Loading message="Cargando servicios..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Servicios</h1>
          <p className="pagina-subtitle">{servicios.length} servicios propios registrados</p>
        </div>
        <button className="btn-principal" onClick={nuevoServicio}>
          <FiPlus size={16} /> Nuevo Servicio
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
            placeholder="Buscar por código, nombre o línea..."
            value={terminoBusqueda}
            onChange={(e) => alCambiarBusqueda(e.target.value)}
          />
        </div>
        <select
          className="selector-orden"
          value={filtroEstado}
          onChange={(e) => alCambiarEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
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
        {serviciosFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron servicios</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={serviciosFiltrados.length}
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
                    <th>Línea</th>
                    <th>Unidad de cobro</th>
                    <th className="texto-derecha">Precio ref.</th>
                    <th className="texto-centro">Estado</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosPaginados.map((s) => (
                    <tr key={s.id}>
                      <td className="texto-codigo">{s.codigo}</td>
                      <td className="texto-negrita">{s.nombre}</td>
                      <td>
                        {s.linea ? (
                          <span className="badge-categoria">{s.linea}</span>
                        ) : '-'}
                      </td>
                      <td>{s.unidadCobro || 'SERVICIO'}</td>
                      <td className="texto-derecha texto-negrita">
                        {formatPrecio(s.precioReferencial || 0, s.moneda)}
                      </td>
                      <td className="texto-centro">
                        <span className={`badge-estado-catalogo ${s.activo !== false ? 'catalogo-activo' : 'catalogo-inactivo'}`}>
                          {s.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => editarServicio(s)} title="Editar">
                            <FiEdit2 size={16} />
                          </button>
                          <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminar(s.id)} title="Eliminar">
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
        title={editandoId ? 'Editar Servicio' : 'Nuevo Servicio'}
      >
        <form onSubmit={handleSubmit(alEnviar)} className="formulario">
          <div className="campo">
            <label>Código *</label>
            <input
              {...register('codigo', { required: 'El código es requerido' })}
              className={errors.codigo ? 'input-error' : ''}
              placeholder="SER-001"
            />
            {errors.codigo && <span className="mensaje-error">{errors.codigo.message}</span>}
          </div>

          <div className="campo">
            <label>Nombre *</label>
            <input
              {...register('nombre', { required: 'El nombre es requerido' })}
              className={errors.nombre ? 'input-error' : ''}
              placeholder="Ej: Diseño de sistema de ventilación minera"
            />
            {errors.nombre && <span className="mensaje-error">{errors.nombre.message}</span>}
          </div>

          <div className="campo">
            <label>Línea / Categoría</label>
            <select
              {...register('linea')}
              onChange={handleLineaChange}
              value={lineaSeleccionada || ''}
            >
              <option value="">-- Seleccionar línea --</option>
              {LINEAS_SERVICIO.map((linea) => (
                <option key={linea} value={linea}>{linea}</option>
              ))}
              <option value={LINEA_OTRO}>Otro (escribir...)</option>
            </select>
            {lineaEsOtra && (
              <input
                type="text"
                value={lineaCustom}
                onChange={(e) => setLineaCustom(e.target.value)}
                placeholder="Escriba la línea personalizada"
                className="input-categoria-custom"
                autoFocus
              />
            )}
          </div>

          <div className="campo">
            <label>Descripción técnica</label>
            <textarea
              {...register('descripcionTecnica')}
              rows={4}
              placeholder="Alcance del servicio, metodología, entregables, normativas aplicables..."
            />
          </div>

          <div className="fila-form-2">
            <div className="campo">
              <label>Unidad de cobro</label>
              <select {...register('unidadCobro')}>
                {UNIDADES_COBRO.map((unidad) => (
                  <option key={unidad} value={unidad}>{unidad}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Moneda</label>
              <select {...register('moneda')}>
                {MONEDAS.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Precio referencial *</label>
            <input
              {...register('precioReferencial', {
                required: 'El precio referencial es requerido',
                min: { value: 0, message: 'El precio debe ser positivo' }
              })}
              type="number"
              step="0.01"
              min="0"
              className={errors.precioReferencial ? 'input-error' : ''}
              placeholder="0.00"
            />
            {errors.precioReferencial && <span className="mensaje-error">{errors.precioReferencial.message}</span>}
          </div>

          <div className="campo campo-checkbox">
            <label className="checkbox-inline">
              <input
                type="checkbox"
                {...register('activo')}
              />
              Servicio activo (disponible para cotizar)
            </label>
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
        title="¿Eliminar servicio?"
        message="Esta acción eliminará el servicio permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
