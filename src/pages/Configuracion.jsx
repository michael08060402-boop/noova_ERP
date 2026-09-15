import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiHome,
  FiCreditCard,
  FiHash,
  FiShield,
  FiUsers,
  FiX,
  FiPlus,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { getLogs } from '../services/logService';
import {
  puedeConfiguracion,
  puedeEditarConfiguracion
} from '../services/userService';
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
  const [pestanaActiva, setPestanaActiva] = useState(
    () => searchParams.get('tab') || 'empresa'
  );

  const [logs, setLogs] = useState([]);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  const [modalCondicionAbierto, setModalCondicionAbierto] = useState(false);
  const [nuevaCondicion, setNuevaCondicion] = useState('');
  const [errorCondicion, setErrorCondicion] = useState('');

  const [paginaLogs, setPaginaLogs] = useState(1);
  const [porPaginaLogs, setPorPaginaLogs] = useState(10);

  const puedeEmpresa = puedeConfiguracion(userProfile, 'empresa');
  const puedePagos = puedeConfiguracion(userProfile, 'pagos');
  const puedeCorrelativo = puedeConfiguracion(userProfile, 'correlativo');
  const puedeUsuarios = puedeConfiguracion(userProfile, 'usuarios');
  const puedeLogs = puedeConfiguracion(userProfile, 'logs');

  const puedeEditarEmpresa = puedeEditarConfiguracion(userProfile, 'empresa');
  const puedeEditarPagos = puedeEditarConfiguracion(userProfile, 'pagos');
  const puedeEditarCorrelativo = puedeEditarConfiguracion(
    userProfile,
    'correlativo'
  );

  useEffect(() => {
    if (config) setConfigLocal(config);
  }, [config]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab
      && ['empresa', 'pagos', 'correlativo', 'usuarios', 'logs'].includes(tab)
    ) {
      setPestanaActiva(tab);
    }
  }, [searchParams]);

  const cargarLogs = useCallback(async () => {
    if (!puedeLogs) return;

    setCargandoLogs(true);
    setPaginaLogs(1);

    try {
      const data = await getLogs(200);
      setLogs(data);
    } catch (err) {
      console.error('Error cargando logs:', err);
      setMensaje({ tipo: 'error', texto: 'No se pudo actualizar el historial de auditoría. Intenta actualizar nuevamente.' });
    } finally {
      setCargandoLogs(false);
    }
  }, [puedeLogs]);

  useEffect(() => {
    if (pestanaActiva === 'logs' && puedeLogs) {
      cargarLogs();
    }
  }, [pestanaActiva, puedeLogs, cargarLogs]);

  const logsPaginados = useMemo(() => {
    const inicio = (paginaLogs - 1) * porPaginaLogs;
    return logs.slice(inicio, inicio + porPaginaLogs);
  }, [logs, paginaLogs, porPaginaLogs]);

  async function guardarConfig(seccion) {
    if (!puedeEditarConfiguracion(userProfile, seccion)) {
      setMensaje({
        tipo: 'error',
        texto: 'Tu rol no tiene permiso para modificar esta sección.'
      });
      return;
    }

    let payload;

    if (seccion === 'empresa') {
      payload = {
        empresa: configLocal.empresa
      };
    } else if (seccion === 'pagos') {
      payload = {
        condicionesPago: configLocal.condicionesPago,
        condicionesVenta: configLocal.condicionesVenta,
        cuentasBancarias: configLocal.cuentasBancarias
      };
    } else if (seccion === 'correlativo') {
      payload = {
        cotizacion: configLocal.cotizacion,
        ordenCompra: configLocal.ordenCompra
      };
    } else {
      setMensaje({
        tipo: 'error',
        texto: 'Esta sección no admite guardado general.'
      });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    try {
      // Se guarda únicamente la sección visible. Esto permite que Firestore
      // compruebe de verdad que Administrador solo modifica correlativos.
      await updateConfig(payload);

      setMensaje({
        tipo: 'success',
        texto: 'Configuración guardada correctamente'
      });

      if (window._configMsgTimeout) {
        clearTimeout(window._configMsgTimeout);
      }

      window._configMsgTimeout = setTimeout(
        () => setMensaje(null),
        5000
      );
    } catch (err) {
      console.error('Error guardando configuración:', err);

      const detalle = err?.code === 'permission-denied'
        ? 'Tu rol no tiene permiso para modificar esta sección.'
        : 'Error al guardar configuración';

      setMensaje({
        tipo: 'error',
        texto: detalle
      });

      if (window._configMsgTimeout) {
        clearTimeout(window._configMsgTimeout);
      }

      window._configMsgTimeout = setTimeout(
        () => setMensaje(null),
        8000
      );
    } finally {
      setGuardando(false);
    }
  }

  function cerrarMensaje() {
    if (window._configMsgTimeout) {
      clearTimeout(window._configMsgTimeout);
    }
    setMensaje(null);
  }

  function actualizarCotizacion(campo, valor) {
    if (!puedeEditarCorrelativo) return;

    setConfigLocal((prev) => ({
      ...prev,
      cotizacion: {
        ...prev.cotizacion,
        [campo]: valor
      }
    }));
  }

  function actualizarOrdenCompra(campo, valor) {
    if (!puedeEditarCorrelativo) return;

    setConfigLocal((prev) => ({
      ...prev,
      ordenCompra: {
        ...prev.ordenCompra,
        [campo]: valor
      }
    }));
  }

  function actualizarEmpresa(campo, valor) {
    if (!puedeEditarEmpresa) return;

    setConfigLocal((prev) => ({
      ...prev,
      empresa: {
        ...(prev.empresa || {}),
        [campo]: valor
      }
    }));
  }

  function abrirModalCondicion() {
    if (!puedeEditarPagos) return;

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
    if (!puedeEditarPagos) return;

    const valor = nuevaCondicion.trim();

    if (!valor) {
      setErrorCondicion('La condición no puede estar vacía');
      return;
    }

    const existentes = configLocal.condicionesPago || [];

    if (
      existentes.some(
        (condicion) => condicion.toLowerCase() === valor.toLowerCase()
      )
    ) {
      setErrorCondicion('Esa condición ya existe');
      return;
    }

    setConfigLocal((prev) => ({
      ...prev,
      condicionesPago: [
        ...(prev.condicionesPago || []),
        valor
      ]
    }));

    cerrarModalCondicion();
  }

  function quitarCondicionPago(index) {
    if (!puedeEditarPagos) return;

    setConfigLocal((prev) => ({
      ...prev,
      condicionesPago: (prev.condicionesPago || [])
        .filter((_, i) => i !== index)
    }));
  }

  const pestanas = useMemo(() => {
    const disponibles = [];

    if (puedeEmpresa) disponibles.push({ id: 'empresa', label: 'Empresa', icon: <FiHome /> });
    if (puedePagos) disponibles.push({ id: 'pagos', label: 'Condiciones', icon: <FiCreditCard /> });
    if (puedeCorrelativo) disponibles.push({ id: 'correlativo', label: 'Correlativos', icon: <FiHash /> });
    if (puedeUsuarios) disponibles.push({ id: 'usuarios', label: 'Usuarios y Roles', icon: <FiUsers /> });
    if (puedeLogs) disponibles.push({ id: 'logs', label: 'Auditoría', icon: <FiShield /> });

    return disponibles;
  }, [puedeEmpresa, puedePagos, puedeCorrelativo, puedeUsuarios, puedeLogs]);

  useEffect(() => {
    if (
      pestanas.length > 0
      && !pestanas.some((tab) => tab.id === pestanaActiva)
    ) {
      const primera = pestanas[0].id;
      setPestanaActiva(primera);

      setSearchParams(
        primera === 'empresa'
          ? {}
          : { tab: primera },
        { replace: true }
      );
    }
  }, [pestanaActiva, pestanas, setSearchParams]);

  if (loadingConfig) {
    return <Loading message="Cargando configuración..." />;
  }

  if (!configLocal) {
    return (
      <div className="estado-vacio">
        <p>Error al cargar la configuración</p>
      </div>
    );
  }

  if (pestanas.length === 0) {
    return (
      <div className="pagina">
        <div className="estado-vacio">
          <p>Tu rol no tiene secciones de Configuración habilitadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Configuración</h1>
          <p className="pagina-subtitle">
            Administre únicamente las secciones habilitadas para su rol
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`mensaje-flash mensaje-${mensaje.tipo} mensaje-flash-mejorado`}
        >
          <span className="mensaje-flash-icono">
            {mensaje.tipo === 'success'
              ? <FiCheckCircle size={18} />
              : <FiAlertCircle size={18} />}
          </span>

          <span className="mensaje-flash-texto">
            {mensaje.texto}
          </span>

          <button
            className="mensaje-flash-cerrar"
            onClick={cerrarMensaje}
            title="Cerrar"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      <div className="config-layout">
        <div className="config-tabs config-tabs-horizontal">
          {pestanas.map((tab) => (
            <button
              key={tab.id}
              className={`config-tab ${
                pestanaActiva === tab.id
                  ? 'config-tab-activa'
                  : ''
              }`}
              onClick={() => {
                setPestanaActiva(tab.id);
                setSearchParams(
                  tab.id === 'empresa'
                    ? {}
                    : { tab: tab.id },
                  { replace: true }
                );
              }}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="config-contenido">
          {pestanaActiva === 'empresa' && puedeEmpresa && (
            <div className="config-seccion">
              <h2 className="seccion-titulo">
                Información de la Empresa
              </h2>

              <p className="seccion-pista">
                Los datos de la empresa (razón social, RUC, dirección y
                teléfono) son fijos y de solo lectura. Solo el lema anual es
                editable. El contacto, cargo y correo electrónico del PDF se
                toman del perfil del usuario que genera la cotización.
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
                    onChange={(e) =>
                      actualizarEmpresa('lemaAnual', e.target.value)
                    }
                    placeholder="Lema oficial del año"
                    readOnly={!puedeEditarEmpresa}
                    className={
                      !puedeEditarEmpresa
                        ? 'input-solo-lectura'
                        : ''
                    }
                  />
                </div>
              </div>

              {puedeEditarEmpresa && (
                <div className="config-guardar">
                  <button
                    className="btn-principal"
                    onClick={() => guardarConfig('empresa')}
                    disabled={guardando}
                  >
                    {guardando
                      ? 'Guardando...'
                      : 'Guardar Configuración'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pestanaActiva === 'pagos' && puedePagos && (
            <div className="config-seccion">
              <div className="seccion-header">
                <h2 className="seccion-titulo">
                  Condiciones de Pago
                </h2>

                {puedeEditarPagos && (
                  <button
                    className="btn-secundario btn-pequeno"
                    onClick={abrirModalCondicion}
                  >
                    <FiPlus
                      size={14}
                      style={{
                        marginRight: 4,
                        verticalAlign: 'middle'
                      }}
                    />
                    Agregar
                  </button>
                )}
              </div>

              <div className="condiciones-lista">
                {(configLocal.condicionesPago || []).map(
                  (cond, index) => (
                    <div key={index} className="condicion-item">
                      <span className="condicion-texto">
                        {cond}
                      </span>

                      {puedeEditarPagos && (
                        <button
                          className="btn-quitar-condicion"
                          onClick={() => quitarCondicionPago(index)}
                          title="Eliminar"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                  )
                )}

                {(configLocal.condicionesPago || []).length === 0 && (
                  <div className="estado-vacio">
                    <p>No hay condiciones de pago configuradas</p>
                  </div>
                )}
              </div>

              {puedeEditarPagos && (
                <div className="config-guardar">
                  <button
                    className="btn-principal"
                    onClick={() => guardarConfig('pagos')}
                    disabled={guardando}
                  >
                    {guardando
                      ? 'Guardando...'
                      : 'Guardar Configuración'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pestanaActiva === 'correlativo' && puedeCorrelativo && (
            <div className="config-seccion">
              <h2 className="seccion-titulo">
                Correlativos de documentos
              </h2>

              <p className="seccion-pista">
                Configure el <strong>prefijo</strong> y el{' '}
                <strong>próximo número</strong> que se usará al crear el
                siguiente documento. El sistema auto-incrementa los
                correlativos al generar documentos.
              </p>

              <div className="formulario">
                <h3 className="config-subtitulo">Cotizaciones</h3>

                <div className="fila-form">
                  <div className="campo">
                    <label>Prefijo</label>
                    <input
                      type="text"
                      value={configLocal.cotizacion?.prefijo || 'NV'}
                      onChange={(e) =>
                        actualizarCotizacion(
                          'prefijo',
                          e.target.value
                        )
                      }
                      placeholder="NV"
                      readOnly={!puedeEditarCorrelativo}
                      className={
                        !puedeEditarCorrelativo
                          ? 'input-solo-lectura'
                          : ''
                      }
                    />
                  </div>

                  <div className="campo">
                    <label>Próximo número *</label>
                    <input
                      type="number"
                      value={
                        configLocal.cotizacion?.proximoNumero
                        || 1000001
                      }
                      onChange={(e) =>
                        actualizarCotizacion(
                          'proximoNumero',
                          Number(e.target.value)
                        )
                      }
                      placeholder="1004321"
                      min="1"
                      readOnly={!puedeEditarCorrelativo}
                      className={
                        !puedeEditarCorrelativo
                          ? 'input-solo-lectura'
                          : ''
                      }
                    />
                    <span className="pista-form">
                      Número que se usará en la próxima cotización.
                    </span>
                  </div>
                </div>

                <div className="campo">
                  <label>Último Correlativo Generado</label>
                  <input
                    type="text"
                    value={
                      configLocal.cotizacion?.ultimoCorrelativo
                      || 'NV1000000'
                    }
                    className="input-solo-lectura"
                    readOnly
                  />
                </div>

                <div className="correlativo-preview">
                  <span className="preview-label">
                    Próximo código que se generará:
                  </span>
                  <span className="preview-value">
                    {configLocal.cotizacion?.prefijo || 'NV'}
                    {(
                      configLocal.cotizacion?.proximoNumero
                      || 1000001
                    ).toString().padStart(7, '0')}
                  </span>
                </div>

                <div className="config-separador" />

                <h3 className="config-subtitulo">
                  Órdenes de compra
                </h3>

                <p className="seccion-pista">
                  El formato oficial usa el patrón{' '}
                  <strong>OC100110</strong>: prefijo OC y seis dígitos.
                  El número se reserva únicamente al guardar la orden.
                </p>

                <div className="fila-form">
                  <div className="campo">
                    <label>Prefijo OC</label>
                    <input
                      type="text"
                      value={configLocal.ordenCompra?.prefijo || 'OC'}
                      onChange={(e) =>
                        actualizarOrdenCompra(
                          'prefijo',
                          e.target.value.toUpperCase()
                        )
                      }
                      maxLength="8"
                      readOnly={!puedeEditarCorrelativo}
                      className={
                        !puedeEditarCorrelativo
                          ? 'input-solo-lectura'
                          : ''
                      }
                    />
                  </div>

                  <div className="campo">
                    <label>Próximo número OC *</label>
                    <input
                      type="number"
                      min="1"
                      value={
                        configLocal.ordenCompra?.proximoNumero
                        || 100111
                      }
                      onChange={(e) =>
                        actualizarOrdenCompra(
                          'proximoNumero',
                          Math.max(1, Number(e.target.value))
                        )
                      }
                      readOnly={!puedeEditarCorrelativo}
                      className={
                        !puedeEditarCorrelativo
                          ? 'input-solo-lectura'
                          : ''
                      }
                    />
                    <span className="pista-form">
                      Se asigna al guardar, nunca al abrir el formulario.
                    </span>
                  </div>
                </div>

                <div className="campo">
                  <label>Última OC generada</label>
                  <input
                    value={
                      configLocal.ordenCompra?.ultimoCorrelativo
                      || 'OC100110'
                    }
                    readOnly
                    className="input-solo-lectura"
                  />
                </div>

                <div className="correlativo-preview">
                  <span className="preview-label">
                    Próxima OC:
                  </span>
                  <span className="preview-value">
                    {configLocal.ordenCompra?.prefijo || 'OC'}
                    {String(
                      configLocal.ordenCompra?.proximoNumero
                      || 100111
                    ).padStart(
                      configLocal.ordenCompra?.longitud || 6,
                      '0'
                    )}
                  </span>
                </div>

                <div className="fila-form">
                  <div className="campo">
                    <label>Autorizado por</label>
                    <input
                      value="Alfredo Landeo León Landeo"
                      readOnly
                      className="input-solo-lectura"
                    />
                  </div>

                  <div className="campo">
                    <label>Cargo del autorizador</label>
                    <input
                      value="GERENTE GENERAL NOOVA S.A.C."
                      readOnly
                      className="input-solo-lectura"
                    />
                  </div>
                </div>
              </div>

              {puedeEditarCorrelativo && (
                <div className="config-guardar">
                  <button
                    className="btn-principal"
                    onClick={() => guardarConfig('correlativo')}
                    disabled={guardando}
                  >
                    {guardando
                      ? 'Guardando...'
                      : 'Guardar Configuración'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pestanaActiva === 'usuarios' && puedeUsuarios && (
            <div className="config-seccion config-seccion-usuarios">
              <Usuarios embebido />
            </div>
          )}

          {pestanaActiva === 'logs' && puedeLogs && (
            <div className="config-seccion">
              <div className="seccion-header auditoria-header">
                <h2 className="seccion-titulo">
                  Registro de Auditoría
                </h2>

                <div className="auditoria-acciones">
                <button
                  type="button"
                  className="btn-secundario auditoria-boton"
                  onClick={cargarLogs}
                  disabled={cargandoLogs}
                >
                  Actualizar
                </button>
                </div>
              </div>

              {cargandoLogs ? (
                <p className="texto-cargando">
                  Cargando registros...
                </p>
              ) : logs.length === 0 ? (
                <div className="estado-vacio">
                  <p>No hay registros de auditoría</p>
                </div>
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
                            <td className="texto-negrita">
                              {log.usuario}
                            </td>
                            <td>
                              <span className="badge-accion">
                                {log.accion}
                              </span>
                            </td>
                            <td className="texto-truncado">
                              {log.detalle || '-'}
                            </td>
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

      <Modal
        isOpen={modalCondicionAbierto && puedeEditarPagos}
        onClose={cerrarModalCondicion}
        title="Nueva condición de pago"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmarAgregarCondicion();
          }}
          className="formulario"
        >
          <div className="campo">
            <label>Descripción de la condición *</label>
            <input
              type="text"
              value={nuevaCondicion}
              onChange={(e) => {
                setNuevaCondicion(e.target.value);
                setErrorCondicion('');
              }}
              placeholder="Ej: 30 días, Crédito 60 días, etc."
              autoFocus
              className={errorCondicion ? 'input-error' : ''}
            />
            {errorCondicion && (
              <span className="mensaje-error">
                {errorCondicion}
              </span>
            )}
          </div>

          <div className="acciones-form">
            <button
              type="button"
              className="btn-secundario"
              onClick={cerrarModalCondicion}
            >
              Cancelar
            </button>

            <button type="submit" className="btn-principal">
              <FiCheck
                size={14}
                style={{
                  marginRight: 4,
                  verticalAlign: 'middle'
                }}
              />
              Agregar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
