import { useMemo, useState } from 'react';
import { FiArrowLeft, FiClipboard, FiCopy, FiDownload, FiEdit2, FiPlus, FiSave, FiSearch, FiTrash2 } from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { usePlantillasSolicitud } from '../hooks/usePlantillasSolicitud';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { puede } from '../services/userService';
import { addLog } from '../services/logService';
import { formatDate, formatDateISO } from '../utils/formatDate';
import {
  ETIQUETAS_LEGACY, MONEDAS, bloquesDeSolicitud, clonarBloques, contarItems, crearCampo, primeraDescripcion, valorCampo
} from '../utils/plantillasSolicitud';
import EditorBloques from '../components/solicitud/EditorBloques';
import VistaPreviaPDF from '../components/solicitud/VistaPreviaPDF';
import IconoPlantilla from '../components/solicitud/IconoPlantilla';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './SolicitudesCotizacion.css';

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function nombrePlantilla(sol) {
  return sol.plantillaNombre || ETIQUETAS_LEGACY[sol.categoria] || 'EPP';
}

function asuntoDe(sol) {
  const bloques = bloquesDeSolicitud(sol);
  return valorCampo(bloques, 'asunto') || sol.asunto || primeraDescripcion(bloques) || '—';
}

function limpiar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function tieneContenido(bloques) {
  const tablas = bloques.filter((b) => b.tipo === 'tabla');
  return !tablas.length || contarItems(bloques) > 0;
}

