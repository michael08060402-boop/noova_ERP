import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  FiPlus, FiSearch, FiTrash2, FiEdit2, FiSend, FiEye, FiClock,
  FiFileText, FiTruck, FiRefreshCw
} from 'react-icons/fi';
import { useSolicitudesCotizacion } from '../hooks/useSolicitudesCotizacion';
import { useProveedores } from '../hooks/useProveedores';
import { useAuth } from '../context/AuthContext';
import { addLog } from '../services/logService';
import { formatDate } from '../utils/formatDate';
import { contienePatronPeligroso } from '../utils/validation';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './SolicitudesCotizacion.css';

const TIPOS_SOLICITUD = ['Adquisición de equipos', 'Servicio de calibración', 'Servicio general', 'Otro'];

// Mensajes predefinidos según lo que se vaya a pedir. El usuario solo
// completa el detalle (qué equipo, qué servicio, cantidades, etc.) — no
// hace falta armar una tabla de ítems ni registrar la empresa antes.
const PLANTILLAS_POR_TIPO = {
  'Adquisición de equipos':
    'Detalle los equipos que necesita cotizar: nombre, marca/modelo de referencia, cantidad y especificaciones técnicas.\n\nEj: Termohigrómetro digital, rango -20°C a 60°C, 2 unidades, con certificado de calibración incluido.',
  'Servicio de calibración':
    'Detalle el equipo a calibrar: nombre, marca, modelo, rango y norma o patrón bajo el cual necesita el certificado.\n\nEj: Calibración de balanza analítica, marca XXX, modelo XXX, rango 0-220g, según NTP/ISO vigente.',
  'Servicio general':
    'Detalle el servicio que necesita cotizar (alcance, lugar, plazo estimado, condiciones particulares).',
  'Otro':
    'Detalle lo que necesita cotizar.'
};

const SOLICITUD_VACIA = {
  tipo: TIPOS_SOLICITUD[0],
  proveedorId: '',
  proveedorNombre: '',
  proveedorEmail: '',
  fechaLimite: '',
  detalle: PLANTILLAS_POR_TIPO[TIPOS_SOLICITUD[0]]
};

