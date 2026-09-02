import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiDownload, FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { useOrdenesCompra } from '../hooks/useOrdenesCompra';
import { useProveedores } from '../hooks/useProveedores';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { calcularTotalesOrden, validarOrdenCompra } from '../utils/ordenCompra';
import { downloadOrdenCompraPDF } from '../utils/generateOrdenCompraPDF';
import { formatDate, formatDateISO } from '../utils/formatDate';
import { addLog } from '../services/logService';
import { LISTA_PRECIOS_PARTNER_2026, buscarProductoPartner } from '../data/preciosPartner2026';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Compras.css';

const ITEM_VACIO = { codigo: '', descripcion: '', unidadMedida: 'UND.', cantidad: 1, precioUnitario: 0 };

function formularioVacio(config, userProfile, cotizacion = null) {
  const ocConfig = config?.ordenCompra || {};
  const empresa = config?.empresa || {};
  return {
    fecha: formatDateISO(),
    proveedorId: '',
    proveedor: { razonSocial: '', ruc: '', contacto: '', direccion: '', telefono: '', email: '' },
    moneda: ocConfig.moneda || 'US$',
    formaPago: ocConfig.formaPago || 'CREDITO 30 DIAS',
    lugarEntrega: empresa.direccion || '',
    referencia: cotizacion?.codigo || '',
    observaciones: '',
    aplicaIgv: ocConfig.aplicaIgv !== false,
    estado: 'Emitida',
    items: cotizacion?.items?.length
      ? cotizacion.items.map((item) => {
          const partner = buscarProductoPartner(item.codigo);
          return {
            codigo: item.codigo || '',
            descripcion: item.descripcion || item.nombre || partner?.descripcion || '',
            unidadMedida: item.unidadMedida || 'UND.',
            cantidad: Number(item.cantidad) || 1,
            // Precio Partner LP26 como costo de compra. No modifica precios existentes
            // de equipos ni precios de venta guardados en Firestore.
            precioUnitario: partner?.precioPartner ?? 0,
            precioPartnerAplicado: Boolean(partner)
          };
        })
      : [{ ...ITEM_VACIO }],
    origenCotizacionId: cotizacion?.id || null,
    origenCotizacionCodigo: cotizacion?.codigo || null,
    elaboradoPor: userProfile?.nombre || ocConfig.elaboradoPor || '',
    cargoElaborador: userProfile?.cargo || ocConfig.cargoElaborador || '',
    autorizadoPor: ocConfig.autorizadoPor || '',
    cargoAutorizador: ocConfig.cargoAutorizador || ''
  };
}

function moneda(monto, simbolo) {
  return `${simbolo || 'US$'} ${Number(monto || 0).toFixed(2)}`;
}