export default function SolicitudesCotizacion() {
  const { currentUser, userProfile } = useAuth();
  const { config, refreshConfig } = useConfig();
  const { cotizaciones: solicitudes, loading, addCotizacion, editCotizacion, removeCotizacion } = useCotizaciones(true, { soloSolicitudes: true });
  const { plantillas, loading: loadingPlantillas } = usePlantillasSolicitud();

  const puedeCrear = puede(userProfile, 'solicitudes', 'create');
  const puedeEditar = puede(userProfile, 'solicitudes', 'update');
  const puedeEliminar = puede(userProfile, 'solicitudes', 'delete');

  const responsable = userProfile?.nombre || currentUser?.displayName || currentUser?.email || '';

  const [vista, setVista] = useState('lista');
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [termino, setTermino] = useState('');
  const [filtroPlantilla, setFiltroPlantilla] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const plantillasActivas = useMemo(() => plantillas.filter((p) => p.activa !== false), [plantillas]);
  const nombresPlantilla = useMemo(() => [...new Set(solicitudes.map(nombrePlantilla))].sort(), [solicitudes]);

  const filtradas = useMemo(() => {
    const t = normalizar(termino.trim());
    return solicitudes.filter((s) => {
      if (filtroPlantilla && nombrePlantilla(s) !== filtroPlantilla) return false;
      if (!t) return true;
      return [s.responsable, nombrePlantilla(s), asuntoDe(s)].some((v) => normalizar(v).includes(t));
    });
  }, [solicitudes, termino, filtroPlantilla]);

  const paginadas = useMemo(() => filtradas.slice((pagina - 1) * porPagina, pagina * porPagina), [filtradas, pagina, porPagina]);

  const solicitudPDF = useMemo(() => (borrador ? { ...borrador, fechaEmision: borrador.fechaEmision || formatDateISO(), responsable: borrador.responsable || responsable, esSolicitudCotizacion: true } : null), [borrador, responsable]);
  const contexto = {
    fecha: formatDate(borrador?.fechaEmision || formatDateISO()),
    solicitante: borrador?.responsable || responsable,
    empresa: config?.empresa || {},
    moneda: borrador?.moneda
  };

  function avisar(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => setMensaje((m) => (m?.texto === texto ? null : m)), 4500);
  }

  function elegirPlantilla(p) {
    setBorrador({ plantillaId: p.id, plantillaNombre: p.nombre, moneda: 'S/', bloques: clonarBloques(p.bloques) });
    setVista('editor');
  }

  function abrir(sol, duplicar = false) {
    setBorrador({
      id: duplicar ? undefined : sol.id,
      plantillaId: sol.plantillaId || '',
      plantillaNombre: nombrePlantilla(sol),
      moneda: sol.moneda || 'S/',
      fechaEmision: duplicar ? undefined : sol.fechaEmision,
      responsable: duplicar ? undefined : sol.responsable,
      bloques: clonarBloques(bloquesDeSolicitud(sol))
    });
    setVista('editor');
  }

  function aplicarDatosImportados(datos = {}) {
    setBorrador((b) => {
      const bloques = b.bloques.map((bl) => (bl.tipo === 'campos'
        ? { ...bl, campos: bl.campos.map((c) => (c.clave && datos[c.clave] && !String(c.valor || '').trim() ? { ...c, valor: datos[c.clave] } : c)) }
        : bl));
      if (datos.observacion) {
        const i = bloques.findIndex((bl) => bl.tipo === 'campos');
        if (i >= 0 && !bloques[i].campos.some((c) => c.clave === 'observacion')) {
          bloques[i] = { ...bloques[i], campos: [...bloques[i].campos, crearCampo({ etiqueta: 'Observación', tipo: 'textoLargo', clave: 'observacion', valor: datos.observacion })] };
        }
      }
      return { ...b, bloques };
    });
  }

  async function guardar() {
    if (!borrador.bloques.length) return avisar('error', 'La solicitud no tiene secciones.');
    if (!tieneContenido(borrador.bloques)) return avisar('error', 'Agrega al menos un ítem en la tabla antes de guardar.');
    setGuardando(true);
    try {
      const hoy = formatDateISO();
      const data = limpiar({
        clienteId: '',
        cliente: {},
        responsable: borrador.responsable || responsable,
        cargoResponsable: userProfile?.cargo || '',
        emailResponsable: userProfile?.email || currentUser?.email || '',
        telefonoResponsable: userProfile?.telefono || '',
        tipoItem: 'solicitud',
        esSolicitudCotizacion: true,
        plantillaId: borrador.plantillaId || '',
        plantillaNombre: borrador.plantillaNombre || '',
        moneda: borrador.moneda || 'S/',
        bloques: borrador.bloques,
        asunto: valorCampo(borrador.bloques, 'asunto') || primeraDescripcion(borrador.bloques) || '',
        totalItems: contarItems(borrador.bloques),
        estado: 'Generada',
        fechaEmision: borrador.fechaEmision || hoy,
        fecha: borrador.fechaEmision || hoy
      });
      if (borrador.id) {
        await editCotizacion(borrador.id, data);
        addLog({ usuario: responsable, accion: 'editar_solicitud_cotizacion', detalle: borrador.id }).catch(() => {});
      } else {
        const r = await addCotizacion(data);
        setBorrador((b) => ({ ...b, id: r.id, fechaEmision: data.fechaEmision }));
        addLog({ usuario: responsable, accion: 'crear_solicitud_cotizacion', detalle: r.id || '' }).catch(() => {});
      }
      avisar('success', 'Solicitud guardada.');
    } catch (err) {
      console.error('Error guardando solicitud de cotización:', err);
      avisar('error', 'No se pudo guardar la solicitud: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function descargar(sol) {
    try {
      const c = config || (await refreshConfig());
      const { downloadSolicitudPDF } = await import('../utils/generateSolicitudPDF');
      downloadSolicitudPDF(sol, c);
    } catch (err) {
      console.error('Error generando PDF de solicitud:', err);
      avisar('error', 'No se pudo generar el PDF: ' + err.message);
    }
  }

  async function confirmarEliminar() {
    if (!eliminarId || eliminando) return;
    setEliminando(true);
    try {
      await removeCotizacion(eliminarId);
      addLog({ usuario: responsable, accion: 'eliminar_solicitud_cotizacion', detalle: eliminarId }).catch(() => {});
      setEliminarId(null);
      avisar('success', 'Solicitud eliminada.');
    } catch (err) {
      console.error('Error eliminando solicitud de cotización:', err);
      avisar('error', 'No se pudo eliminar la solicitud.');
    } finally {
      setEliminando(false);
    }
  }

  if (loading) return <Loading message="Cargando solicitudes..." />;

  return (
    <div className="pagina solicitudes-cotizacion-page">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Solicitud de cotización</h1>
          <p className="pagina-subtitulo">Arma la solicitud desde una plantilla, ajústala y descarga el PDF para enviarlo al proveedor.</p>
        </div>
        {vista === 'lista' && puedeCrear && (
          <button className="btn-principal" onClick={() => setVista('plantilla')}>
            <FiPlus size={16} /> Nueva solicitud
          </button>
        )}
      </div>

      {mensaje && <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</div>}

      {vista === 'lista' && (
        <>
          <div className="filtros-barra">
            <div className="barra-busqueda">
              <FiSearch className="icono-busqueda" size={18} />
              <input type="text" placeholder="Buscar por asunto, plantilla o solicitante..." value={termino} onChange={(e) => { setTermino(e.target.value); setPagina(1); }} />
            </div>
            <select className="selector-filtro" value={filtroPlantilla} onChange={(e) => { setFiltroPlantilla(e.target.value); setPagina(1); }} aria-label="Filtrar por plantilla">
              <option value="">Todas las plantillas</option>
              {nombresPlantilla.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <Paginacion total={filtradas.length} paginaActual={pagina} porPagina={porPagina} onCambiarPagina={setPagina} onCambiarPorPagina={setPorPagina} compacta />

          <div className="tarjeta-tabla">
            {filtradas.length === 0 ? (
              <div className="estado-vacio">
                <FiClipboard size={28} />
                <p>{termino || filtroPlantilla ? 'Sin resultados' : 'Aún no hay solicitudes. Crea la primera con "Nueva solicitud".'}</p>
              </div>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla-datos">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Plantilla</th>
                      <th>Asunto</th>
                      <th>Solicitante</th>
                      <th className="texto-centro">Ítems</th>
                      <th className="texto-centro">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginadas.map((s) => (
                      <tr key={s.id}>
                        <td>{formatDate(s.fecha || s.fechaEmision || s.createdAt)}</td>
                        <td><span className="solicitud-plantilla-badge">{nombrePlantilla(s)}</span></td>
                        <td className="solicitud-asunto-celda" title={asuntoDe(s)}>{asuntoDe(s)}</td>
                        <td>{s.responsable || '—'}</td>
                        <td className="texto-centro texto-negrita">{s.totalItems ?? contarItems(bloquesDeSolicitud(s))}</td>
                        <td className="texto-centro">
                          <div className="acciones-tabla">
                            <button className="btn-accion" onClick={() => descargar(s)} title="Descargar PDF"><FiDownload size={18} /></button>
                            {puedeEditar && <button className="btn-accion" onClick={() => abrir(s)} title="Editar"><FiEdit2 size={18} /></button>}
                            {puedeCrear && <button className="btn-accion" onClick={() => abrir(s, true)} title="Duplicar como nueva"><FiCopy size={18} /></button>}
                            {puedeEliminar && <button className="btn-accion btn-eliminar" onClick={() => setEliminarId(s.id)} title="Eliminar"><FiTrash2 size={18} /></button>}
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
      )}

      {vista === 'plantilla' && (
        <div className="solicitud-paso">
          <button type="button" className="tab-volver-enlace" onClick={() => setVista('lista')}><FiArrowLeft size={14} /> Volver</button>
          <h2 className="seccion-titulo">¿Qué necesitas cotizar?</h2>
          <p className="pista-form">Elige la plantilla más parecida; después podrás agregar, quitar o mover cualquier sección.</p>
          {loadingPlantillas ? <Loading message="Cargando plantillas..." /> : (
            <div className="selector-plantillas">
              {plantillasActivas.map((p) => (
                <button key={p.id} type="button" className="tarjeta-plantilla" onClick={() => elegirPlantilla(p)}>
                  <span className="tarjeta-plantilla-icono"><IconoPlantilla icono={p.icono} size={22} /></span>
                  <span className="tarjeta-plantilla-nombre">{p.nombre}</span>
                  <span className="tarjeta-plantilla-descripcion">{p.descripcion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === 'editor' && borrador && (
        <div className="solicitud-editor">
          <div className="solicitud-editor-barra">
            <button type="button" className="tab-volver-enlace" onClick={() => { setVista('lista'); setBorrador(null); }}><FiArrowLeft size={14} /> Volver al historial</button>
            <span className="solicitud-plantilla-badge">{borrador.plantillaNombre}</span>
            <label className="solicitud-moneda">
              Moneda
              <select value={borrador.moneda} onChange={(e) => setBorrador((b) => ({ ...b, moneda: e.target.value }))}>
                {MONEDAS.map((m) => <option key={m.codigo} value={m.codigo}>{m.label}</option>)}
              </select>
            </label>
            <div className="solicitud-editor-acciones">
              <button type="button" className="btn-secundario" onClick={() => descargar(solicitudPDF)}><FiDownload size={16} /> Descargar PDF</button>
              {(borrador.id ? puedeEditar : puedeCrear) && (
                <button type="button" className="btn-principal" onClick={guardar} disabled={guardando}><FiSave size={16} /> {guardando ? 'Guardando...' : 'Guardar'}</button>
              )}
            </div>
          </div>
          <div className="solicitud-editor-grid">
            <EditorBloques
              bloques={borrador.bloques}
              onChange={(bloques) => setBorrador((b) => ({ ...b, bloques }))}
              contexto={contexto}
              onDatosImportados={aplicarDatosImportados}
            />
            <VistaPreviaPDF solicitud={solicitudPDF} config={config} />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!eliminarId}
        onClose={() => !eliminando && setEliminarId(null)}
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
