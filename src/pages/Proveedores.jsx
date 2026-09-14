import { useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { useProveedores } from '../hooks/useProveedores';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Compras.css';

const VACIO = {
  razonSocial: '', ruc: '', contacto: '', direccion: '', telefono: '', email: '',
  activo: true, notaInterna: ''
};

export default function Proveedores() {
  const { proveedores, loading, error, addProveedor, editProveedor, removeProveedor } = useProveedores();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminar, setEliminar] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return proveedores;
    return proveedores.filter((p) => [p.razonSocial, p.ruc, p.contacto, p.email]
      .some((v) => String(v || '').toLowerCase().includes(t)));
  }, [proveedores, busqueda]);

  function flash(tipo, texto) {
    setMensaje({ tipo, texto });
    window.setTimeout(() => setMensaje(null), 4500);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...VACIO });
    setModal(true);
  }

  function abrirEditar(proveedor) {
    setEditando(proveedor.id);
    setForm({ ...VACIO, ...proveedor });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.razonSocial.trim()) return flash('error', 'La razón social es obligatoria');
    setGuardando(true);
    try {
      if (editando) {
        await editProveedor(editando, form);
        flash('success', 'Proveedor actualizado');
      } else {
        await addProveedor(form);
        flash('success', 'Proveedor creado');
      }
      setModal(false);
    } catch (err) {
      flash('error', err.message || 'No se pudo guardar el proveedor');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeProveedor(eliminar.id);
      flash('success', 'Proveedor eliminado');
    } catch (err) {
      flash('error', err.message || 'No se pudo eliminar el proveedor');
    } finally {
      setEliminar(null);
    }
  }

  if (loading) return <Loading message="Cargando proveedores..." />;

  return (
    <div className="pagina proveedores-pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Proveedores</h1>
          <p className="pagina-subtitulo">Maestro de proveedores para órdenes de compra y solicitudes comerciales.</p>
        </div>
        <button className="btn-principal" onClick={abrirNuevo}><FiPlus size={16} /> Nuevo proveedor</button>
      </div>

      {(mensaje || error) && <div className={`mensaje-flash mensaje-${mensaje?.tipo || 'error'}`}>{mensaje?.texto || error}</div>}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por razón social, RUC, contacto o correo..." />
        </div>
      </div>

      <div className="tarjeta-tabla">
        {lista.length === 0 ? (
          <div className="estado-vacio"><p>No hay proveedores registrados</p></div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-datos">
              <thead><tr><th>Proveedor</th><th>RUC</th><th>Contacto</th><th>Correo / teléfono</th><th>Estado</th><th className="texto-centro">Acciones</th></tr></thead>
              <tbody>{lista.map((p) => (
                <tr key={p.id}>
                  <td><span className="texto-negrita">{p.razonSocial}</span>{p.esDemo && <small className="texto-suave" style={{display:'block'}}>Proveedor de prueba, editar antes de usar en producción</small>}</td>
                  <td>{p.ruc || '—'}</td>
                  <td>{p.contacto || '—'}</td>
                  <td>{p.email || '—'}{p.telefono ? <small style={{display:'block'}}>{p.telefono}</small> : null}</td>
                  <td><span className={`badge-estado ${p.activo === false ? 'borrador' : 'aprobada'}`}>{p.activo === false ? 'Inactivo' : 'Activo'}</span></td>
                  <td className="texto-centro"><div className="acciones-tabla">
                    <button className="btn-accion" onClick={() => abrirEditar(p)} title="Editar proveedor"><FiEdit2 size={17} /></button>
                    <button className="btn-accion btn-eliminar" onClick={() => setEliminar(p)} title="Eliminar proveedor"><FiTrash2 size={17} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => !guardando && setModal(false)} title={editando ? 'Editar proveedor' : 'Nuevo proveedor'} size="large">
        <form className="formulario" onSubmit={guardar}>
          <div className="fila-form">
            <div className="campo campo-doble"><label>Razón social *</label><input value={form.razonSocial} onChange={(e) => setForm((p) => ({...p, razonSocial:e.target.value}))} /></div>
            <div className="campo"><label>RUC</label><input value={form.ruc} onChange={(e) => setForm((p) => ({...p, ruc:e.target.value}))} /></div>
          </div>
          <div className="fila-form">
            <div className="campo"><label>Contacto</label><input value={form.contacto} onChange={(e) => setForm((p) => ({...p, contacto:e.target.value}))} /></div>
            <div className="campo"><label>Teléfono</label><input value={form.telefono} onChange={(e) => setForm((p) => ({...p, telefono:e.target.value}))} /></div>
            <div className="campo"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm((p) => ({...p, email:e.target.value}))} /></div>
          </div>
          <div className="campo"><label>Dirección</label><input value={form.direccion} onChange={(e) => setForm((p) => ({...p, direccion:e.target.value}))} /></div>
          <div className="campo"><label>Nota interna</label><textarea rows="3" value={form.notaInterna} onChange={(e) => setForm((p) => ({...p, notaInterna:e.target.value}))} /></div>
          <label className="compras-check"><input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm((p) => ({...p, activo:e.target.checked}))} /> Proveedor activo</label>
          <div className="acciones-form"><button type="button" className="btn-secundario" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button><button className="btn-principal" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar proveedor'}</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={Boolean(eliminar)} onClose={() => setEliminar(null)} onConfirm={confirmarEliminar} title="¿Eliminar proveedor?" message={`Se eliminará ${eliminar?.razonSocial || 'el proveedor'}. Si ya está usado en una OC, el sistema lo impedirá.`} />
    </div>
  );
}