export default function Compras() {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useConfig();
  const { userProfile } = useAuth();
  const { ordenes, loading, error, create, update, remove } = useOrdenesCompra();
  const { proveedores, loading: cargandoProveedores, error: errorProveedores } = useProveedores();
  const { cotizaciones, loading: cargandoCotizaciones, error: errorCotizaciones } = useCotizaciones(true);
  const cotizacionInicial = location.state?.cotizacionOrigen || null;

  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(Boolean(cotizacionInicial));
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [exportandoId, setExportandoId] = useState(null);
  const [ordenEliminar, setOrdenEliminar] = useState(null);
  const [errores, setErrores] = useState({});
  const [form, setForm] = useState(() => formularioVacio(config, userProfile, cotizacionInicial));

  const totales = useMemo(() => calcularTotalesOrden(form.items, form.aplicaIgv), [form.items, form.aplicaIgv]);
  const ordenesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return ordenes;
    return ordenes.filter((orden) => [
      orden.codigo,
      orden.proveedor?.razonSocial,
      orden.proveedor?.ruc,
      orden.origenCotizacionCodigo,
      orden.estado
    ].some((valor) => String(valor || '').toLowerCase().includes(termino)));
  }, [ordenes, busqueda]);

  const cotizacionesDisponibles = useMemo(() => {
    const usadas = new Set(ordenes.map((orden) => orden.origenCotizacionId).filter(Boolean));
    return cotizaciones
      .filter((cotizacion) => !usadas.has(cotizacion.id) || cotizacion.id === form.origenCotizacionId)
      .sort((a, b) => String(b.fecha || b.createdAt || '').localeCompare(String(a.fecha || a.createdAt || '')));
  }, [cotizaciones, ordenes, form.origenCotizacionId]);

  function flash(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => setMensaje(null), 5000);
  }

  function abrirNueva() {
    setEditandoId(null);
    setErrores({});
    setForm(formularioVacio(config, userProfile));
    setMostrarModal(true);
  }

  function abrirEditar(orden) {
    setEditandoId(orden.id);
    setErrores({});
    setForm({ ...formularioVacio(config, userProfile), ...orden, items: orden.items?.map((item) => ({ ...item })) || [{ ...ITEM_VACIO }] });
    setMostrarModal(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setMostrarModal(false);
    if (location.state?.cotizacionOrigen) navigate('/compras', { replace: true });
  }

  function seleccionarCotizacionOrigen(id) {
    if (!id) {
      setForm((prev) => ({
        ...prev,
        origenCotizacionId: null,
        origenCotizacionCodigo: null,
        referencia: '',
        items: [{ ...ITEM_VACIO }]
      }));
      setErrores({});
      return;
    }

    const cotizacion = cotizacionesDisponibles.find((item) => item.id === id);
    if (!cotizacion) return;

    const base = formularioVacio(config, userProfile, cotizacion);
    setForm((prev) => ({
      ...base,
      proveedorId: prev.proveedorId,
      proveedor: prev.proveedor,
      formaPago: prev.formaPago || base.formaPago,
      lugarEntrega: prev.lugarEntrega || base.lugarEntrega,
      autorizadoPor: prev.autorizadoPor || base.autorizadoPor,
      cargoAutorizador: prev.cargoAutorizador || base.cargoAutorizador
    }));
    setErrores({});
  }

  function seleccionarProveedor(id) {
    const proveedor = proveedores.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      proveedorId: id,
      proveedor: proveedor ? {
        razonSocial: proveedor.razonSocial || '',
        ruc: proveedor.ruc || '',
        contacto: proveedor.contacto || '',
        direccion: proveedor.direccion || '',
        telefono: proveedor.telefono || proveedor.celular || '',
        email: proveedor.email || ''
      } : { razonSocial: '', ruc: '', contacto: '', direccion: '', telefono: '', email: '' }
    }));
  }

  function actualizarItem(index, campo, valor) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [campo]: ['cantidad', 'precioUnitario'].includes(campo) ? Math.max(0, Number(valor)) : valor }
        : item)
    }));
  }

  function actualizarCodigoItem(index, codigo) {
    const partner = buscarProductoPartner(codigo);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (!partner) {
          return { ...item, codigo, precioPartnerAplicado: false };
        }
        return {
          ...item,
          codigo: partner.codigo,
          descripcion: item.descripcion?.trim() ? item.descripcion : partner.descripcion,
          precioUnitario: partner.precioPartner,
          precioPartnerAplicado: true
        };
      })
    }));
  }

  function agregarItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...ITEM_VACIO }] }));
  }

  function quitarItem(index) {
    setForm((prev) => ({ ...prev, items: prev.items.length === 1 ? prev.items : prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function guardarOrden(event) {
    event.preventDefault();
    if (guardando) return;
    const payload = { ...form, ...totales };
    const validacion = validarOrdenCompra(payload);
    setErrores(validacion);
    if (Object.keys(validacion).length) return;

    setGuardando(true);
    try {
      if (editandoId) {
        const { codigo: _codigo, createdAt: _createdAt, id: _id, ...editable } = payload;
        void _codigo;
        void _createdAt;
        void _id;
        await update(editandoId, editable);
        await addLog({ usuario: userProfile?.nombre, accion: 'editar_orden_compra', detalle: form.codigo || editandoId });
        flash('success', `Orden ${form.codigo} actualizada`);
      } else {
        const result = await create(payload);
        await addLog({ usuario: userProfile?.nombre, accion: 'crear_orden_compra', detalle: result.codigo });
        flash('success', `Orden ${result.codigo} creada con correlativo reservado de forma segura`);
      }
      setMostrarModal(false);
      if (location.state?.cotizacionOrigen) navigate('/compras', { replace: true });
    } catch (err) {
      flash('error', err.message || 'No se pudo guardar la orden de compra');
    } finally {
      setGuardando(false);
    }
  }

  async function exportar(orden) {
    setExportandoId(orden.id);
    try {
      await downloadOrdenCompraPDF(orden, config);
    } catch (err) {
      flash('error', `No se pudo generar el PDF: ${err.message || ''}`);
    } finally {
      setExportandoId(null);
    }
  }

  async function confirmarEliminar() {
    try {
      await remove(ordenEliminar.id);
      flash('success', `Orden ${ordenEliminar.codigo} eliminada`);
    } catch (err) {
      flash('error', err.message || 'Solo se pueden eliminar órdenes en borrador');
    } finally {
      setOrdenEliminar(null);
    }
  }

  if (loading || cargandoProveedores || cargandoCotizaciones) return <Loading message="Cargando compras..." />;

  return (
    <div className="pagina compras-page">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Órdenes de compra</h1>
          <p className="pagina-subtitulo">Emite compras manuales o genera una orden desde cualquier cotización registrada.</p>
        </div>
        <div className="compras-header-actions">
          <button className="btn-principal" onClick={abrirNueva}>
            <FiPlus size={16} /> Nueva orden
          </button>
        </div>
      </div>

      {(mensaje || error || errorProveedores || errorCotizaciones) && (
        <div className={`mensaje-flash mensaje-${mensaje?.tipo || 'error'}`} role="status">
          {mensaje?.texto || error || errorProveedores || errorCotizaciones}
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por OC, proveedor, RUC o cotización..." />
        </div>
      </div>

      <div className="tarjeta-tabla">
        {ordenesFiltradas.length === 0 ? (
          <div className="estado-vacio">
            <p>No hay órdenes de compra registradas</p>
            <p className="pista">Crea una manualmente o genera una desde cualquier cotización disponible.</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-datos">
              <thead><tr><th>OC</th><th>Fecha</th><th>Proveedor</th><th>Origen</th><th>Estado</th><th className="texto-derecha">Total</th><th className="texto-centro">Acciones</th></tr></thead>
              <tbody>
                {ordenesFiltradas.map((orden) => (
                  <tr key={orden.id}>
                    <td className="texto-codigo">{orden.codigo}</td>
                    <td>{formatDate(orden.fecha)}</td>
                    <td><span className="texto-negrita">{orden.proveedor?.razonSocial || '-'}</span><small className="compras-ruc">{orden.proveedor?.ruc || ''}</small></td>
                    <td>{orden.origenCotizacionCodigo ? <span className="compras-origen">{orden.origenCotizacionCodigo}</span> : <span className="texto-suave">Manual</span>}</td>
                    <td><span className={`badge-estado ${orden.estado === 'Borrador' ? 'borrador' : 'aprobada'}`}>{orden.estado || 'Emitida'}</span></td>
                    <td className="texto-derecha texto-negrita">{moneda(orden.total, orden.moneda)}</td>
                    <td className="texto-centro"><div className="acciones-tabla">
                      <button className="btn-accion" onClick={() => exportar(orden)} disabled={exportandoId === orden.id} title="Descargar PDF"><FiDownload size={17} /></button>
                      <button className="btn-accion" onClick={() => abrirEditar(orden)} title="Editar orden"><FiEdit2 size={17} /></button>
                      {orden.estado === 'Borrador' && <button className="btn-accion btn-eliminar" onClick={() => setOrdenEliminar(orden)} title="Eliminar borrador"><FiTrash2 size={17} /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={mostrarModal} onClose={cerrarModal} title={editandoId ? `Editar ${form.codigo}` : (form.origenCotizacionCodigo ? `OC desde ${form.origenCotizacionCodigo}` : 'Nueva orden de compra')} size="large">
        <form className="formulario compras-form" onSubmit={guardarOrden}>
          <div className="campo">
            <label>Cotización de origen (opcional)</label>
            <select
              value={form.origenCotizacionId || ''}
              onChange={(event) => seleccionarCotizacionOrigen(event.target.value)}
              disabled={Boolean(editandoId)}
            >
              <option value="">Sin cotización · compra manual</option>
              {cotizacionesDisponibles.map((cotizacion) => (
                <option key={cotizacion.id} value={cotizacion.id}>
                  {cotizacion.codigo || 'Sin código'} · {cotizacion.cliente?.razonSocial || 'Cliente sin nombre'} · {cotizacion.estado}
                </option>
              ))}
            </select>
            {!editandoId && cotizacionesDisponibles.length === 0 && (
              <span className="pista">No hay cotizaciones disponibles sin una OC vinculada.</span>
            )}
          </div>
          {form.origenCotizacionCodigo && (
            <div className="compras-aviso">
              Se copiaron productos y cantidades de {form.origenCotizacionCodigo}. Al crear la OC, esa cotización pasará automáticamente a Aceptada. Cuando el código existe en la lista LP26, el costo se carga desde <strong>Precio Partner</strong>; los precios actuales del ERP y los precios de venta de la cotización no se modifican.
            </div>
          )}
          <div className="fila-form">
            <div className="campo campo-doble">
              <label>Proveedor *</label>
              <select value={form.proveedorId} onChange={(event) => seleccionarProveedor(event.target.value)} className={errores.proveedor ? 'input-error' : ''}>
                <option value="">Seleccione un proveedor</option>
                {proveedores.filter((proveedor) => proveedor.activo !== false || proveedor.id === form.proveedorId).map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.razonSocial}{proveedor.ruc ? ` · ${proveedor.ruc}` : ''}{proveedor.activo === false ? ' · INACTIVO' : ''}</option>)}
              </select>
              {errores.proveedor && <span className="mensaje-error">{errores.proveedor}</span>}
            </div>
            <div className="campo"><label>Fecha *</label><input type="date" value={form.fecha} onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))} /></div>
            <div className="campo"><label>Moneda</label><select value={form.moneda} onChange={(event) => setForm((prev) => ({ ...prev, moneda: event.target.value }))}><option value="US$">Dólares (US$)</option><option value="S/">Soles (S/)</option></select></div>
          </div>
          <div className="fila-form">
            <div className="campo"><label>Forma de pago *</label><input value={form.formaPago} onChange={(event) => setForm((prev) => ({ ...prev, formaPago: event.target.value }))} /></div>
            <div className="campo campo-doble"><label>Lugar de entrega *</label><input value={form.lugarEntrega} onChange={(event) => setForm((prev) => ({ ...prev, lugarEntrega: event.target.value }))} /></div>
            <div className="campo"><label>Referencia</label><input value={form.referencia} onChange={(event) => setForm((prev) => ({ ...prev, referencia: event.target.value }))} /></div>
          </div>

          <div className="compras-items-header"><h3>Ítems de compra</h3><button type="button" className="btn-secundario btn-pequeno" onClick={agregarItem}><FiPlus size={14} /> Agregar ítem</button></div>
          {errores.items && <span className="mensaje-error">{errores.items}</span>}
          <datalist id="catalogo-partner-2026">
            {LISTA_PRECIOS_PARTNER_2026.map((producto) => (
              <option key={producto.codigo} value={producto.codigo}>{producto.descripcion}</option>
            ))}
          </datalist>
          <div className="tabla-contenedor compras-items-wrap">
            <table className="compras-items"><thead><tr><th>Código</th><th>Descripción *</th><th>U.M.</th><th>Cant.</th><th>Precio Partner / compra</th><th>Total</th><th></th></tr></thead><tbody>
              {form.items.map((item, index) => (
                <tr key={`${index}-${item.codigo}`}>
                  <td>
                    <input
                      list="catalogo-partner-2026"
                      value={item.codigo}
                      onChange={(event) => actualizarCodigoItem(index, event.target.value)}
                      placeholder="Código Testo o manual"
                    />
                  </td>
                  <td><textarea rows="2" value={item.descripcion} onChange={(event) => actualizarItem(index, 'descripcion', event.target.value)} /></td>
                  <td><input value={item.unidadMedida} onChange={(event) => actualizarItem(index, 'unidadMedida', event.target.value)} /></td>
                  <td><input type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(event) => actualizarItem(index, 'cantidad', event.target.value)} /></td>
                  <td>
                    <input type="number" min="0" step="0.01" value={item.precioUnitario} onChange={(event) => actualizarItem(index, 'precioUnitario', event.target.value)} />
                    {item.precioPartnerAplicado && <small className="pista">LP26 · Precio Partner</small>}
                  </td>
                  <td className="texto-derecha">{moneda(Number(item.cantidad) * Number(item.precioUnitario), form.moneda)}</td>
                  <td><button type="button" className="btn-accion btn-eliminar" onClick={() => quitarItem(index)} disabled={form.items.length === 1} aria-label={`Quitar ítem ${index + 1}`}><FiTrash2 /></button></td>
                </tr>
              ))}
            </tbody></table>
          </div>

          <div className="compras-form-bottom">
            <div className="compras-observaciones">
              <div className="campo"><label>Observaciones</label><textarea rows="3" value={form.observaciones} onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></div>
              <label className="compras-check"><input type="checkbox" checked={form.aplicaIgv} onChange={(event) => setForm((prev) => ({ ...prev, aplicaIgv: event.target.checked }))} /> Aplicar IGV 18%</label>
              <div className="campo"><label>Estado</label><select value={form.estado} onChange={(event) => setForm((prev) => ({ ...prev, estado: event.target.value }))}><option value="Borrador">Borrador</option><option value="Emitida">Emitida</option></select></div>
            </div>
            <dl className="compras-totales"><div><dt>Subtotal</dt><dd>{moneda(totales.subtotal, form.moneda)}</dd></div><div><dt>IGV</dt><dd>{moneda(totales.igv, form.moneda)}</dd></div><div className="compras-total-final"><dt>Total</dt><dd>{moneda(totales.total, form.moneda)}</dd></div></dl>
          </div>
          <div className="acciones-form"><button type="button" className="btn-secundario" onClick={cerrarModal} disabled={guardando}>Cancelar</button><button type="submit" className="btn-principal" disabled={guardando}>{guardando ? 'Guardando de forma segura...' : (editandoId ? 'Guardar cambios' : 'Crear orden y asignar correlativo')}</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={Boolean(ordenEliminar)} onClose={() => setOrdenEliminar(null)} onConfirm={confirmarEliminar} title="¿Eliminar borrador?" message={`Se eliminará ${ordenEliminar?.codigo || 'la orden'}. Esta acción no se puede deshacer.`} />
    </div>
  );
}
