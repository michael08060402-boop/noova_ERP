import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FiMessageCircle, FiSearch, FiSend, FiUser, FiClock,
  FiAlertCircle, FiCheckCircle, FiX, FiChevronDown, FiUsers,
  FiMail, FiTrash2
} from 'react-icons/fi';
import { useClientes } from '../hooks/useClientes';
import { useAuth } from '../context/AuthContext';
import { addLog } from '../services/logService';
import { puede } from '../services/accessControl';
import {
  registrarEnvioMensaje,
  getHistorialMensajes,
  limpiarHistorialMensajes
} from '../services/mensajeriaService';
import {
  abrirWhatsApp,
  PLANTILLAS_WHATSAPP,
  rellenarPlantilla
} from '../utils/whatsapp';
import {
  validarMensajeWhatsapp,
  validarCelular,
  validarEmail,
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
      celular: String(contacto.celular || contacto.telefono || '').trim(),
      email: String(contacto.email || '').trim()
    }));
  }
  if (cliente.contacto || cliente.email || cliente.telefono || cliente.celular) {
    return [{
      nombre: cliente.contacto || '',
      celular: String(cliente.telefono || cliente.celular || '').trim(),
      email: String(cliente.email || '').trim()
    }];
  }
  return [];
}

export default function Mensajeria() {
  const { clientes, loading, error: errorClientes } = useClientes();
  const { currentUser, userProfile } = useAuth();

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [contactoSeleccionado, setContactoSeleccionado] = useState(null);

  const [mensaje, setMensaje] = useState('');
  const [asunto, setAsunto] = useState('');
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [errorForm, setErrorForm] = useState(null);
  const [infoEnvio, setInfoEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const [mostrarConfirmLimpiar, setMostrarConfirmLimpiar] = useState(false);
  const [limpiandoHistorial, setLimpiandoHistorial] = useState(false);
  const [avisoHistorial, setAvisoHistorial] = useState(null);

  const [mostrarListaClientes, setMostrarListaClientes] = useState(true);

  const responsable = userProfile?.nombre || currentUser?.email || '';
  const puedeLimpiar = puede(userProfile, 'mensajeria', 'delete');

  // Carga historial
  const cargarHistorial = useCallback(async () => {
    try {
      setCargandoHistorial(true);
      const data = await getHistorialMensajes(50);
      setHistorial(data);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setAvisoHistorial({ tipo: 'error', texto: 'No se pudo cargar el historial. Vuelve a intentarlo.' });
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const clientesFiltrados = useMemo(() => {
    if (!terminoBusqueda.trim()) return clientes;
    const term = terminoBusqueda.toLowerCase();
    return clientes.filter(c =>
      c.razonSocial?.toLowerCase().includes(term) ||
      c.ruc?.toLowerCase().includes(term) ||
      obtenerContactosDeCliente(c).some(ct =>
        ct.nombre?.toLowerCase().includes(term) ||
        String(ct.celular || '').toLowerCase().includes(term) ||
        String(ct.email || '').toLowerCase().includes(term)
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
      .filter(contacto => (contacto.celular && !validarCelular(contacto.celular))
        || (contacto.email && !validarEmail(contacto.email)));
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

  function validarEnvio(canal) {
    if (!contactoSeleccionado) {
      return 'Seleccione un contacto para enviar el mensaje';
    }
    if (canal === 'correo') {
      if (!contactoSeleccionado.email) return 'El contacto no tiene correo configurado. Actualízalo en Clientes.';
      const errEmail = validarEmail(contactoSeleccionado.email);
      if (errEmail) return errEmail;
      if (!asunto.trim()) return 'Escribe un asunto para el correo';
    } else {
      if (!contactoSeleccionado.celular) return 'El contacto no tiene número de celular configurado';
      const errCel = validarCelular(contactoSeleccionado.celular);
      if (errCel) return errCel;
    }
    const errMen = validarMensajeWhatsapp(mensaje);
    if (errMen) return errMen;
    if (contienePatronPeligroso(mensaje)) {
      return 'El mensaje contiene contenido no permitido';
    }
    return null;
  }

  async function handleEnviar(canal = 'whatsapp') {
    if (enviando || limpiandoHistorial) return;
    setErrorForm(null);
    setInfoEnvio(null);

    const error = validarEnvio(canal);
    if (error) {
      setErrorForm(error);
      return;
    }

    setEnviando(true);
    try {
      const esCorreo = canal === 'correo';
      const destino = esCorreo ? contactoSeleccionado.email.trim() : normalizarCelularPE(contactoSeleccionado.celular);

      // Abrir el editor dentro del gesto de usuario, antes de guardar el registro.
      if (esCorreo) {
        const link = document.createElement('a');
        const asuntoSeguro = asunto.replace(/[\r\n]/g, ' ').trim();
        link.href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(asuntoSeguro)}&body=${encodeURIComponent(mensaje)}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
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
          numeroDestino: esCorreo ? '' : destino,
          correoDestino: esCorreo ? destino : '',
          canal,
          asunto: esCorreo ? asunto : '',
          mensajeCompleto: mensaje,
          mensajePreview: mensaje,
          plantillaId: plantillaSeleccionada || null
        });
      } catch (errRegistro) {
        console.warn('No se pudo guardar el historial:', errRegistro);
        setErrorForm('Se solicitó abrir el mensaje, pero no se pudo guardar el historial. No repitas el envío por este aviso.');
      }
      try {
        await addLog({
          usuario: responsable,
          accion: esCorreo ? 'abrir_correo' : 'envio_whatsapp',
          detalle: `${clienteSeleccionado.razonSocial} · ${destino}`
        });
      } catch (errLog) {
        console.warn('No se pudo registrar auditoría del envío:', errLog);
      }

      setInfoEnvio({
        tipo: 'success',
        texto: esCorreo
          ? 'Se solicitó abrir tu aplicación de correo. Confirma el envío allí. Si no se abre, configura una aplicación de correo predeterminada; el ERP no ha enviado el correo.'
          : `WhatsApp abierto para ${contactoSeleccionado.nombre || clienteSeleccionado.razonSocial}. Complete el envío en la ventana de WhatsApp.`
      });
      cargarHistorial();

      if (!esCorreo) {
        setMensaje('');
        setPlantillaSeleccionada('');
      }
    } catch (err) {
      console.error('Error abriendo mensaje:', err);
      setErrorForm('Error inesperado: ' + (err.message || err));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarLimpiarHistorial() {
    if (!puedeLimpiar || limpiandoHistorial || enviando) return;
    setMostrarConfirmLimpiar(false);
    setLimpiandoHistorial(true);
    setAvisoHistorial(null);
    try {
      const eliminados = await limpiarHistorialMensajes();
      setAvisoHistorial({ tipo: 'success', texto: `Historial limpiado: ${eliminados} registros eliminados del ERP.` });
      try {
        await addLog({ usuario: responsable, accion: 'limpiar_historial_mensajeria', detalle: `${eliminados} registros eliminados` });
      } catch (errLog) {
        console.warn('Historial limpiado, sin registro de auditoría:', errLog);
      }
    } catch (err) {
      console.error('Error limpiando historial:', err);
      setAvisoHistorial({ tipo: 'error', texto: `No se pudo completar la limpieza. Se eliminaron ${err.eliminados || 0} registros; vuelve a intentarlo para los restantes.` });
    } finally {
      await cargarHistorial();
      setLimpiandoHistorial(false);
    }
  }

  function limpiarSeleccion() {
    setClienteSeleccionado(null);
    setContactoSeleccionado(null);
    setMensaje('');
    setAsunto('');
    setPlantillaSeleccionada('');
    setErrorForm(null);
    setInfoEnvio(null);
    setMostrarListaClientes(true);
  }

  if (loading) return <Loading message="Cargando clientes..." />;

  const caracteresRestantes = MAX_CARACTERES - mensaje.length;

  return (
    <div className="pagina pagina-mensajeria">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Mensajería</h1>
          <p className="pagina-subtitle">
            WhatsApp y correo a contactos de clientes · {clientes.length} clientes registrados
          </p>
        </div>
        {clienteSeleccionado && (
          <button className="btn-secundario" onClick={limpiarSeleccion}>
            <FiX size={16} /> Nueva conversación
          </button>
        )}
      </div>

      {errorClientes && (
        <div className="mensaje-flash mensaje-error" role="alert">
          No se pudieron cargar los clientes: {errorClientes}
        </div>
      )}
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
                  const conCorreo = contactos.some(ct => ct.email);
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
                          {conCelular ? ' · WhatsApp' : ''}{conCorreo ? ' · Correo' : ''}
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
                <p>Elija un cliente de la lista para escribir por WhatsApp o correo</p>
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
                        const sinCanalValido = !(ct.celular && !validarCelular(ct.celular))
                          && !(ct.email && !validarEmail(ct.email));
                        const seleccionado = contactoSeleccionado?.celular === ct.celular
                          && contactoSeleccionado?.nombre === ct.nombre
                          && contactoSeleccionado?.email === ct.email;
                        return (
                          <button
                            key={idx}
                            className={`contacto-chip ${seleccionado ? 'seleccionado' : ''} ${sinCanalValido ? 'invalido' : ''}`}
                            onClick={() => seleccionarContacto(ct)}
                            aria-pressed={seleccionado}
                            title="Seleccionar contacto"
                          >
                            <div className="contacto-chip-info">
                              <span className="contacto-chip-nombre">{ct.nombre || 'Sin nombre'}</span>
                              <span className="contacto-chip-celular">{ct.celular || 'Sin celular'}</span>
                              {sinCanalValido && <span>Sin celular o correo válido. Actualiza el contacto en Clientes.</span>}
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
                  <label className="composer-label" htmlFor="mensajeria-asunto">
                    <FiMail size={14} /> Asunto (solo para correo)
                  </label>
                  <input
                    id="mensajeria-asunto"
                    className="composer-asunto"
                    value={asunto}
                    onChange={(e) => { setAsunto(e.target.value); setErrorForm(null); setInfoEnvio(null); }}
                    maxLength={160}
                    placeholder="Asunto del correo"
                  />
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
                    placeholder="Escriba el mensaje para WhatsApp o correo..."
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
                    onClick={() => handleEnviar('whatsapp')}
                    disabled={enviando || limpiandoHistorial}
                  >
                    <FiSend size={16} />
                    {enviando ? 'Abriendo...' : 'Enviar por WhatsApp'}
                  </button>
                  <button
                    className="btn-secundario"
                    onClick={() => handleEnviar('correo')}
                    disabled={enviando || limpiandoHistorial}
                  >
                    <FiMail size={16} /> Escribir por correo
                  </button>
                  <span className="composer-destino-preview">
                    {contactoSeleccionado
                      ? `→ ${[contactoSeleccionado.celular, contactoSeleccionado.email].filter(Boolean).join(' · ')}`
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
              <span>Historial compartido</span>
              {puedeLimpiar && (
                <button
                  className="btn-secundario btn-pequeno historial-limpiar"
                  onClick={() => setMostrarConfirmLimpiar(true)}
                  disabled={limpiandoHistorial || cargandoHistorial || enviando || historial.length === 0}
                >
                  <FiTrash2 size={14} /> {limpiandoHistorial ? 'Limpiando...' : 'Limpiar historial'}
                </button>
              )}
            </div>
            {avisoHistorial && (
              <div className={`historial-aviso historial-aviso-${avisoHistorial.tipo}`} role={avisoHistorial.tipo === 'error' ? 'alert' : 'status'}>
                {avisoHistorial.texto}
              </div>
            )}
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
                      <span className="historial-numero">{h.canal === 'correo' ? h.correoDestino : h.numeroDestino}</span>
                    </div>
                    {h.asunto && <strong className="historial-preview">{h.asunto}</strong>}
                    {h.mensajePreview && (
                      <p className="historial-preview">"{h.mensajePreview}"</p>
                    )}
                    <div className="historial-item-footer">
                      <span className="historial-usuario">por {h.usuarioNombre}</span>
                      {h.estado === 'pendiente' && (
                        <span className="historial-estado historial-estado-pendiente">
                          <FiClock size={10} /> Pendiente antiguo · sin ejecución
                        </span>
                      )}
                      {h.estado !== 'pendiente' && (
                        <span className="historial-estado historial-estado-enviado">
                          {h.canal === 'correo' ? <FiMail size={10} /> : <FiMessageCircle size={10} />}
                          {h.canal === 'correo' ? 'Correo solicitado' : 'WhatsApp abierto'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      <ConfirmDialog
        isOpen={mostrarConfirmLimpiar}
        onClose={() => setMostrarConfirmLimpiar(false)}
        onConfirm={confirmarLimpiarHistorial}
        title="¿Limpiar el historial compartido?"
        message="Se eliminarán todos los registros de Mensajería del ERP, incluidos los antiguos pendientes, para todos los usuarios. No se borran mensajes de WhatsApp ni correos. Esta acción no se puede deshacer."
      />
    </div>
  );
}