const PROVEEDOR_VACIO = { razonSocial: '', ruc: '', contacto: '', email: '', telefono: '', rubro: '' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badgeEstadoClase(estado) {
  const mapa = { Borrador: 'borrador', Enviada: 'enviada', Respondida: 'aprobada', Cerrada: 'rechazada' };
  return mapa[estado] || 'borrador';
}

function construirCuerpoCorreo({ solicitud, empresaNombre, remitenteNombre }) {
  const detalleHtml = (solicitud.detalle || '')
    .split('\n')
    .map((linea) => `<p style="margin:0 0 8px;">${linea || '&nbsp;'}</p>`)
    .join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <p>Estimados señores,</p>
      <p>Por medio del presente, ${empresaNombre || 'nuestra empresa'} solicita a ustedes cotización
      (${solicitud.tipo || 'requerimiento'}, ref. <strong>${solicitud.codigo || ''}</strong>) para lo siguiente:</p>
      ${detalleHtml}
      ${solicitud.fechaLimite ? `<p>Agradeceremos remitir su cotización antes del <strong>${formatDate(solicitud.fechaLimite)}</strong>.</p>` : ''}
      <p>Quedamos atentos a su respuesta.</p>
      <p>Saludos cordiales,<br/>${remitenteNombre || ''}<br/>${empresaNombre || ''}</p>
    </div>
  `;
}

export default function SolicitudesCotizacion() {
  const { userProfile, currentUser } = useAuth();
  const {
    solicitudes, loading, addSolicitud, editSolicitud, removeSolicitud, enviarSolicitud
  } = useSolicitudesCotizacion();
  const {
    proveedores, loading: loadingProveedores, addProveedor, editProveedor, removeProveedor
  } = useProveedores();

  const [tabActiva, setTabActiva] = useState('solicitudes'); // 'solicitudes' | 'proveedores'
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  }

  // ── Solicitudes: modal crear/editar + enviar en un solo paso ──
  const [mostrarModalSolicitud, setMostrarModalSolicitud] = useState(false);
  const [editandoSolicitudId, setEditandoSolicitudId] = useState(null);
  const [enviandoDesdeModal, setEnviandoDesdeModal] = useState(false);
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);

  const {
    register, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors }
  } = useForm({ defaultValues: SOLICITUD_VACIA });

  const tipoSeleccionado = watch('tipo');
  const proveedorIdSeleccionado = watch('proveedorId');

  function alSeleccionarProveedor(id) {
    setValue('proveedorId', id);
    const prov = proveedores.find((p) => p.id === id);
    if (prov) {
      setValue('proveedorNombre', prov.razonSocial || '');
      setValue('proveedorEmail', prov.email || '');
    }
  }

  function usarPlantilla() {
    setValue('detalle', PLANTILLAS_POR_TIPO[tipoSeleccionado] || '');
  }

  function alCambiarTipo(nuevoTipo) {
    setValue('tipo', nuevoTipo);
    const detalleActual = getValues('detalle');
    const eraPlantilla = Object.values(PLANTILLAS_POR_TIPO).includes(detalleActual) || !detalleActual?.trim();
    if (eraPlantilla) {
      setValue('detalle', PLANTILLAS_POR_TIPO[nuevoTipo] || '');
    }
  }

  function nuevaSolicitud() {
    setEditandoSolicitudId(null);
    reset(SOLICITUD_VACIA);
    setMostrarModalSolicitud(true);
  }

  function editarSolicitud(sol) {
    setEditandoSolicitudId(sol.id);
    reset({
      tipo: sol.tipo || TIPOS_SOLICITUD[0],
      proveedorId: sol.proveedorId || '',
      proveedorNombre: sol.proveedorNombre || '',
      proveedorEmail: sol.proveedorEmail || '',
      fechaLimite: sol.fechaLimite || '',
      detalle: sol.detalle || PLANTILLAS_POR_TIPO[sol.tipo] || ''
    });
    setMostrarModalSolicitud(true);
  }

  function validarFormulario(data) {
    if (!data.proveedorEmail || !EMAIL_REGEX.test(data.proveedorEmail)) {
      mostrarMensaje('error', 'Ingresa un correo de destino válido');
      return false;
    }
    if (!data.detalle || !data.detalle.trim()) {
      mostrarMensaje('error', 'Escribe el detalle de lo que necesitas cotizar');
      return false;
    }
    if (contienePatronPeligroso(data.detalle)) {
      mostrarMensaje('error', 'El detalle contiene caracteres no permitidos');
      return false;
    }
    return true;
  }

  function armarPayload(data) {
    return {
      tipo: data.tipo,
      proveedorId: data.proveedorId || '',
      proveedorNombre: (data.proveedorNombre || '').trim() || data.proveedorEmail,
      proveedorEmail: data.proveedorEmail.trim(),
      fechaLimite: data.fechaLimite || '',
      detalle: data.detalle.trim()
    };
  }

  // Guardar como borrador, sin enviar todavía
  async function alGuardarBorrador(data) {
    if (!validarFormulario(data)) return;
    setGuardandoBorrador(true);
    try {
      const payload = armarPayload(data);
      if (editandoSolicitudId) {
        await editSolicitud(editandoSolicitudId, payload);
        await addLog({ usuario: userProfile?.nombre || currentUser?.email, accion: 'editar_solicitud_cotizacion', detalle: editandoSolicitudId });
      } else {
        const { codigo } = await addSolicitud(payload);
        await addLog({ usuario: userProfile?.nombre || currentUser?.email, accion: 'crear_solicitud_cotizacion', detalle: codigo });
      }
      mostrarMensaje('success', 'Guardado como borrador');
      setMostrarModalSolicitud(false);
    } catch (err) {
      console.error('Error guardando solicitud:', err);
      mostrarMensaje('error', 'Error al guardar: ' + err.message);
    } finally {
      setGuardandoBorrador(false);
    }
  }

  // Flujo principal: guarda (o actualiza) Y envía el correo, en un solo clic
  async function alEnviarDesdeModal(data) {
    if (!validarFormulario(data)) return;
    setEnviandoDesdeModal(true);
    try {
      const payload = armarPayload(data);
      const empresaNombre = 'NOOVA S.A.C.';
      const remitenteNombre = userProfile?.nombre || currentUser?.email || '';

      let solicitudId = editandoSolicitudId;
      let codigo;
      if (solicitudId) {
        await editSolicitud(solicitudId, payload);
      } else {
        const creada = await addSolicitud(payload);
        solicitudId = creada.id;
        codigo = creada.codigo;
      }

      const cuerpoHtml = construirCuerpoCorreo({
        solicitud: { ...payload, codigo: codigo || solicitudes.find((s) => s.id === solicitudId)?.codigo },
        empresaNombre,
        remitenteNombre
      });
      const asunto = `Solicitud de cotización${codigo ? ` ${codigo}` : ''} - ${empresaNombre}`;

      await enviarSolicitud({
        solicitudId,
        destinatarios: [payload.proveedorEmail],
        cc: userProfile?.email || currentUser?.email ? [userProfile?.email || currentUser?.email] : [],
        asunto,
        cuerpoHtml
      });

      await addLog({
        usuario: userProfile?.nombre || currentUser?.email,
        accion: 'enviar_solicitud_cotizacion',
        detalle: `${codigo || solicitudId} → ${payload.proveedorEmail}`
      });

      mostrarMensaje('success', 'Solicitud enviada correctamente');
      setMostrarModalSolicitud(false);
    } catch (err) {
      console.error('Error enviando solicitud:', err);
      mostrarMensaje('error', 'Error al enviar: ' + err.message);
    } finally {
      setEnviandoDesdeModal(false);
    }
  }

  // ── Solicitudes: eliminar ──
  const [mostrarConfirmSolicitud, setMostrarConfirmSolicitud] = useState(false);
  const [eliminarSolicitudId, setEliminarSolicitudId] = useState(null);

  async function confirmarEliminarSolicitud() {
    try {
      await removeSolicitud(eliminarSolicitudId);
      setMostrarConfirmSolicitud(false);
      setEliminarSolicitudId(null);
    } catch (err) {
      mostrarMensaje('error', 'Error al eliminar: ' + err.message);
    }
  }

  // ── Solicitudes: ver detalle ──
  const [solicitudDetalle, setSolicitudDetalle] = useState(null);

  // ── Solicitudes: reenviar una ya creada (desde la tabla) ──
  const [reenviando, setReenviando] = useState(null); // id en curso

  async function reenviarSolicitud(sol) {
    if (!sol.proveedorEmail) {
      mostrarMensaje('error', 'Esta solicitud no tiene un correo de destino registrado');
      return;
    }
    setReenviando(sol.id);
    try {
      const empresaNombre = 'NOOVA S.A.C.';
      const remitenteNombre = userProfile?.nombre || currentUser?.email || '';
      const cuerpoHtml = construirCuerpoCorreo({ solicitud: sol, empresaNombre, remitenteNombre });
      const asunto = `Solicitud de cotización ${sol.codigo || ''} - ${empresaNombre}`;
      await enviarSolicitud({
        solicitudId: sol.id,
        destinatarios: [sol.proveedorEmail],
        cc: userProfile?.email || currentUser?.email ? [userProfile?.email || currentUser?.email] : [],
        asunto,
        cuerpoHtml
      });
      await addLog({
        usuario: userProfile?.nombre || currentUser?.email,
        accion: 'reenviar_solicitud_cotizacion',
        detalle: `${sol.codigo} → ${sol.proveedorEmail}`
      });
      mostrarMensaje('success', 'Solicitud reenviada correctamente');
    } catch (err) {
      mostrarMensaje('error', 'Error al reenviar: ' + err.message);
    } finally {
      setReenviando(null);
    }
  }

  // ── Proveedores: modal crear/editar (opcional, solo para agilizar envíos repetidos) ──
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [editandoProveedorId, setEditandoProveedorId] = useState(null);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const {
    register: registerProv, handleSubmit: handleSubmitProv, reset: resetProv,
    formState: { errors: errorsProv }
  } = useForm({ defaultValues: PROVEEDOR_VACIO });

  function nuevoProveedor() {
    setEditandoProveedorId(null);
    resetProv(PROVEEDOR_VACIO);
    setMostrarModalProveedor(true);
  }

  function editarProveedor(prov) {
    setEditandoProveedorId(prov.id);
    resetProv({
      razonSocial: prov.razonSocial || '',
      ruc: prov.ruc || '',
      contacto: prov.contacto || '',
      email: prov.email || '',
      telefono: prov.telefono || '',
      rubro: prov.rubro || ''
    });
    setMostrarModalProveedor(true);
  }

  async function alGuardarProveedor(data) {
    if (data.email && !EMAIL_REGEX.test(data.email)) {
      mostrarMensaje('error', 'El correo del proveedor no es válido');
      return;
    }
    setGuardandoProveedor(true);
    try {
      if (editandoProveedorId) {
        await editProveedor(editandoProveedorId, data);
      } else {
        await addProveedor(data);
      }
      setMostrarModalProveedor(false);
    } catch (err) {
      mostrarMensaje('error', 'Error al guardar proveedor: ' + err.message);
    } finally {
      setGuardandoProveedor(false);
    }
  }

  const [mostrarConfirmProveedor, setMostrarConfirmProveedor] = useState(false);
  const [eliminarProveedorId, setEliminarProveedorId] = useState(null);

  async function confirmarEliminarProveedor() {
    try {
      await removeProveedor(eliminarProveedorId);
      setMostrarConfirmProveedor(false);
      setEliminarProveedorId(null);
    } catch (err) {
      mostrarMensaje('error', 'Error al eliminar proveedor: ' + err.message);
    }
  }

  const solicitudesFiltradas = useMemo(() => {
    const term = terminoBusqueda.toLowerCase();
    return solicitudes.filter((s) =>
      (s.codigo || '').toLowerCase().includes(term) ||
      (s.proveedorNombre || '').toLowerCase().includes(term) ||
      (s.tipo || '').toLowerCase().includes(term)
    );
  }, [solicitudes, terminoBusqueda]);

  const proveedoresFiltrados = useMemo(() => {
    const term = terminoBusqueda.toLowerCase();
    return proveedores.filter((p) =>
      (p.razonSocial || '').toLowerCase().includes(term) ||
      (p.ruc || '').toLowerCase().includes(term) ||
      (p.rubro || '').toLowerCase().includes(term)
    );
  }, [proveedores, terminoBusqueda]);

  if (loading || loadingProveedores) return <Loading message="Cargando solicitudes de cotización..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Solicitudes de Cotización a Proveedores</h1>
          <p className="pagina-subtitle">Pide cotizaciones a otras empresas: escribe el correo, el detalle y envía.</p>
        </div>
        {tabActiva === 'solicitudes' ? (
          <button className="btn-principal" onClick={nuevaSolicitud}>
            <FiPlus size={16} /> Nueva Solicitud
          </button>
        ) : (
          <button className="btn-principal" onClick={nuevoProveedor}>
            <FiPlus size={16} /> Nuevo Proveedor
          </button>
        )}
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>{mensaje.texto}</div>
      )}

      <div className="sc-tabs">
        <button
          className={`sc-tab ${tabActiva === 'solicitudes' ? 'sc-tab-activa' : ''}`}
          onClick={() => { setTabActiva('solicitudes'); setTerminoBusqueda(''); }}
        >
          <FiFileText size={15} /> Solicitudes ({solicitudes.length})
        </button>
        <button
          className={`sc-tab ${tabActiva === 'proveedores' ? 'sc-tab-activa' : ''}`}
          onClick={() => { setTabActiva('proveedores'); setTerminoBusqueda(''); }}
        >
          <FiTruck size={15} /> Proveedores guardados ({proveedores.length})
        </button>
      </div>

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder={tabActiva === 'solicitudes' ? 'Buscar por código, proveedor o tipo...' : 'Buscar por razón social, RUC o rubro...'}
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
          />
        </div>
      </div>

      {tabActiva === 'solicitudes' ? (
        <div className="tarjeta-tabla">
          {solicitudesFiltradas.length === 0 ? (
            <div className="estado-vacio">
              <p>No hay solicitudes de cotización</p>
              <p className="pista">Crea una nueva solicitud: solo necesitas el correo del proveedor y el detalle</p>
            </div>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Proveedor / Correo</th>
                    <th>Tipo</th>
                    <th>Fecha límite</th>
                    <th className="texto-centro">Estado</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudesFiltradas.map((s) => (
                    <tr key={s.id}>
                      <td className="texto-codigo">{s.codigo}</td>
                      <td>
                        <div className="texto-negrita">{s.proveedorNombre || '—'}</div>
                        <div className="pista">{s.proveedorEmail}</div>
                      </td>
                      <td>{s.tipo}</td>
                      <td>{s.fechaLimite ? formatDate(s.fechaLimite) : '—'}</td>
                      <td className="texto-centro">
                        <span className={`badge-estado ${badgeEstadoClase(s.estado)}`}>{s.estado}</span>
                      </td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => setSolicitudDetalle(s)} title="Ver detalle">
                            <FiEye size={16} />
                          </button>
                          <button className="btn-accion" onClick={() => editarSolicitud(s)} title="Editar">
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            className="btn-accion btn-enviar"
                            onClick={() => reenviarSolicitud(s)}
                            title={s.estado === 'Borrador' ? 'Enviar' : 'Reenviar'}
                            disabled={reenviando === s.id}
                          >
                            {reenviando === s.id ? <FiRefreshCw size={16} className="sc-spin" /> : <FiSend size={16} />}
                          </button>
                          <button
                            className="btn-accion btn-eliminar"
                            onClick={() => { setEliminarSolicitudId(s.id); setMostrarConfirmSolicitud(true); }}
                            title="Eliminar"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="tarjeta-tabla">
          {proveedoresFiltrados.length === 0 ? (
            <div className="estado-vacio">
              <p>No hay proveedores guardados</p>
              <p className="pista">Guardar un proveedor es opcional: solo agiliza envíos repetidos, no es obligatorio para enviar una solicitud</p>
            </div>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Razón social</th>
                    <th>RUC</th>
                    <th>Rubro</th>
                    <th>Contacto</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedoresFiltrados.map((p) => (
                    <tr key={p.id}>
                      <td className="texto-negrita">{p.razonSocial}</td>
                      <td>{p.ruc || '—'}</td>
                      <td>{p.rubro || '—'}</td>
                      <td>{p.contacto || '—'}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.telefono || '—'}</td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => editarProveedor(p)} title="Editar">
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            className="btn-accion btn-eliminar"
                            onClick={() => { setEliminarProveedorId(p.id); setMostrarConfirmProveedor(true); }}
                            title="Eliminar"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: nueva/editar solicitud — escribir y enviar en un solo paso */}
      <Modal
        isOpen={mostrarModalSolicitud}
        onClose={() => setMostrarModalSolicitud(false)}
        title={editandoSolicitudId ? 'Editar Solicitud de Cotización' : 'Nueva Solicitud de Cotización'}
        size="large"
      >
        <div className="formulario">
          <div className="campo">
            <label>Tipo de solicitud (define el mensaje predefinido) *</label>
            <select value={tipoSeleccionado} onChange={(e) => alCambiarTipo(e.target.value)}>
              {TIPOS_SOLICITUD.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {proveedores.length > 0 && (
            <div className="campo">
              <label>Usar un proveedor guardado (opcional)</label>
              <select value={proveedorIdSeleccionado || ''} onChange={(e) => alSeleccionarProveedor(e.target.value)}>
                <option value="">-- Escribir correo directamente --</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.razonSocial}</option>
                ))}
              </select>
            </div>
          )}

          <div className="campo">
            <label>Correo del proveedor *</label>
            <input
              type="email"
              {...register('proveedorEmail', {
                required: 'El correo es requerido',
                pattern: { value: EMAIL_REGEX, message: 'Correo inválido' }
              })}
              className={errors.proveedorEmail ? 'input-error' : ''}
              placeholder="contacto@proveedor.com"
            />
            {errors.proveedorEmail && <span className="mensaje-error">{errors.proveedorEmail.message}</span>}
          </div>

          <div className="campo">
            <label>Nombre del proveedor (opcional)</label>
            <input {...register('proveedorNombre')} placeholder="Si lo dejas vacío, se usa el correo" />
          </div>

          <div className="campo">
            <label>Fecha límite para responder (opcional)</label>
            <input type="date" {...register('fechaLimite')} />
          </div>

          <div className="campo campo-ancho">
            <div className="sc-detalle-label-row">
              <label>Detalle de lo que necesitas cotizar *</label>
              <button type="button" className="sc-link-plantilla" onClick={usarPlantilla}>
                Usar mensaje predefinido
              </button>
            </div>
            <textarea
              {...register('detalle', { required: true })}
              rows={7}
              placeholder="Describe qué necesitas cotizar..."
            />
          </div>

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setMostrarModalSolicitud(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-secundario"
              onClick={handleSubmit(alGuardarBorrador)}
              disabled={guardandoBorrador || enviandoDesdeModal}
            >
              {guardandoBorrador ? 'Guardando...' : 'Guardar borrador'}
            </button>
            <button
              type="button"
              className="btn-principal"
              onClick={handleSubmit(alEnviarDesdeModal)}
              disabled={guardandoBorrador || enviandoDesdeModal}
            >
              {enviandoDesdeModal ? 'Enviando...' : <><FiSend size={14} /> Enviar por correo</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: ver detalle */}
      <Modal
        isOpen={!!solicitudDetalle}
        onClose={() => setSolicitudDetalle(null)}
        title={`Detalle ${solicitudDetalle?.codigo || ''}`}
        size="large"
      >
        {solicitudDetalle && (
          <div className="sc-detalle">
            <div className="sc-detalle-grid">
              <div><span className="sc-detalle-label">Proveedor</span><span>{solicitudDetalle.proveedorNombre || '—'}</span></div>
              <div><span className="sc-detalle-label">Correo</span><span>{solicitudDetalle.proveedorEmail || '—'}</span></div>
              <div><span className="sc-detalle-label">Tipo</span><span>{solicitudDetalle.tipo}</span></div>
              <div><span className="sc-detalle-label">Estado</span><span className={`badge-estado ${badgeEstadoClase(solicitudDetalle.estado)}`}>{solicitudDetalle.estado}</span></div>
              <div><span className="sc-detalle-label">Fecha límite</span><span>{solicitudDetalle.fechaLimite ? formatDate(solicitudDetalle.fechaLimite) : '—'}</span></div>
            </div>

            <p className="sc-detalle-label" style={{ marginTop: '0.75rem' }}>Detalle</p>
            <p className="sc-detalle-obs" style={{ whiteSpace: 'pre-wrap' }}>{solicitudDetalle.detalle}</p>

            <div className="sc-historial">
              <span className="sc-detalle-label"><FiClock size={13} /> Historial de envíos</span>
              {(solicitudDetalle.historialEnvios || []).length === 0 ? (
                <p className="pista">Aún no se ha enviado esta solicitud</p>
              ) : (
                <ul>
                  {solicitudDetalle.historialEnvios.map((h, i) => (
                    <li key={i}>{formatDate(h.fecha)} — {(h.destinatarios || []).join(', ')}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirmSolicitud}
        onClose={() => setMostrarConfirmSolicitud(false)}
        onConfirm={confirmarEliminarSolicitud}
        title="¿Eliminar solicitud?"
        message="Esta acción eliminará la solicitud de cotización permanentemente. ¿Está seguro?"
      />

      {/* Modal: nuevo/editar proveedor */}
      <Modal
        isOpen={mostrarModalProveedor}
        onClose={() => setMostrarModalProveedor(false)}
        title={editandoProveedorId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      >
        <form onSubmit={handleSubmitProv(alGuardarProveedor)} className="formulario">
          <div className="campo">
            <label>Razón social *</label>
            <input
              {...registerProv('razonSocial', { required: 'La razón social es requerida' })}
              className={errorsProv.razonSocial ? 'input-error' : ''}
            />
            {errorsProv.razonSocial && <span className="mensaje-error">{errorsProv.razonSocial.message}</span>}
          </div>
          <div className="campo">
            <label>RUC</label>
            <input {...registerProv('ruc')} placeholder="20XXXXXXXXX" />
          </div>
          <div className="campo">
            <label>Rubro</label>
            <input {...registerProv('rubro')} placeholder="Ej: Calibraciones, equipos, insumos..." />
          </div>
          <div className="campo">
            <label>Persona de contacto</label>
            <input {...registerProv('contacto')} />
          </div>
          <div className="campo">
            <label>Correo *</label>
            <input
              type="email"
              {...registerProv('email', {
                required: 'El correo es requerido',
                pattern: { value: EMAIL_REGEX, message: 'Correo inválido' }
              })}
              className={errorsProv.email ? 'input-error' : ''}
            />
            {errorsProv.email && <span className="mensaje-error">{errorsProv.email.message}</span>}
          </div>
          <div className="campo">
            <label>Teléfono</label>
            <input {...registerProv('telefono')} />
          </div>
          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setMostrarModalProveedor(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={guardandoProveedor}>
              {guardandoProveedor ? 'Guardando...' : editandoProveedorId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirmProveedor}
        onClose={() => setMostrarConfirmProveedor(false)}
        onConfirm={confirmarEliminarProveedor}
        title="¿Eliminar proveedor?"
        message="Esta acción eliminará el proveedor permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
