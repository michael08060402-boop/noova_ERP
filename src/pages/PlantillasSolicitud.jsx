import { useMemo, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiCopy, FiEdit2, FiPlus, FiRotateCcw, FiSave, FiTrash2 } from 'react-icons/fi';
import { usePlantillasSolicitud } from '../hooks/usePlantillasSolicitud';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { ICONOS_PLANTILLA, clonarBloques, plantillasBase } from '../utils/plantillasSolicitud';
import { formatDate, formatDateISO } from '../utils/formatDate';
import EditorBloques from '../components/solicitud/EditorBloques';
import VistaPreviaPDF from '../components/solicitud/VistaPreviaPDF';
import IconoPlantilla, { NOMBRES_ICONO } from '../components/solicitud/IconoPlantilla';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import './PlantillasSolicitud.css';

function origen(p) {
  if (!p.base) return 'Propia';
  return p.personalizada ? 'Base personalizada' : 'Base';
}

export default function PlantillasSolicitud({ puedeEditar }) {
  const { plantillas, loading, guardar, eliminar } = usePlantillasSolicitud();
  const { userProfile, currentUser } = useAuth();
  const { config } = useConfig();
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const responsable = userProfile?.nombre || currentUser?.email || '';
  const muestra = useMemo(() => (editando
    ? { bloques: editando.bloques, moneda: 'S/', responsable, fechaEmision: formatDateISO(), esSolicitudCotizacion: true }
    : null), [editando, responsable]);

  function avisar(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => setMensaje((m) => (m?.texto === texto ? null : m)), 4000);
  }

  async function ejecutar(accion, textoOk) {
    setGuardando(true);
    try {
      await accion();
      if (textoOk) avisar('success', textoOk);
      return true;
    } catch (err) {
      console.error('Error en plantillas de solicitud:', err);
      avisar('error', 'No se pudo completar la acción: ' + err.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!editando.nombre.trim()) return avisar('error', 'La plantilla necesita un nombre.');
    if (!editando.bloques.length) return avisar('error', 'La plantilla necesita al menos una sección.');
    const ok = await ejecutar(() => guardar({ ...editando, nombre: editando.nombre.trim() }), 'Plantilla guardada.');
    if (ok) setEditando(null);
    return undefined;
  }

  function mover(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= plantillas.length) return;
    const a = plantillas[i];
    const b = plantillas[j];
    ejecutar(async () => {
      await guardar({ ...a, orden: j });
      await guardar({ ...b, orden: i });
    });
  }

  function nueva() {
    const general = plantillasBase().find((p) => p.id === 'general');
    setEditando({ nombre: '', descripcion: '', icono: 'general', activa: true, orden: plantillas.length, bloques: clonarBloques(general.bloques) });
  }

  if (loading) return <Loading message="Cargando plantillas..." />;

  if (editando) {
    return (
      <div className="plantillas-editor">
        {mensaje && <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</div>}
        <div className="plantillas-editor-datos">
          <div className="campo">
            <label>Nombre</label>
            <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} placeholder="Ej: Alquiler de grupo electrógeno" maxLength={60} />
          </div>
          <div className="campo plantillas-editor-descripcion">
            <label>Descripción</label>
            <input value={editando.descripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} placeholder="Cuándo usar esta plantilla" maxLength={120} />
          </div>
          <div className="campo">
            <label>Ícono</label>
            <select value={editando.icono} onChange={(e) => setEditando({ ...editando, icono: e.target.value })}>
              {ICONOS_PLANTILLA.map((i) => <option key={i} value={i}>{NOMBRES_ICONO[i]}</option>)}
            </select>
          </div>
          <div className="plantillas-editor-acciones">
            <button type="button" className="btn-secundario" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
            <button type="button" className="btn-principal" onClick={guardarEdicion} disabled={guardando}><FiSave size={16} /> {guardando ? 'Guardando...' : 'Guardar plantilla'}</button>
          </div>
        </div>
        <p className="pista-form">Los valores que escribas aquí aparecerán prellenados en cada nueva solicitud; el usuario podrá cambiarlos.</p>
        <div className="plantillas-editor-grid">
          <EditorBloques
            bloques={editando.bloques}
            onChange={(bloques) => setEditando({ ...editando, bloques })}
            contexto={{ fecha: formatDate(formatDateISO()), solicitante: responsable, empresa: config?.empresa || {}, moneda: 'S/' }}
          />
          <VistaPreviaPDF solicitud={muestra} config={config} />
        </div>
      </div>
    );
  }

  return (
    <div className="plantillas-solicitud">
      {mensaje && <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</div>}
      <div className="plantillas-cabecera">
        <div>
          <h2 className="seccion-titulo">Plantillas de solicitud de cotización</h2>
          <p className="seccion-pista">Define qué secciones, datos, columnas y requisitos trae cada tipo de solicitud. Las plantillas ocultas no aparecen al crear una solicitud.</p>
        </div>
        {puedeEditar && <button type="button" className="btn-principal" onClick={nueva}><FiPlus size={16} /> Nueva plantilla</button>}
      </div>

      <div className="tabla-contenedor">
        <table className="tabla-datos">
          <thead>
            <tr>
              <th>Plantilla</th>
              <th>Origen</th>
              <th className="texto-centro">Visible</th>
              {puedeEditar && <th className="texto-centro">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {plantillas.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <div className="plantilla-fila">
                    <span className="plantilla-fila-icono"><IconoPlantilla icono={p.icono} size={18} /></span>
                    <div>
                      <div className="texto-negrita">{p.nombre}</div>
                      <div className="plantilla-fila-descripcion">{p.descripcion}</div>
                    </div>
                  </div>
                </td>
                <td>{origen(p)}</td>
                <td className="texto-centro">
                  <input
                    type="checkbox"
                    checked={p.activa !== false}
                    disabled={!puedeEditar || guardando}
                    onChange={(e) => ejecutar(() => guardar({ ...p, activa: e.target.checked }))}
                    aria-label={`Mostrar ${p.nombre}`}
                  />
                </td>
                {puedeEditar && (
                  <td className="texto-centro">
                    <div className="acciones-tabla">
                      <button className="btn-accion" title="Subir" onClick={() => mover(i, -1)} disabled={i === 0 || guardando}><FiArrowUp size={16} /></button>
                      <button className="btn-accion" title="Bajar" onClick={() => mover(i, 1)} disabled={i === plantillas.length - 1 || guardando}><FiArrowDown size={16} /></button>
                      <button className="btn-accion" title="Editar" onClick={() => setEditando({ ...p, bloques: clonarBloques(p.bloques) })}><FiEdit2 size={16} /></button>
                      <button className="btn-accion" title="Duplicar" onClick={() => setEditando({ nombre: `${p.nombre} (copia)`, descripcion: p.descripcion, icono: p.icono, activa: true, orden: plantillas.length, bloques: clonarBloques(p.bloques) })}><FiCopy size={16} /></button>
                      {p.base && p.personalizada && <button className="btn-accion" title="Restaurar original" onClick={() => setConfirmar({ tipo: 'restaurar', plantilla: p })}><FiRotateCcw size={16} /></button>}
                      {!p.base && <button className="btn-accion btn-eliminar" title="Eliminar" onClick={() => setConfirmar({ tipo: 'eliminar', plantilla: p })}><FiTrash2 size={16} /></button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!confirmar}
        onClose={() => !guardando && setConfirmar(null)}
        onConfirm={async () => {
          const ok = await ejecutar(() => eliminar(confirmar.plantilla.id), confirmar.tipo === 'restaurar' ? 'Plantilla restaurada.' : 'Plantilla eliminada.');
          if (ok) setConfirmar(null);
        }}
        title={confirmar?.tipo === 'restaurar' ? '¿Restaurar plantilla original?' : '¿Eliminar plantilla?'}
        message={confirmar?.tipo === 'restaurar' ? 'Se perderán los cambios hechos a esta plantilla base.' : 'Las solicitudes ya creadas con esta plantilla no se modifican.'}
        confirmLabel={confirmar?.tipo === 'restaurar' ? 'Restaurar' : 'Eliminar'}
        busyLabel="Procesando…"
        busy={guardando}
      />
    </div>
  );
}
