import { useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit3, FiUpload } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import { puede } from '../../../services/userService';
import { addLog } from '../../../services/logService';
import { FIRMANTES_SALIDA } from '../../../data/firmantes';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Loading from '../../../components/Loading';
import { useSalidas } from '../hooks/useSalidas';
import { actualizarSalidaGuia, eliminarSalidaGuia } from '../services/salidaService';
import { importarGuias } from '../services/importarGuias';
import { descargarExcel } from '../services/exportarExcel';
import {
  completarSalida, crearItemSalida, crearSalida, formatearGuia, formatoDesdeGuia, numerarSinCorrelativo, siguienteCorrelativo,
  validarSalida
} from '../utils/salida';
import ListaSalidas from '../components/ListaSalidas';
import EditorSalida from '../components/EditorSalida';
import '../../../styles/shared.css';
import './Salidas.css';

const MAX_ARCHIVOS = 20;
const SOLICITA_SALIDAS = 'gianfranco';
const AUTORIZA_SALIDAS = 'elena';

function nombreFirmante(id) {
  return FIRMANTES_SALIDA.find((f) => f.id === id)?.nombre || '';
}

function valoresPorDefecto(nombreUsuario) {
  return {
    persona: nombreUsuario,
    solicitante: nombreFirmante(SOLICITA_SALIDAS),
    autorizador: nombreFirmante(AUTORIZA_SALIDAS)
  };
}

