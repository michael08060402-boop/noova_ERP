import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FiMessageCircle, FiSearch, FiSend, FiUser, FiClock,
  FiAlertCircle, FiCheckCircle, FiX, FiChevronDown, FiUsers,
  FiCalendar, FiTrash2
} from 'react-icons/fi';
import { useClientes } from '../hooks/useClientes';
import { useAuth } from '../context/AuthContext';
import { addLog } from '../services/logService';
import {
  registrarEnvioMensaje,
  getHistorialMensajes,
  marcarComoEnviado,
  cancelarEnvioProgramado
} from '../services/mensajeriaService';
import { useEnviosProgramados } from '../hooks/useEnviosProgramados';
import {
  abrirWhatsApp,
  PLANTILLAS_WHATSAPP,
  rellenarPlantilla
} from '../utils/whatsapp';
import {
  validarMensajeWhatsapp,
  validarCelular,
  normalizarCelularPE,
  contienePatronPeligroso
} from '../utils/validation';
import Loading from '../components/Loading';
import ConfirmDialog from '../components/ConfirmDialog';
import '../styles/shared.css';
import './Mensajeria.css';

const MAX_CARACTERES = 4000;

function obtenerContactosDeCliente(cliente) {
  if (!cliente) return [];
  if (Array.isArray(cliente.contactos) && cliente.contactos.length > 0) {
    return cliente.contactos.filter(Boolean).map(contacto => ({
      ...contacto,
      celular: String(contacto.celular || contacto.telefono || '').trim()
    }));
  }
  if (cliente.contacto || cliente.email || cliente.telefono || cliente.celular) {
    return [{
      nombre: cliente.contacto || '',
      celular: String(cliente.telefono || cliente.celular || '').trim(),
      email: cliente.email || ''
    }];
  }
  return [];
}

function formatearFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export default function Mensajeria() {
  const { clientes, loading, error: errorClientes } = useClientes();
  const { currentUser, userProfile } = useAuth();

  const [tabActiva, setTabActiva] = useState('composer'); // 'composer' | 'programados'
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [contactoSeleccionado, setContactoSeleccionado] = useState(null);

  const [mensaje, setMensaje] = useState('');
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [errorForm, setErrorForm] = useState(null);
  const [infoEnvio, setInfoEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Programación
  const [programar, setProgramar] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState('');

  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  // Cancelar envío programado
  const [cancelarId, setCancelarId] = useState(null);
  const [mostrarConfirmCancelar, setMostrarConfirmCancelar] = useState(false);

  const [mostrarListaClientes, setMostrarListaClientes] = useState(true);

  const responsable = userProfile?.nombre || currentUser?.email || '';

  // Hook de envíos programados — dispara automáticamente los pendientes
  const handleEnvioDisparado = useCallback((envio) => {
    setInfoEnvio({
      tipo: 'success',
      texto: `WhatsApp abierto: ${envio.clienteNombre} → ${envio.numeroDestino}. Confirma el envío en WhatsApp.`
    });
    setTimeout(() => setInfoEnvio(null), 6000);
  }, []);

  const { enviosPendientes, refrescar: refrescarProgramados } = useEnviosProgramados(
    currentUser?.uid,
    handleEnvioDisparado
  );

  // Carga historial
  const cargarHistorial = useCallback(async () => {
    try {
      setCargandoHistorial(true);
      const data = await getHistorialMensajes(50);
      setHistorial(data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  // Refresca programados cuando se monta el tab
  useEffect(() => {
    if (tabActiva === 'programados') refrescarProgramados();
  }, [tabActiva, refrescarProgramados]);

  const clientesFiltrados = useMemo(() => {
    if (!terminoBusqueda.trim()) return clientes;
    const term = terminoBusqueda.toLowerCase();
    return clientes.filter(c =>
      c.razonSocial?.toLowerCase().includes(term) ||
      c.ruc?.toLowerCase().includes(term) ||
      (c.contactos || []).some(ct =>
        ct.nombre?.toLowerCase().includes(term) ||
        String(ct.celular || ct.telefono || '').toLowerCase().includes(term)
      )
    );
  }, [clientes, terminoBusqueda]);

  const contactosActuales = useMemo(
    () => obtenerContactosDeCliente(clienteSeleccionado),
    [clienteSeleccionado]
  );

  function seleccionarCliente(cliente) {
    setClienteSeleccionado(cliente);
    const contactosValidos = obtenerContactosDeCliente(cliente)
      .filter(contacto => contacto.celular && !validarCelular(contacto.celular));
    // Solo elegir automáticamente si no hay ambigüedad de destinatario.
    setContactoSeleccionado(contactosValidos.length === 1 ? contactosValidos[0] : null);
    setMostrarListaClientes(false);
    setErrorForm(null);
    setInfoEnvio(null);
  }

  function seleccionarContacto(contacto) {
    setContactoSeleccionado(contacto);
    setErrorForm(null);
    setInfoEnvio(null);
  }

  function aplicarPlantilla(plantillaId) {
    setPlantillaSeleccionada(plantillaId);
    const plantilla = PLANTILLAS_WHATSAPP.find(p => p.id === plantillaId);
    if (!plantilla) {
      setMensaje('');
      return;
    }
    const nombre = contactoSeleccionado?.nombre || clienteSeleccionado?.razonSocial || '';
    const rellenado = rellenarPlantilla(plantilla.cuerpo, { nombre, responsable });
    setMensaje(rellenado);
  }

  function validarEnvio() {
    if (!contactoSeleccionado) {
      return 'Seleccione un contacto para enviar el mensaje';
    }
    if (!contactoSeleccionado.celular) {
      return 'El contacto no tiene número de celular configurado';
    }
    const errCel = validarCelular(contactoSeleccionado.celular);
    if (errCel) return errCel;
    const errMen = validarMensajeWhatsapp(mensaje);
    if (errMen) return errMen;
    if (contienePatronPeligroso(mensaje)) {
      return 'El mensaje contiene contenido no permitido';
    }
    if (programar) {
      if (!fechaProgramada) return 'Seleccione fecha y hora para el envío programado';
      const fecha = new Date(fechaProgramada);
      if (isNaN(fecha.getTime())) return 'Fecha inválida';
      if (fecha <= new Date()) return 'La fecha programada debe ser futura';
    }
    return null;
  }

  async function handleEnviar() {
    if (enviando) return;
    setErrorForm(null);
    setInfoEnvio(null);

    const error = validarEnvio();
    if (error) {
      setErrorForm(error);
      return;
    }

    setEnviando(true);
    try {
      const numeroNormalizado = normalizarCelularPE(contactoSeleccionado.celular);
      const fechaProg = programar ? new Date(fechaProgramada) : null;

      // Si es envío inmediato, abrir WhatsApp ahora
      if (!programar) {
        const resultado = abrirWhatsApp(contactoSeleccionado.celular, mensaje);
        if (!resultado.ok) {
          setErrorForm(resultado.error || 'No se pudo abrir WhatsApp');
          return;
        }
      }

      // Registrar en Firestore
      try {
        await registrarEnvioMensaje({
          usuarioId: currentUser.uid,
          usuarioNombre: responsable,
          clienteId: clienteSeleccionado.id,
          clienteNombre: clienteSeleccionado.razonSocial,
          contactoNombre: contactoSeleccionado.nombre,
          numeroDestino: numeroNormalizado,
          mensajeCompleto: mensaje,
          mensajePreview: mensaje,
          plantillaId: plantillaSeleccionada || null,
          programadoPara: fechaProg ? fechaProg.toISOString() : null
        });
      } catch (errRegistro) {
        if (programar) throw errRegistro;
        setErrorForm('WhatsApp se abrió, pero no se pudo guardar el historial. No repitas el envío por este aviso.');
      }
      try {
        await addLog({
          usuario: responsable,
          accion: programar ? 'programar_whatsapp' : 'envio_whatsapp',
          detalle: `${clienteSeleccionado.razonSocial} · ${numeroNormalizado}${programar ? ' · ' + formatearFechaHora(fechaProg.toISOString()) : ''}`
        });
      } catch (errLog) {
        console.warn('No se pudo registrar auditoría del envío:', errLog);
      }

      if (programar) {
        setInfoEnvio({
          tipo: 'success',
          texto: `Mensaje programado para ${formatearFechaHora(fechaProg.toISOString())}. Mantén Mensajería abierta y confirma el envío en WhatsApp. Si el navegador bloquea la ventana, usa «Abrir WhatsApp» en Programados.`
        });
        refrescarProgramados();
      } else {
        setInfoEnvio({
          tipo: 'success',
          texto: `WhatsApp abierto para ${contactoSeleccionado.nombre || clienteSeleccionado.razonSocial}. Complete el envío en la ventana de WhatsApp.`
        });
        cargarHistorial();
      }

      setMensaje('');
      setPlantillaSeleccionada('');
      setProgramar(false);
      setFechaProgramada('');
    } catch (err) {
      console.error('Error enviando WhatsApp:', err);
      setErrorForm('Error inesperado: ' + (err.message || err));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCancelarProgramado() {
    try {
      await cancelarEnvioProgramado(cancelarId);
      await addLog({
        usuario: responsable,
        accion: 'cancelar_whatsapp_programado',
        detalle: cancelarId
      });
      setMostrarConfirmCancelar(false);
      setCancelarId(null);
      refrescarProgramados();
    } catch (err) {
      console.error('Error cancelando envío programado:', err);
      setErrorForm('Error al cancelar envío: ' + err.message);
    }
  }

  async function abrirProgramado(envio) {
    const resultado = abrirWhatsApp(envio.numeroDestino, envio.mensajeCompleto || envio.mensajePreview);
    if (!resultado.ok) {
      setErrorForm(resultado.error);
      return;
    }
    try {
      await marcarComoEnviado(envio.id);
      await refrescarProgramados();
      await cargarHistorial();
    } catch {
      setErrorForm('WhatsApp se abrió, pero no se pudo actualizar el registro. Verifica el envío antes de volver a abrirlo.');
    }
  }

  function limpiarSeleccion() {
    setClienteSeleccionado(null);
    setContactoSeleccionado(null);
    setMensaje('');
    setPlantillaSeleccionada('');
    setProgramar(false);
    setFechaProgramada('');
    setErrorForm(null);
    setInfoEnvio(null);
    setMostrarListaClientes(true);
  }

  // Fecha mínima para datetime-local: ahora + 1 minuto
  const fechaMinima = useMemo(() => {
    const d = new Date(Date.now() + 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  if (loading) return <Loading message="Cargando clientes..." />;

  const caracteresRestantes = MAX_CARACTERES - mensaje.length;
  const enviosPendientesCount = enviosPendientes.length;

  return (
    <div className="pagina pagina-mensajeria">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Mensajería</h1>
          <p className="pagina-subtitle">
            Envío directo de WhatsApp a contactos de clientes · {clientes.length} clientes registrados
            {enviosPendientesCount > 0 && (
              <span className="badge-programados">
                <FiClock size={11} /> {enviosPendientesCount} programado{enviosPendientesCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {clienteSeleccionado && (
          <button className="btn-secundario" onClick={limpiarSeleccion}>
            <FiX size={16} /> Nueva conversación
          </button>
        )}
      </div>

      {/* Tabs */}
      {errorClientes && (
        <div className="mensaje-flash mensaje-error" role="alert">
          No se pudieron cargar los clientes: {errorClientes}
        </div>
      )}
      {tabActiva === 'programados' && errorForm && (
        <div className="mensaje-flash mensaje-error" role="alert">{errorForm}</div>
      )}
      <div className="mensajeria-tabs">
        <button
          className={`tab-btn ${tabActiva === 'composer' ? 'activa' : ''}`}
          onClick={() => setTabActiva('composer')}
        >
          <FiSend size={14} /> Enviar / Programar
        </button>
        <button
          className={`tab-btn ${tabActiva === 'programados' ? 'activa' : ''}`}
          onClick={() => setTabActiva('programados')}
        >
          <FiClock size={14} /> Programados
          {enviosPendientesCount > 0 && (
            <span className="tab-badge">{enviosPendientesCount}</span>
          )}
        </button>
      </div>
      {/* ── TAB: COMPOSER ── */}
      {tabActiva === 'composer' && (
        <div className="mensajeria-layout">
          {/* Panel izquierdo: lista de clientes */}
          <aside className={`mensajeria-sidebar ${!mostrarListaClientes ? 'oculto-en-mobile' : ''}`}>
            <div className="sidebar-busqueda">
              <FiSearch className="icono-busqueda" size={16} />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={terminoBusqueda}
                onChange={(e) => setTerminoBusqueda(e.target.value)}
              />
            </div>

            <div className="lista-clientes-mensajeria">
              {clientesFiltrados.length === 0 ? (
                <div className="estado-vacio">
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                clientesFiltrados.map(c => {
                  const contactos = obtenerContactosDeCliente(c);
                  const conCelular = contactos.some(ct => ct.celular);
                  return (
                    <button
                      key={c.id}
                      className={`item-cliente-msg ${clienteSeleccionado?.id === c.id ? 'seleccionado' : ''}`}
                      onClick={() => seleccionarCliente(c)}
                    >
                      <div className="item-cliente-icono">
                        <FiUsers size={14} />
                      </div>
                      <div className="item-cliente-info">
                        <span className="item-cliente-nombre">{c.razonSocial}</span>
                        <span className="item-cliente-detalle">
                          {contactos.length} contacto{contactos.length !== 1 ? 's' : ''}
                          {conCelular ? ' · WhatsApp disponible' : ' · sin celular'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Panel central: composer */}
          <section className={`mensajeria-composer ${mostrarListaClientes ? 'oculto-en-mobile' : ''}`}>
            {!clienteSeleccionado ? (
              <div className="composer-vacio">
                <FiMessageCircle size={48} />
                <h3>Seleccione un cliente</h3>
                <p>Elija un cliente de la lista para iniciar o programar una conversación por WhatsApp</p>
              </div>
            ) : (
              <>
                <div className="composer-header">
                  <div className="composer-cliente-info">
                    <h2>{clienteSeleccionado.razonSocial}</h2>
                    <span className="composer-cliente-ruc">RUC: {clienteSeleccionado.ruc}</span>
                  </div>
                  <button
                    className="btn-secundario btn-pequeno"
                    onClick={() => setMostrarListaClientes(true)}
                    title="Cambiar cliente"
                  >
                    <FiSearch size={14} /> Cambiar
                  </button>
                </div>

                <div className="composer-seccion">
                  <label className="composer-label">
                    <FiUser size={14} /> Contacto destinatario
                  </label>
                  {contactosActuales.length === 0 ? (
                    <div className="contacto-no-disponible">
                      Este cliente no tiene contactos registrados. Agregue contactos desde la sección Clientes.
                    </div>
                  ) : (
                    <div className="lista-contactos-composer">
                      {contactosActuales.map((ct, idx) => {
                        const errCel = ct.celular ? validarCelular(ct.celular) : 'Sin celular';
                        const seleccionado = contactoSeleccionado?.celular === ct.celular
                          && contactoSeleccionado?.nombre === ct.nombre;
                        return (
                          <button
                            key={idx}
                            className={`contacto-chip ${seleccionado ? 'seleccionado' : ''} ${errCel ? 'invalido' : ''}`}
                            onClick={() => seleccionarContacto(ct)}
                            aria-pressed={seleccionado}
                            title={errCel ? `Inválido: ${errCel}` : 'Seleccionar contacto'}
                          >
                            <div className="contacto-chip-info">
                              <span className="contacto-chip-nombre">{ct.nombre || 'Sin nombre'}</span>
                              <span className="contacto-chip-celular">{ct.celular || 'Sin celular'}</span>
                              {errCel && <span>{errCel}. Actualiza el contacto en Clientes.</span>}
                            </div>
                            {ct.email && <span className="contacto-chip-email">{ct.email}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="composer-seccion">
                  <label className="composer-label">
                    <FiChevronDown size={14} /> Plantilla de mensaje (opcional)
                  </label>
                  <select
                    className="selector-orden"
                    value={plantillaSeleccionada}
                    onChange={(e) => aplicarPlantilla(e.target.value)}
                  >
                    <option value="">— Escribir mensaje personalizado —</option>
                    {PLANTILLAS_WHATSAPP.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="composer-seccion">
                  <label className="composer-label">
                    <FiMessageCircle size={14} /> Mensaje
                  </label>
                  <textarea
                    className="composer-textarea"
                    value={mensaje}
                    onChange={(e) => {
                      setMensaje(e.target.value.slice(0, MAX_CARACTERES));
                      setErrorForm(null);
                      setInfoEnvio(null);
                    }}
                    placeholder="Escriba aquí el mensaje que se enviará por WhatsApp..."
                    rows={6}
                    maxLength={MAX_CARACTERES}
                  />
                  <div className="composer-contador">
                    <span className={caracteresRestantes < 200 ? 'contador-cercano' : ''}>
                      {mensaje.length} / {MAX_CARACTERES} caracteres
                    </span>
                    {caracteresRestantes < 200 && (
                      <span className="contador-aviso">Acercándose al límite</span>
                    )}
                  </div>
                </div>

                {/* Opción de programación */}
                <div className="composer-seccion composer-programar">
                  <label className="programar-toggle">
                    <input
                      type="checkbox"
                      checked={programar}
                      onChange={(e) => {
                        setProgramar(e.target.checked);
                        if (!e.target.checked) setFechaProgramada('');
                      }}
                    />
                    <FiCalendar size={14} />
                    <span>Programar apertura de WhatsApp</span>
                  </label>
                  {programar && (
                    <div className="programar-config">
                      <label className="composer-label">Fecha y hora de envío</label>
                      <input
                        type="datetime-local"
                        className="programar-datetime"
                        value={fechaProgramada}
                        min={fechaMinima}
                        onChange={(e) => setFechaProgramada(e.target.value)}
                      />
                      <span className="pista-form">
                        Mantén Mensajería abierta y permite ventanas emergentes.
                        Confirma el envío en WhatsApp; si no se abre, usa «Abrir WhatsApp» en Programados.
                      </span>
                    </div>
                  )}
                </div>

                {errorForm && (
                  <div className="mensaje-flash mensaje-error mensaje-flash-mejorado" role="alert">
                    <span className="mensaje-flash-icono"><FiAlertCircle /></span>
                    <span className="mensaje-flash-texto">{errorForm}</span>
                    <button className="mensaje-flash-cerrar" onClick={() => setErrorForm(null)}>
                      <FiX size={14} />
                    </button>
                  </div>
                )}

                {infoEnvio && (
                  <div className="mensaje-flash mensaje-success mensaje-flash-mejorado">
                    <span className="mensaje-flash-icono"><FiCheckCircle /></span>
                    <span className="mensaje-flash-texto">{infoEnvio.texto}</span>
                    <button className="mensaje-flash-cerrar" onClick={() => setInfoEnvio(null)}>
                      <FiX size={14} />
                    </button>
                  </div>
                )}

                <div className="composer-acciones">
                  <button
                    className="btn-principal btn-enviar-whatsapp"
                    onClick={handleEnviar}
                    disabled={enviando}
                  >
                    <FiSend size={16} />
                    {enviando
                      ? (programar ? 'Programando...' : 'Abriendo WhatsApp...')
                      : (programar ? 'Programar envío' : 'Enviar por WhatsApp')
                    }
                  </button>
                  <span className="composer-destino-preview">
                    {contactoSeleccionado
                      ? `→ ${contactoSeleccionado.celular}`
                      : 'Seleccione un contacto'}
                  </span>
                </div>
              </>
            )}
          </section>

          {/* Panel derecho: historial */}
          <aside className="mensajeria-historial">
            <div className="historial-header">
              <FiClock size={14} />
              <span>Envíos recientes</span>
            </div>
            <div className="historial-lista">
              {cargandoHistorial ? (
                <Loading message="Cargando..." />
              ) : historial.length === 0 ? (
                <div className="historial-vacio">
                  <FiMessageCircle size={28} />
                  <p>No hay envíos registrados</p>
                </div>
              ) : (
                historial.map(h => (
                  <div key={h.id} className="historial-item">
                    <div className="historial-item-header">
                      <span className="historial-cliente">{h.clienteNombre || '—'}</span>
                      <span className="historial-fecha">{h.fecha} {h.hora}</span>
                    </div>
                    <div className="historial-item-detalle">
                      <FiUser size={11} /> {h.contactoNombre || '—'}
                      <span className="historial-numero">{h.numeroDestino}</span>
                    </div>
                    {h.mensajePreview && (
                      <p className="historial-preview">"{h.mensajePreview}"</p>
                    )}
                    <div className="historial-item-footer">
                      <span className="historial-usuario">por {h.usuarioNombre}</span>
                      {h.estado === 'pendiente' && (
                        <span className="historial-estado historial-estado-pendiente">
                          <FiClock size={10} /> Programado
                        </span>
                      )}
                      {h.estado === 'enviado' && (
                        <span className="historial-estado historial-estado-enviado">
                          <FiCheckCircle size={10} /> Enviado
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── TAB: PROGRAMADOS ── */}
      {tabActiva === 'programados' && (
        <div className="programados-tabla">
          <div className="programados-header-info">
            <h2>Envíos programados pendientes</h2>
            <p>Se intentará abrir WhatsApp a la hora indicada mientras Mensajería esté abierta. Confirma el envío allí. Si la ventana se bloquea, ábrela con el botón de la fila.</p>
          </div>

          {enviosPendientes.length === 0 ? (
            <div className="estado-vacio">
              <FiCalendar size={48} />
              <p>No tienes envíos programados</p>
              <p className="pista">Programa un envío desde la pestaña "Enviar / Programar"</p>
            </div>
          ) : (
            <div className="tarjeta-tabla">
              <div className="tabla-contenedor">
                <table className="tabla-datos">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Contacto</th>
                      <th>Número</th>
                      <th>Programado para</th>
                      <th>Mensaje</th>
                      <th className="texto-centro">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enviosPendientes.map(e => {
                      const fechaProg = new Date(e.programadoPara);
                      const vencido = fechaProg <= new Date();
                      return (
                        <tr key={e.id} className={vencido ? 'fila-vencida' : ''}>
                          <td className="texto-negrita">{e.clienteNombre}</td>
                          <td>{e.contactoNombre || '—'}</td>
                          <td className="texto-codigo">{e.numeroDestino}</td>
                          <td>
                            <div className="programado-fecha">
                              <FiClock size={12} />
                              <span>{formatearFechaHora(e.programadoPara)}</span>
                              {vencido && <span className="programado-vencido">(listo para abrir)</span>}
                            </div>
                          </td>
                          <td className="texto-truncado">{e.mensajePreview}</td>
                          <td className="texto-centro">
                            <button
                              className="btn-secundario btn-pequeno"
                              onClick={() => abrirProgramado(e)}
                              title="Abrir WhatsApp y confirmar el envío allí"
                            >
                              <FiSend size={14} /> Abrir WhatsApp
                            </button>
                            <button
                              className="btn-accion btn-eliminar"
                              onClick={() => {
                                setCancelarId(e.id);
                                setMostrarConfirmCancelar(true);
                              }}
                              title="Cancelar envío programado"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={mostrarConfirmCancelar}
        onClose={() => {
          setMostrarConfirmCancelar(false);
          setCancelarId(null);
        }}
        onConfirm={confirmarCancelarProgramado}
        title="¿Cancelar envío programado?"
        message="El envío programado será eliminado. Esta acción no se puede deshacer."
      />
    </div>
  );
}
