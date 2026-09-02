import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiHome, FiCreditCard, FiHash, FiShield, FiUsers, FiX, FiPlus, FiCheck, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { getLogs } from '../services/logService';
import { normalizarRol, tienePermiso } from '../services/userService';
import Usuarios from './Usuarios';
import Modal from '../components/Modal';
import Loading from '../components/Loading';
import Paginacion from '../components/Paginacion';
import '../styles/shared.css';
import './Configuracion.css';

export default function Configuracion() {
  const { config, loadingConfig, updateConfig } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userProfile } = useAuth();
  const [configLocal, setConfigLocal] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState(() => searchParams.get('tab') || 'empresa');
  const [logs, setLogs] = useState([]);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  // Modal para agregar condición de pago (reemplaza al prompt nativo)
  const [modalCondicionAbierto, setModalCondicionAbierto] = useState(false);
  const [nuevaCondicion, setNuevaCondicion] = useState('');
  const [errorCondicion, setErrorCondicion] = useState('');

  const [paginaLogs, setPaginaLogs] = useState(1);
  const [porPaginaLogs, setPorPaginaLogs] = useState(10);

  const rolActual = normalizarRol(userProfile?.role);
  const esAdmin = rolActual === 'administrador' || rolActual === 'gerencia';
  const puedeConfigurarSistema = esAdmin || tienePermiso(userProfile, 'configuracion');
  const puedeGestionarUsuarios = esAdmin || tienePermiso(userProfile, 'usuarios');

  useEffect(() => {
    if (config) setConfigLocal(config);
  }, [config]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['empresa', 'pagos', 'correlativo', 'usuarios', 'logs'].includes(tab)) {
      setPestanaActiva(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (pestanaActiva === 'logs') cargarLogs();
  }, [pestanaActiva]);

  async function cargarLogs() {
    setCargandoLogs(true);
    setPaginaLogs(1);
    try {
      const data = await getLogs(200);
      setLogs(data);
    } catch (err) {
      console.error('Error cargando logs:', err);
    } finally {
      setCargandoLogs(false);
    }
  }

  const logsPaginados = useMemo(() => {
    const inicio = (paginaLogs - 1) * porPaginaLogs;
    return logs.slice(inicio, inicio + porPaginaLogs);
  }, [logs, paginaLogs, porPaginaLogs]);

  async function guardarConfig() {
    setGuardando(true);
    setMensaje(null);
    try {
      await updateConfig(configLocal);
      setMensaje({ tipo: 'success', texto: 'Configuración guardada correctamente' });
      if (window._configMsgTimeout) clearTimeout(window._configMsgTimeout);
      window._configMsgTimeout = setTimeout(() => setMensaje(null), 5000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      const detalle = err?.code === 'permission-denied'
        ? 'No tiene permisos. Verifique que las reglas de Firestore estén publicadas.'
        : 'Error al guardar configuración';
      setMensaje({ tipo: 'error', texto: detalle });
      if (window._configMsgTimeout) clearTimeout(window._configMsgTimeout);
      window._configMsgTimeout = setTimeout(() => setMensaje(null), 8000);
    } finally {
      setGuardando(false);
    }
  }

  function cerrarMensaje() {
    if (window._configMsgTimeout) clearTimeout(window._configMsgTimeout);
    setMensaje(null);
  }

  function actualizarCotizacion(campo, valor) {
    setConfigLocal((prev) => ({
      ...prev,
      cotizacion: { ...prev.cotizacion, [campo]: valor }
    }));
  }

  function actualizarOrdenCompra(campo, valor) {
    setConfigLocal((prev) => ({
      ...prev,
      ordenCompra: { ...prev.ordenCompra, [campo]: valor }
    }));
  }

  // Los datos de la empresa son fijos y de solo lectura; solo el lema anual
  // es editable. El contacto del PDF se toma del perfil del usuario.
  function actualizarEmpresa(campo, valor) {
    setConfigLocal((prev) => ({
      ...prev,
      empresa: { ...(prev.empresa || {}), [campo]: valor }
    }));
  }

  function abrirModalCondicion() {
    setNuevaCondicion('');
    setErrorCondicion('');
    setModalCondicionAbierto(true);
  }

  function cerrarModalCondicion() {
    setModalCondicionAbierto(false);
    setNuevaCondicion('');
    setErrorCondicion('');
  }

  function confirmarAgregarCondicion() {
    const valor = nuevaCondicion.trim();
    if (!valor) {
      setErrorCondicion('La condición no puede estar vacía');
      return;
    }
    const existentes = configLocal.condicionesPago || [];
    if (existentes.some(c => c.toLowerCase() === valor.toLowerCase())) {
      setErrorCondicion('Esa condición ya existe');
      return;
    }
    setConfigLocal((prev) => ({
      ...prev,
      condicionesPago: [...(prev.condicionesPago || []), valor]
    }));
    cerrarModalCondicion();
  }

  function quitarCondicionPago(index) {
    setConfigLocal((prev) => ({
      ...prev,
      condicionesPago: (prev.condicionesPago || []).filter((_, i) => i !== index)
    }));
  }

  const pestanas = [];

  if (puedeConfigurarSistema) {
    pestanas.push(
      { id: 'empresa', label: 'Empresa', icon: <FiHome /> },
      { id: 'pagos', label: 'Condiciones', icon: <FiCreditCard /> },
      { id: 'correlativo', label: 'Correlativos', icon: <FiHash /> }
    );
  }

  if (puedeGestionarUsuarios) {
    pestanas.push({ id: 'usuarios', label: 'Usuarios y Roles', icon: <FiUsers /> });
  }

  if (esAdmin) {
    pestanas.push({ id: 'logs', label: 'Auditoría', icon: <FiShield /> });
  }

  useEffect(() => {
    if (pestanas.length > 0 && !pestanas.some((tab) => tab.id === pestanaActiva)) {
      const primera = pestanas[0].id;
      setPestanaActiva(primera);
      setSearchParams(primera === 'empresa' ? {} : { tab: primera }, { replace: true });
    }
  }, [pestanaActiva, puedeConfigurarSistema, puedeGestionarUsuarios, esAdmin]);

  if (loadingConfig) return <Loading message="Cargando configuración..." />;
  if (!configLocal) return <div className="estado-vacio"><p>Error al cargar la configuración</p></div>;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Configuración</h1>
          <p className="pagina-subtitle">Administre la configuración del sistema</p>
        </div>
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

      <div className="config-layout">
        <div className="config-tabs">
          {pestanas.map((tab) => (
            <button
              key={tab.id}
              className={`config-tab ${pestanaActiva === tab.id ? 'config-tab-activa' : ''}`}
              onClick={() => {
                setPestanaActiva(tab.id);
                setSearchParams(tab.id === 'empresa' ? {} : { tab: tab.id }, { replace: true });
              }}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="config-contenido">
          {pestanaActiva === 'empresa' && (
            <div className="config-seccion">
              <h2 className="seccion-titulo">Información de la Empresa</h2>
              <p className="seccion-pista">
                Los datos de la empresa (razón social, RUC, dirección y teléfono) son fijos
                y de solo lectura. Solo el lema anual es editable.
                El contacto, cargo y correo electrónico del PDF se toman del perfil del
                usuario que genera la cotización. El correo de acceso al ERP se cambia
                desde Mi Perfil.
              </p>
              <div className="formulario">
                <div className="campo">
                  <label>Razón Social</label>
                  <input
                    type="text"
                    value={configLocal.empresa?.razonSocial || ''}
                    readOnly
                    className="input-solo-lectura"
                  />
                </div>
                <div className="fila-form">
                  <div className="campo">
                    <label>RUC</label>
                    <input
                      type="text"
                      value={configLocal.empresa?.ruc || ''}
                      readOnly
                      className="input-solo-lectura"
                    />
                  </div>
                  <div className="campo">
                    <label>Teléfono / Celular</label>
                    <input
                      type="text"
                      value={configLocal.empresa?.celular || ''}
                      readOnly
                      className="input-solo-lectura"
                    />
                  </div>
                </div>
                <div className="campo">
                  <label>Dirección</label>
                  <input
                    type="text"
                    value={configLocal.empresa?.direccion || ''}
                    readOnly
                    className="input-solo-lectura"
                  />
                </div>
                <div className="campo">
                  <label>Lema Anual</label>
                  <input
                    type="text"
                    value={configLocal.empresa?.lemaAnual || ''}
                    onChange={(e) => actualizarEmpresa('lemaAnual', e.target.value)}
                    placeholder="Lema oficial del año"
                  />
                </div>
              </div>
              <div className="config-guardar">
                <button className="btn-principal" onClick={guardarConfig} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          )}

          {pestanaActiva === 'pagos' && (
            <div className="config-seccion">
              <div className="seccion-header">
                <h2 className="seccion-titulo">Condiciones de Pago</h2>
                <button className="btn-secundario btn-pequeno" onClick={abrirModalCondicion}>
                  <FiPlus size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Agregar
                </button>
              </div>
              <div className="condiciones-lista">
                {(configLocal.condicionesPago || []).map((cond, index) => (
                  <div key={index} className="condicion-item">
                    <span className="condicion-texto">{cond}</span>
                    <button
                      className="btn-quitar-condicion"
                      onClick={() => quitarCondicionPago(index)}
                      title="Eliminar"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
                {(configLocal.condicionesPago || []).length === 0 && (
                  <div className="estado-vacio"><p>No hay condiciones de pago configuradas</p></div>
                )}
              </div>
              <div className="config-guardar">
                <button className="btn-principal" onClick={guardarConfig} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          )}

          {pestanaActiva === 'correlativo' && (
            <div className="config-seccion">
              <h2 className="seccion-titulo">Correlativos de documentos</h2>
              <p className="seccion-pista">
                Configure el <strong>prefijo</strong> y el <strong>próximo número</strong> que se
                usará al crear la siguiente cotización. El sistema <strong>auto-incrementa</strong>
                este número automáticamente al crear cada cotización — solo necesitas modificarlo
                cuando quieras saltar a un número específico (ej: 1004321) o reiniciar el correlativo.
              </p>
              <div className="formulario">
                <h3 className="config-subtitulo">Cotizaciones</h3>
                <div className="fila-form">
                  <div className="campo">
                    <label>Prefijo</label>
                    <input
                      type="text"
                      value={configLocal.cotizacion?.prefijo || 'NV'}
                      onChange={(e) => actualizarCotizacion('prefijo', e.target.value)}
                      placeholder="NV"
                    />
                  </div>
                  <div className="campo">
                    <label>Próximo número *</label>
                    <input
                      type="number"
                      value={configLocal.cotizacion?.proximoNumero || 1000001}
                      onChange={(e) => actualizarCotizacion('proximoNumero', Number(e.target.value))}
                      placeholder="1004321"
                      min="1"
                    />
                    <span className="pista-form">
                      Número que se usará en la próxima cotización. Se auto-incrementa al crear.
                    </span>
                  </div>
                </div>
                <div className="campo">
                  <label>Último Correlativo Generado</label>
                  <input
                    type="text"
                    value={configLocal.cotizacion?.ultimoCorrelativo || 'NV1000000'}
                    className="input-solo-lectura"
                    readOnly
                  />
                  <span className="pista-form">Se actualiza automáticamente al crear cotizaciones</span>
                </div>
                <div className="correlativo-preview">
                  <span className="preview-label">Próximo código que se generará:</span>
                  <span className="preview-value">
                    {configLocal.cotizacion?.prefijo || 'NV'}
                    {(configLocal.cotizacion?.proximoNumero || 1000001).toString().padStart(7, '0')}
                  </span>
                </div>
                <div className="config-separador" />
                <h3 className="config-subtitulo">Órdenes de compra</h3>
                <p className="seccion-pista">
                  El formato oficial usa el patrón <strong>OC100110</strong>: prefijo OC y seis dígitos.
                  El número se reserva únicamente al guardar la orden y la Cloud Function lo incrementa
                  dentro de una transacción para evitar duplicados entre usuarios.
                </p>
                <div className="fila-form">
                  <div className="campo">
                    <label>Prefijo OC</label>
                    <input
                      type="text"
                      value={configLocal.ordenCompra?.prefijo || 'OC'}
                      onChange={(e) => actualizarOrdenCompra('prefijo', e.target.value.toUpperCase())}
                      maxLength="8"
                    />
                  </div>
                  <div className="campo">
                    <label>Próximo número OC *</label>
                    <input
                      type="number"
                      min="1"
                      value={configLocal.ordenCompra?.proximoNumero || 100111}
                      onChange={(e) => actualizarOrdenCompra('proximoNumero', Math.max(1, Number(e.target.value)))}
                    />
                    <span className="pista-form">Se asigna al guardar, nunca al abrir el formulario.</span>
                  </div>
                </div>
                <div className="campo">
                  <label>Última OC generada</label>
                  <input value={configLocal.ordenCompra?.ultimoCorrelativo || 'OC100110'} readOnly className="input-solo-lectura" />
                </div>
                <div className="correlativo-preview">
                  <span className="preview-label">Próxima OC:</span>
                  <span className="preview-value">
                    {configLocal.ordenCompra?.prefijo || 'OC'}
                    {String(configLocal.ordenCompra?.proximoNumero || 100111).padStart(configLocal.ordenCompra?.longitud || 6, '0')}
                  </span>
                </div>
                <div className="fila-form">
                  <div className="campo"><label>Autorizado por</label><input value={configLocal.ordenCompra?.autorizadoPor || ''} onChange={(e) => actualizarOrdenCompra('autorizadoPor', e.target.value)} placeholder="Nombre que figura en la firma" /></div>
                  <div className="campo"><label>Cargo del autorizador</label><input value={configLocal.ordenCompra?.cargoAutorizador || ''} onChange={(e) => actualizarOrdenCompra('cargoAutorizador', e.target.value)} /></div>
                </div>
              </div>
              <div className="config-guardar">
                <button className="btn-principal" onClick={guardarConfig} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          )}

          {pestanaActiva === 'usuarios' && puedeGestionarUsuarios && (
            <div className="config-seccion config-seccion-usuarios">
              <Usuarios embebido />
            </div>
          )}

          {pestanaActiva === 'logs' && esAdmin && (
            <div className="config-seccion">
              <div className="seccion-header">
                <h2 className="seccion-titulo">Registro de Auditoría</h2>
                <button className="btn-secundario btn-pequeno" onClick={cargarLogs}>
                  Actualizar
                </button>
              </div>
              {cargandoLogs ? (
                <p className="texto-cargando">Cargando registros...</p>
              ) : logs.length === 0 ? (
                <div className="estado-vacio"><p>No hay registros de auditoría</p></div>
              ) : (
                <>
                  <Paginacion
                    total={logs.length}
                    paginaActual={paginaLogs}
                    porPagina={porPaginaLogs}
                    onCambiarPagina={setPaginaLogs}
                    onCambiarPorPagina={setPorPaginaLogs}
                  />
                  <div className="tabla-contenedor">
                    <table className="tabla-datos">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Usuario</th>
                          <th>Acción</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsPaginados.map((log) => (
                          <tr key={log.id}>
                            <td>{log.fecha}</td>
                            <td>{log.hora}</td>
                            <td className="texto-negrita">{log.usuario}</td>
                            <td><span className="badge-accion">{log.accion}</span></td>
                            <td className="texto-truncado">{log.detalle || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para agregar nueva condición de pago */}
      <Modal
        isOpen={modalCondicionAbierto}
        onClose={cerrarModalCondicion}
        title="Nueva condición de pago"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); confirmarAgregarCondicion(); }}
          className="formulario"
        >
          <div className="campo">
            <label>Descripción de la condición *</label>
            <input
              type="text"
              value={nuevaCondicion}
              onChange={(e) => { setNuevaCondicion(e.target.value); setErrorCondicion(''); }}
              placeholder="Ej: 30 días, Crédito 60 días, etc."
              autoFocus
              className={errorCondicion ? 'input-error' : ''}
            />
            {errorCondicion && <span className="mensaje-error">{errorCondicion}</span>}
          </div>
          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={cerrarModalCondicion}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal">
              <FiCheck size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Agregar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