export default function SalidasPage() {
  const { currentUser, userProfile } = useAuth();
  const { salidas, loading, error, recargar } = useSalidas();
  const puedeCrear = puede(userProfile, 'salidas', 'create');
  const puedeEditar = puede(userProfile, 'salidas', 'update');
  const puedeEliminar = puede(userProfile, 'salidas', 'delete');
  const usuario = userProfile?.nombre || currentUser?.displayName || currentUser?.email || '';
  const porDefecto = useMemo(() => valoresPorDefecto(usuario), [usuario]);

  const [edicion, setEdicion] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [eliminarId, setEliminarId] = useState(null);
  const entradaArchivos = useRef(null);
  const numerando = useRef(false);

  useEffect(() => {
    const sinNumero = numerarSinCorrelativo(salidas, porDefecto);
    if (!sinNumero.length || !puedeEditar || numerando.current) return;
    numerando.current = true;
    Promise.all(sinNumero.map((s) => actualizarSalidaGuia(s.id, s, { usuario, accion: 'numerado', versionEsperada: s.version })))
      .then(recargar)
      .catch((err) => console.error('Error numerando formatos de salida:', err))
      .finally(() => { numerando.current = false; });
  }, [salidas, puedeEditar, usuario, porDefecto, recargar]);

  function avisar(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => setMensaje((m) => (m?.texto === texto ? null : m)), 7000);
  }

  function nuevaSalida(documento = null) {
    const formato = formatoDesdeGuia({}, { ...porDefecto, correlativo: siguienteCorrelativo(salidas) });
    return crearSalida({ documento, items: [crearItemSalida()], formato });
  }

  function abrir(salida, opciones = {}) {
    setEdicion({ salida: completarSalida(salida, porDefecto), ...opciones });
  }

  async function importar(e) {
    const archivos = [...(e.target.files || [])].slice(0, MAX_ARCHIVOS);
    e.target.value = '';
    if (!archivos.length) return;
    setOcupado(true);
    try {
      const { listas, pendientes, vinculadas, sinTexto, problemas } = await importarGuias(archivos, { salidas, usuario, porDefecto });
      if (listas.length || pendientes.length) await recargar();

      const unica = archivos.length === 1 && [...listas, ...pendientes, ...vinculadas][0];
      if (unica) abrir(unica.salida, { archivo: unica.archivo, mostrarErrores: pendientes.length > 0 });
      if (archivos.length === 1 && sinTexto.length === 1) {
        const { archivo, documento, mensaje: nota } = sinTexto[0];
        setEdicion({ salida: nuevaSalida(documento), archivo, aviso: nota });
      }

      avisar(problemas.length || pendientes.length || sinTexto.length ? 'error' : 'success', [
        listas.length ? `${listas.length} formato(s) de salida listos: revísalos y descárgalos desde la lista.` : '',
        pendientes.length ? `${pendientes.length} guía(s) necesitan un dato que no está en la guía: ábrelas desde la lista para completarlas.` : '',
        vinculadas.length ? `${vinculadas.length} guía(s) ya tenían su formato: se guardó su PDF para verlo al abrirlas.` : '',
        archivos.length > 1 ? sinTexto.map((s) => `${s.documento.nombre}: ${s.mensaje}`).join(' ') : '',
        ...problemas
      ].filter(Boolean).join(' '));
    } finally {
      setOcupado(false);
    }
  }

  async function descargar(registro) {
    const salida = completarSalida(registro, porDefecto);
    if (!validarSalida(salida).valido) {
      abrir(registro, { mostrarErrores: true });
      avisar('error', 'A este formato le faltan datos: complétalos y vuelve a descargar.');
      return;
    }
    setOcupado(true);
    try {
      await descargarExcel(salida);
      addLog({ usuario, accion: 'exportar_formato_salida', detalle: formatearGuia(salida.guia) }).catch(() => {});
    } catch (err) {
      console.error('Error generando el formato de salida:', err);
      avisar('error', 'No se pudo generar el Excel: ' + err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await eliminarSalidaGuia(eliminarId);
      addLog({ usuario, accion: 'eliminar_salida', detalle: eliminarId }).catch(() => {});
      setEliminarId(null);
      await recargar();
      avisar('success', 'Registro eliminado.');
      return true;
    } catch (err) {
      console.error('Error eliminando salida:', err);
      avisar('error', 'No se pudo eliminar el registro.');
      return false;
    }
  }

  if (loading) return <Loading message="Cargando formatos de salida..." />;

  return (
    <div className="pagina salidas-page">
      {!edicion && (
        <div className="pagina-header">
          <div>
            <h1 className="pagina-titulo">Formato de salida</h1>
            <p className="pagina-subtitulo">Sube las guías de remisión en PDF: el formato de salida se llena solo y descargas el Excel cuando lo revises.</p>
          </div>
          {puedeCrear && (
            <div className="salidas-acciones-cabecera">
              <button className="btn-secundario" onClick={() => setEdicion({ salida: nuevaSalida() })} disabled={ocupado}><FiEdit3 size={16} /> Llenar a mano</button>
              <button className="btn-principal" onClick={() => entradaArchivos.current?.click()} disabled={ocupado}>
                <FiUpload size={16} /> {ocupado ? 'Leyendo guías...' : 'Subir guías de remisión'}
              </button>
              <input ref={entradaArchivos} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple hidden onChange={importar} />
            </div>
          )}
        </div>
      )}

      {mensaje && <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</div>}

      {edicion ? (
        <EditorSalida
          key={edicion.salida.id || 'nueva'}
          inicial={edicion.salida}
          archivoInicial={edicion.archivo || null}
          avisoInicial={edicion.aviso}
          mostrarErroresInicial={edicion.mostrarErrores}
          soloLectura={!(edicion.salida.id ? puedeEditar : puedeCrear)}
          usuario={usuario}
          avisar={avisar}
          onGuardada={recargar}
          onCerrar={() => setEdicion(null)}
        />
      ) : (
        <>
          {error && <div className="mensaje-flash mensaje-error" role="alert">No se pudieron cargar los formatos: {error}</div>}
          <ListaSalidas
            salidas={salidas}
            ocupado={ocupado}
            puedeEliminar={puedeEliminar}
            onAbrir={abrir}
            onDescargar={descargar}
            onEliminar={setEliminarId}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!eliminarId}
        onClose={() => setEliminarId(null)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar formato de salida?"
        message="Se eliminará este registro. Los Excel ya descargados no se ven afectados."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
