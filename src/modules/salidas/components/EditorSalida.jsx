import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiDownload, FiEye, FiEyeOff, FiSave } from 'react-icons/fi';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { addLog } from '../../../services/logService';
import { actualizarSalidaGuia, crearSalidaGuia, guardarArchivoGuia, leerArchivoGuia } from '../services/salidaService';
import { descargarExcel } from '../services/exportarExcel';
import { claveGuia, formatearGuia, validarSalida } from '../utils/salida';
import FormatoSalida from './FormatoSalida';
import VisorDocumento from './VisorDocumento';

function huella(salida) {
  const { guia, formato, items } = salida;
  return JSON.stringify({ guia, formato, items });
}

export default function EditorSalida({ inicial, archivoInicial, avisoInicial, mostrarErroresInicial, soloLectura, usuario, avisar, onGuardada, onCerrar }) {
  const [salida, setSalida] = useState(inicial);
  const [original, setOriginal] = useState(() => (inicial.id ? huella(inicial) : ''));
  const [archivo, setArchivo] = useState(archivoInicial);
  const [verDocumento, setVerDocumento] = useState(true);
  const [mostrarErrores, setMostrarErrores] = useState(!!mostrarErroresInicial);
  const [ocupado, setOcupado] = useState('');
  const [confirmarSalir, setConfirmarSalir] = useState(false);

  const validacion = useMemo(() => validarSalida(salida), [salida]);
  const sinGuardar = huella(salida) !== original;

  useEffect(() => {
    if (archivoInicial || !inicial.id) return undefined;
    let vigente = true;
    leerArchivoGuia(inicial.id)
      .then((guardado) => { if (vigente) setArchivo(guardado); })
      .catch((err) => console.error('Error cargando la guía guardada:', err));
    return () => { vigente = false; };
  }, [archivoInicial, inicial.id]);

  async function guardar(estado) {
    const datos = { ...salida, estado };
    let id = salida.id;
    let version = 1;
    if (id) {
      version = await actualizarSalidaGuia(id, datos, { usuario, accion: estado === 'exportado' ? 'exportado' : 'editado', versionEsperada: salida.version });
    } else {
      id = await crearSalidaGuia(datos, usuario);
      await guardarArchivoGuia(id, archivo);
    }
    const guardada = { ...datos, id, version };
    setSalida(guardada);
    setOriginal(huella(guardada));
    onGuardada();
  }

  async function soloGuardar() {
    if (!claveGuia(salida.guia)) {
      setMostrarErrores(true);
      avisar('error', 'Escribe el N° de guía para poder guardar.');
      return;
    }
    setOcupado('guardando');
    try {
      await guardar('pendiente');
      avisar('success', 'Guardado.');
    } catch (err) {
      console.error('Error guardando salida:', err);
      avisar('error', err.message || 'No se pudo guardar.');
    } finally {
      setOcupado('');
    }
  }

  async function descargar() {
    setMostrarErrores(true);
    if (!validacion.valido) {
      avisar('error', 'Completa lo marcado en rojo para descargar el Excel.');
      return;
    }
    setOcupado('exportando');
    try {
      if (!soloLectura) await guardar('exportado');
      await descargarExcel(salida);
      addLog({ usuario, accion: 'exportar_formato_salida', detalle: formatearGuia(salida.guia) }).catch(() => {});
    } catch (err) {
      console.error('Error generando el formato de salida:', err);
      avisar('error', 'No se pudo generar el Excel: ' + err.message);
    } finally {
      setOcupado('');
    }
  }

  function volver() {
    if (sinGuardar) setConfirmarSalir(true);
    else onCerrar();
  }

  return (
    <>
      <div className="salidas-editor-barra">
        <button type="button" className="salidas-volver" onClick={volver}><FiArrowLeft size={14} /> Volver</button>
        {sinGuardar && salida.id && <span className="salidas-sin-guardar">Cambios sin guardar</span>}
        <div className="salidas-editor-acciones">
          <button type="button" className="btn-secundario" onClick={() => setVerDocumento((v) => !v)}>
            {verDocumento ? <FiEyeOff size={16} /> : <FiEye size={16} />} {verDocumento ? 'Ocultar guía' : 'Ver guía'}
          </button>
          {!soloLectura && (
            <button type="button" className="btn-secundario" onClick={soloGuardar} disabled={!!ocupado || (!sinGuardar && !!salida.id)}>
              <FiSave size={16} /> {ocupado === 'guardando' ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          <button type="button" className="btn-principal" onClick={descargar} disabled={!!ocupado}>
            <FiDownload size={16} /> {ocupado === 'exportando' ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </div>

      {salida.origen === 'pdf' && (
        <div className="salidas-aviso">La información está siendo procesada automáticamente, validar antes de descargar.</div>
      )}

      <div className={`salidas-editor-cuerpo ${verDocumento ? '' : 'salidas-sin-visor'}`}>
        <FormatoSalida
          salida={salida}
          onChange={setSalida}
          validacion={validacion}
          mostrarErrores={mostrarErrores}
          soloLectura={soloLectura}
        />
        {verDocumento && <VisorDocumento archivo={archivo} aviso={avisoInicial} />}
      </div>

      <ConfirmDialog
        isOpen={confirmarSalir}
        onClose={() => setConfirmarSalir(false)}
        onConfirm={onCerrar}
        title="¿Salir sin guardar?"
        message="Los cambios que no guardaste se perderán."
        confirmLabel="Salir sin guardar"
        busyLabel="Saliendo…"
      />
    </>
  );
}
