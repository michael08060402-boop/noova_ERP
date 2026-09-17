import { useMemo, useState } from 'react';
import {
  FiPlus,
  FiSearch,
  FiDownload,
  FiEdit2,
  FiTrash2,
  FiArrowLeft,
  FiClipboard,
  FiFileText
} from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useEpp } from '../hooks/useEpp';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { puede } from '../services/userService';
import { addLog } from '../services/logService';
import { formatDate, formatDateISO } from '../utils/formatDate';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Cotizaciones.css';
import './SolicitudesEPP.css';

const MONEDAS = [
  { codigo: 'US$', label: 'Dólares (US$)' },
  { codigo: 'S/', label: 'Soles (S/)' }
];

const UNIDADES_MEDIDA = ['UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'];

const ITEM_VACIO = {
  eppId: '',
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidadMedida: 'UNIDAD',
  marca: '',
  modelo: ''
};

const FORMULARIO_VACIO = {
  moneda: 'US$',
  items: [{ ...ITEM_VACIO }]
};

function etiquetaMoneda(moneda) {
  return moneda === 'S/' ? 'Soles (S/)' : 'Dólares (US$)';
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function SolicitudesEPP() {
  const { currentUser, userProfile } = useAuth();
  const { config, refreshConfig } = useConfig();
  const {
    cotizaciones,
    loading,
    addCotizacion,
    editCotizacion,
    removeCotizacion
  } = useCotizaciones(true, { soloEpp: true });
  const { epp, loading: loadingEpp } = useEpp(true);

  const puedeCrear = puede(userProfile, 'solicitudes', 'create');
  const puedeEditar = puede(userProfile, 'solicitudes', 'update');
  const puedeEliminar = puede(userProfile, 'solicitudes', 'delete');

  const responsable = userProfile?.nombre || currentUser?.displayName || currentUser?.email || '';
  const cargoResponsable = userProfile?.cargo || '';
  const emailResponsable = userProfile?.email || currentUser?.email || '';
  const telefonoResponsable = userProfile?.telefono || '';

  const [vista, setVista] = useState('lista');
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);

  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [eliminarId, setEliminarId] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const catalogoEpp = useMemo(() => epp, [epp]);

  const solicitudes = useMemo(
    () => cotizaciones.filter((c) => c.tipoItem === 'epp'),
    [cotizaciones]
  );

  const solicitudesFiltradas = useMemo(() => {
    const term = normalizar(terminoBusqueda.trim());
    if (!term) return solicitudes;

    return solicitudes.filter((solicitud) => {
      const textoItems = (solicitud.items || [])
        .map((item) => `${item.codigo || ''} ${item.descripcion || ''}`)
        .join(' ');
      return [
        solicitud.responsable,
        solicitud.moneda,
        textoItems
      ].some((valor) => normalizar(valor).includes(term));
    });
  }, [solicitudes, terminoBusqueda]);

  const solicitudesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return solicitudesFiltradas.slice(inicio, inicio + porPagina);
  }, [solicitudesFiltradas, paginaActual, porPagina]);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => {
      setMensaje((actual) => (actual?.texto === texto ? null : actual));
    }, 4500);
  }

  function nuevaSolicitud() {
    setEditandoId(null);
    setForm({ ...FORMULARIO_VACIO, items: [{ ...ITEM_VACIO }] });
    setErrores({});
    setVista('form');
  }

  function editarSolicitud(solicitud) {
    const items = (solicitud.items || []).map((item) => {
      const encontrado = catalogoEpp.find((e) =>
        (item.codigo && e.codigo === item.codigo)
        || (item.descripcion && e.nombre === item.descripcion)
      );
      return {
        eppId: encontrado?.id || '',
        codigo: item.codigo || '',
        descripcion: item.descripcion || '',
        cantidad: Number(item.cantidad) || 1,
        unidadMedida: item.unidadMedida || 'UNIDAD',
        marca: item.marca || encontrado?.marca || '',
        modelo: item.modelo || encontrado?.modelo || ''
      };
    });

    setEditandoId(solicitud.id);
    setForm({
      moneda: solicitud.moneda || 'US$',
      items: items.length ? items : [{ ...ITEM_VACIO }]
    });
    setErrores({});
    setVista('form');
  }

  function cambiarMoneda(valor) {
    setForm((prev) => ({ ...prev, moneda: valor }));
  }

  function seleccionarEpp(index, eppId) {
    const seleccionado = catalogoEpp.find((item) => item.id === eppId);
    setForm((prev) => {
      const items = [...prev.items];
      if (!seleccionado) {
        items[index] = { ...items[index], eppId: '' };
        return { ...prev, items };
      }

      items[index] = {
        ...items[index],
        eppId: seleccionado.id,
        codigo: seleccionado.codigo || '',
        descripcion: seleccionado.nombre || '',
        unidadMedida: seleccionado.unidadMedida || 'UNIDAD',
        marca: seleccionado.marca || '',
        modelo: seleccionado.modelo || ''
      };
      return { ...prev, items };
    });

    setErrores((prev) => ({
      ...prev,
      [`item_${index}_epp`]: null,
      [`item_${index}_descripcion`]: null
    }));
  }

  function cambiarItem(index, campo, valor) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [campo]: valor };
      return { ...prev, items };
    });
    setErrores((prev) => ({ ...prev, [`item_${index}_${campo}`]: null }));
  }

  function agregarEpp() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...ITEM_VACIO }]
    }));
  }

  function quitarEpp(index) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  }

  function validar() {
    const nuevosErrores = {};

    if (!form.moneda) nuevosErrores.moneda = 'Seleccione la moneda';

    form.items.forEach((item, index) => {
      if (!item.eppId && !item.codigo) {
        nuevosErrores[`item_${index}_epp`] = 'Seleccione un EPP';
      }
      if (!String(item.descripcion || '').trim()) {
        nuevosErrores[`item_${index}_descripcion`] = 'Descripción requerida';
      }
      if (!Number(item.cantidad) || Number(item.cantidad) <= 0) {
        nuevosErrores[`item_${index}_cantidad`] = 'Cantidad inválida';
      }
    });

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardarSolicitud(event) {
    event.preventDefault();
    if (!validar()) return;

    setGuardando(true);
    try {
      const hoy = formatDateISO();
      const data = {
        clienteId: '',
        cliente: {},
        responsable,
        cargoResponsable,
        emailResponsable,
        telefonoResponsable,
        contactoSeleccionado: null,
        condicionPago: '',
        validez: '',
        tiempoEntregaNumero: 0,
        tiempoEntregaUnidad: '',
        tiempoEntrega: '',
        tipoItem: 'epp',
        esSolicitudCotizacion: true,
        items: form.items.map((item) => ({
          codigo: item.codigo || '',
          descripcion: String(item.descripcion || '').trim(),
          cantidad: Number(item.cantidad) || 0,
          unidadMedida: item.unidadMedida || 'UNIDAD',
          precioUnitario: 0,
          diametro: '',
          longitud: '',
          material: '',
          tipoAcople: '',
          marca: item.marca || '',
          modelo: item.modelo || '',
          tiempoEntrega: '',
          tiempoEntregaNumero: '',
          tiempoEntregaUnidad: '',
          esAccesorio: false,
          tipo: 'producto'
        })),
        subtotal: 0,
        igv: 0,
        total: 0,
        sinIGV: false,
        preciosIncluyenIGV: false,
        estado: 'Generada',
        fechaEmision: hoy,
        fecha: hoy,
        moneda: form.moneda || 'US$'
      };

      if (editandoId) {
        await editCotizacion(editandoId, data);
        setVista('lista');
        mostrarMensaje('success', 'Solicitud de cotización actualizada correctamente.');
        addLog({
          usuario: responsable,
          accion: 'editar_solicitud_epp',
          detalle: editandoId
        }).catch((err) => console.warn('No se pudo registrar auditoría:', err));
      } else {
        const result = await addCotizacion(data);
        setVista('lista');
        mostrarMensaje('success', 'Solicitud creada correctamente.');
        addLog({
          usuario: responsable,
          accion: 'crear_solicitud_epp',
          detalle: result.id || ''
        }).catch((err) => console.warn('No se pudo registrar auditoría:', err));
      }
    } catch (err) {
      console.error('Error guardando solicitud EPP:', err);
      mostrarMensaje('error', 'No se pudo guardar la solicitud: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function exportarPDF(solicitud) {
    try {
      const c = config || (await refreshConfig());
      const mod = await import('../utils/generateEppPDF');
      await mod.downloadEppPDF(solicitud, c);
      mostrarMensaje('success', 'PDF de la solicitud generado correctamente.');
    } catch (err) {
      console.error('Error generando PDF EPP:', err);
      mostrarMensaje('error', 'No se pudo generar el PDF: ' + err.message);
    }
  }

  function solicitarEliminar(id) {
    setEliminarId(id);
    setMostrarConfirm(true);
  }

  async function confirmarEliminar() {
    if (!eliminarId || eliminando) return;
    setEliminando(true);
    try {
      await removeCotizacion(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
      mostrarMensaje('success', 'Solicitud eliminada correctamente.');
      addLog({
        usuario: responsable,
        accion: 'eliminar_solicitud_epp',
        detalle: eliminarId || ''
      }).catch((err) => console.warn('No se pudo registrar auditoría:', err));
    } catch (err) {
      console.error('Error eliminando solicitud EPP:', err);
      mostrarMensaje('error', 'No se pudo eliminar la solicitud.');
    } finally {
      setEliminando(false);
    }
  }

  if (loading || loadingEpp) {
    return <Loading message="Cargando solicitudes..." />;
  }

  return (
    <div className="pagina solicitudes-epp-page">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Solicitudes</h1>
        </div>

        {vista === 'lista' && puedeCrear && (
          <button className="btn-principal" onClick={nuevaSolicitud}>
            <FiPlus size={16} /> Nueva solicitud
          </button>
        )}
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">
          {mensaje.texto}
        </div>
      )}

      {vista === 'form' && (
        <div className="tabs-cotizaciones">
          <button
            type="button"
            className="tab-cotizacion tab-volver"
            onClick={() => setVista('lista')}
          >
            <FiArrowLeft size={14} /> Volver
          </button>
          <button type="button" className="tab-cotizacion activa" disabled>
            {editandoId ? 'Editar solicitud' : 'Nueva solicitud'}
          </button>
        </div>
      )}

      {vista === 'lista' ? (
        <>
          <div className="filtros-barra solicitudes-epp-filtros">
            <div className="barra-busqueda">
              <FiSearch className="icono-busqueda" size={18} />
              <input
                type="text"
                placeholder="Buscar por solicitante o ítem..."
                value={terminoBusqueda}
                onChange={(e) => {
                  setTerminoBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
              />
            </div>
          </div>

          <Paginacion
            total={solicitudesFiltradas.length}
            paginaActual={paginaActual}
            porPagina={porPagina}
            onCambiarPagina={setPaginaActual}
            onCambiarPorPagina={setPorPagina}
            compacta
          />

          <div className="tarjeta-tabla">
            {solicitudesFiltradas.length === 0 ? (
              <div className="estado-vacio">
                <FiClipboard size={28} />
                <p>{terminoBusqueda ? 'Sin resultados' : 'No hay solicitudes registradas'}</p>
              </div>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla-datos solicitudes-epp-tabla-lista">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Solicitante</th>
                      <th>Moneda</th>
                      <th className="texto-centro">Ítems</th>
                      <th className="texto-centro">Estado</th>
                      <th className="texto-centro">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudesPaginadas.map((solicitud) => (
                      <tr key={solicitud.id}>
                        <td>{formatDate(solicitud.fecha || solicitud.fechaEmision || solicitud.createdAt)}</td>
                        <td>{solicitud.responsable || '—'}</td>
                        <td>{etiquetaMoneda(solicitud.moneda)}</td>
                        <td className="texto-centro texto-negrita">{solicitud.items?.length || 0}</td>
                        <td className="texto-centro">
                          <span className={`badge-estado-sunat estado-${(solicitud.estado || 'Generada').toLowerCase()}`}>
                            {solicitud.estado || 'Generada'}
                          </span>
                        </td>
                        <td className="texto-centro">
                          <div className="acciones-tabla">
                            <button
                              className="btn-accion"
                              onClick={() => exportarPDF(solicitud)}
                              title="Exportar solicitud PDF"
                            >
                              <FiDownload size={18} />
                            </button>
                            {puedeEditar && (
                              <button
                                className="btn-accion"
                                onClick={() => editarSolicitud(solicitud)}
                                title="Editar solicitud"
                              >
                                <FiEdit2 size={18} />
                              </button>
                            )}
                            {puedeEliminar && (
                              <button
                                className="btn-accion btn-eliminar"
                                onClick={() => solicitarEliminar(solicitud.id)}
                                title="Eliminar solicitud"
                              >
                                <FiTrash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="cotizacion-form-vista solicitud-epp-form-vista">
          <form onSubmit={guardarSolicitud} className="formulario formulario-compacto">
            <div className="cotizacion-form-grid">
              <div className="cotizacion-form-principal">
                <div className="form-card">
                  <div className="form-card-header">
                    <span className="form-card-icon"><FiClipboard size={16} /></span>
                    <h3>Solicitud</h3>
                  </div>
                  <div className="form-card-body">
                    <div className="fila-form fila-form-3 solicitud-epp-datos">
                      <div className="campo">
                        <label>Solicitante</label>
                        <input type="text" value={responsable} readOnly className="input-solo-lectura" />
                      </div>
                      <div className="campo">
                        <label>Tipo de moneda</label>
                        <select
                          value={form.moneda}
                          onChange={(e) => cambiarMoneda(e.target.value)}
                          className={errores.moneda ? 'input-error' : ''}
                        >
                          {MONEDAS.map((moneda) => (
                            <option key={moneda.codigo} value={moneda.codigo}>{moneda.label}</option>
                          ))}
                        </select>
                        {errores.moneda && <span className="mensaje-error">{errores.moneda}</span>}
                      </div>
                      <div className="campo">
                        <label>Tipo de cotización</label>
                        <input type="text" value="EPP" readOnly className="input-solo-lectura" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <span className="form-card-icon"><FiFileText size={16} /></span>
                    <h3>Ítems</h3>
                  </div>
                  <div className="form-card-body">
                    <div className="items-seccion">
                      <div className="items-header solicitud-items-header">
                        <button
                          type="button"
                          className="btn-secundario btn-pequeno"
                          onClick={agregarEpp}
                        >
                          <FiPlus size={14} /> Agregar item
                        </button>
                      </div>

                      <div className="items-tabla-wrapper">
                        <table className="items-tabla solicitud-epp-items-tabla">
                          <thead>
                            <tr>
                              <th className="col-codigo">Código</th>
                              <th className="solicitud-epp-col-select">EPP</th>
                              <th className="col-desc">Descripción</th>
                              <th className="col-cant">Cantidad</th>
                              <th className="col-unidad">Unidad</th>
                              <th className="solicitud-epp-col-acciones"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.map((item, index) => (
                              <tr key={`${index}-${item.codigo}`}>
                                <td>
                                  <input
                                    type="text"
                                    value={item.codigo}
                                    readOnly
                                    className="input-solo-lectura"
                                    placeholder="Código"
                                  />
                                </td>
                                <td>
                                  <select
                                    value={item.eppId}
                                    onChange={(e) => seleccionarEpp(index, e.target.value)}
                                    className={errores[`item_${index}_epp`] ? 'input-error' : ''}
                                  >
                                    <option value="">Seleccionar EPP...</option>
                                    {catalogoEpp.map((producto) => (
                                      <option key={producto.id} value={producto.id}>
                                        {producto.codigo ? `${producto.codigo} — ` : ''}{producto.nombre}
                                      </option>
                                    ))}
                                  </select>
                                  {errores[`item_${index}_epp`] && (
                                    <span className="mensaje-error">{errores[`item_${index}_epp`]}</span>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={item.descripcion}
                                    onChange={(e) => cambiarItem(index, 'descripcion', e.target.value)}
                                    placeholder="Descripción / especificación"
                                    className={errores[`item_${index}_descripcion`] ? 'input-error' : ''}
                                  />
                                  {(item.marca || item.modelo) && (
                                    <span className="solicitud-epp-meta">
                                      {[item.marca, item.modelo].filter(Boolean).join(' · ')}
                                    </span>
                                  )}
                                  {errores[`item_${index}_descripcion`] && (
                                    <span className="mensaje-error">{errores[`item_${index}_descripcion`]}</span>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={item.cantidad}
                                    onChange={(e) => cambiarItem(index, 'cantidad', e.target.value)}
                                    min="1"
                                    step="1"
                                    className={`input-centro input-sin-flechas solicitud-cantidad-input ${errores[`item_${index}_cantidad`] ? 'input-error' : ''}`}
                                  />
                                  {errores[`item_${index}_cantidad`] && (
                                    <span className="mensaje-error">{errores[`item_${index}_cantidad`]}</span>
                                  )}
                                </td>
                                <td>
                                  <select
                                    value={item.unidadMedida || 'UNIDAD'}
                                    onChange={(e) => cambiarItem(index, 'unidadMedida', e.target.value)}
                                  >
                                    {UNIDADES_MEDIDA.map((unidad) => (
                                      <option key={unidad} value={unidad}>{unidad}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="texto-centro">
                                  <button
                                    type="button"
                                    className="btn-quitar-item-general"
                                    onClick={() => quitarEpp(index)}
                                    disabled={form.items.length <= 1}
                                    title="Quitar item"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cotizacion-form-sidebar">
                <div className="form-card resumen-card">
                  <div className="form-card-header">
                    <span className="form-card-icon"><FiFileText size={16} /></span>
                    <h3>Resumen</h3>
                  </div>
                  <div className="form-card-body">
                    <div className="total-fila">
                      <span>Solicitante</span>
                      <span className="total-valor solicitud-epp-resumen-texto">{responsable || '—'}</span>
                    </div>
                    <div className="total-fila">
                      <span>Moneda</span>
                      <span className="total-valor">{etiquetaMoneda(form.moneda)}</span>
                    </div>
                    <div className="total-fila total-final">
                      <span>Ítems solicitados</span>
                      <span className="total-valor total-monto">{form.items.length}</span>
                    </div>
                  </div>
                </div>


                <div className="acciones-form acciones-form-sidebar">
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => setVista('lista')}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-principal" disabled={guardando}>
                    {guardando
                      ? 'Guardando solicitud...'
                      : editandoId
                        ? 'Actualizar solicitud'
                        : 'Crear solicitud'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={mostrarConfirm}
        onClose={() => !eliminando && setMostrarConfirm(false)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar solicitud?"
        message="Esta acción eliminará la solicitud permanentemente."
        confirmLabel="Eliminar"
        busyLabel="Eliminando…"
        busy={eliminando}
      />
    </div>
  );
}
