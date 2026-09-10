import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  FiPlus,
  FiSearch,
  FiKey,
  FiUserX,
  FiUserCheck,
  FiEdit2
} from 'react-icons/fi';
import { useUsuarios } from '../hooks/useUsuarios';
import { useAuth } from '../context/AuthContext';
import {
  AREAS,
  ROLES,
  normalizarRol,
  normalizarArea,
  getAreaPredeterminada,
  getCarpetaNube,
  puede
} from '../services/userService';
import { addLog } from '../services/logService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Usuarios.css';

const USUARIO_VACIO = {
  email: '',
  password: '',
  nombre: '',
  cargo: '',
  telefono: '',
  role: 'gerente',
  area: 'gerencia'
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function obtenerAreaUsuario(usuario) {
  const role = normalizarRol(usuario?.role);

  return normalizarArea(usuario?.area)
    || normalizarArea(usuario?.sector)
    || getAreaPredeterminada(role);
}

function etiquetaNube(usuario) {
  const profile = {
    role: usuario?.role,
    activo: usuario?.activo !== false
  };

  if (!puede(profile, 'nube', 'read')) {
    return { texto: 'Sin acceso', completo: false };
  }

  const carpeta = getCarpetaNube(profile);

  if (carpeta === null) {
    return { texto: 'Todo', completo: true };
  }

  return { texto: carpeta || 'Sin acceso', completo: false };
}

export default function Usuarios({ embebido = false }) {
  const { userProfile } = useAuth();
  const {
    usuarios,
    loading,
    addUsuario,
    editRol,
    editDatos,
    editEstado,
    resetPassword
  } = useUsuarios();

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  }

  // ── Crear usuario ──
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [creando, setCreando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({ defaultValues: USUARIO_VACIO });

  async function alCrearUsuario(data) {
    setCreando(true);

    try {
      await addUsuario({
        ...data,
        role: normalizarRol(data.role),
        area: normalizarArea(data.area)
      });

      await addLog({
        usuario: userProfile?.nombre,
        accion: 'crear_usuario',
        detalle: data.email
      });

      mostrarMensaje(
        'success',
        `Usuario ${data.nombre} creado correctamente`
      );

      setMostrarModalNuevo(false);
      reset(USUARIO_VACIO);
    } catch (err) {
      mostrarMensaje(
        'error',
        'Error al crear usuario: ' + (err.message || '')
      );
    } finally {
      setCreando(false);
    }
  }

  // ── Editar datos ──
  const [usuarioEditar, setUsuarioEditar] = useState(null);
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit
  } = useForm({
    defaultValues: {
      nombre: '',
      cargo: '',
      telefono: '',
      area: ''
    }
  });

  function abrirEditar(usuario) {
    setUsuarioEditar(usuario);

    resetEdit({
      nombre: usuario.nombre || '',
      cargo: usuario.cargo || '',
      telefono: usuario.telefono || '',
      area: obtenerAreaUsuario(usuario)
    });
  }

  async function alGuardarDatos(data) {
    setGuardandoDatos(true);

    try {
      await editDatos(usuarioEditar.uid, {
        nombre: data.nombre,
        cargo: data.cargo,
        telefono: data.telefono,
        area: normalizarArea(data.area)
      });

      mostrarMensaje('success', 'Datos actualizados correctamente');
      setUsuarioEditar(null);
    } catch (err) {
      mostrarMensaje(
        'error',
        'Error al actualizar: ' + (err.message || '')
      );
    } finally {
      setGuardandoDatos(false);
    }
  }

  // ── Cambiar rol ──
  async function alCambiarRol(usuario, nuevoRol) {
    const normalizado = normalizarRol(nuevoRol);

    if (normalizado === normalizarRol(usuario.role)) return;

    try {
      await editRol(usuario.uid, normalizado);

      await addLog({
        usuario: userProfile?.nombre,
        accion: 'cambiar_rol_usuario',
        detalle: `${usuario.email} → ${normalizado}`
      });

      mostrarMensaje(
        'success',
        `Rol de ${usuario.nombre} actualizado a ${
          ROLES[normalizado]?.label || normalizado
        }`
      );
    } catch (err) {
      mostrarMensaje(
        'error',
        'Error al cambiar el rol: ' + (err.message || '')
      );
    }
  }

  // ── Activar / desactivar ──
  const [usuarioEstado, setUsuarioEstado] = useState(null);

  async function confirmarCambioEstado() {
    const nuevoEstado = !usuarioEstado.activo;

    try {
      await editEstado(usuarioEstado.uid, nuevoEstado);

      await addLog({
        usuario: userProfile?.nombre,
        accion: nuevoEstado ? 'reactivar_usuario' : 'desactivar_usuario',
        detalle: usuarioEstado.email
      });

      mostrarMensaje(
        'success',
        `Usuario ${nuevoEstado ? 'reactivado' : 'desactivado'} correctamente`
      );
    } catch (err) {
      mostrarMensaje(
        'error',
        'Error al cambiar el estado: ' + (err.message || '')
      );
    } finally {
      setUsuarioEstado(null);
    }
  }

  // ── Resetear contraseña ──
  const [usuarioPassword, setUsuarioPassword] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [reseteando, setReseteando] = useState(false);

  async function confirmarResetPassword(e) {
    e.preventDefault();

    if (nuevaPassword.length < 6) {
      mostrarMensaje(
        'error',
        'La contraseña debe tener al menos 6 caracteres'
      );
      return;
    }

    setReseteando(true);

    try {
      await resetPassword(usuarioPassword.uid, nuevaPassword);

      await addLog({
        usuario: userProfile?.nombre,
        accion: 'resetear_password',
        detalle: usuarioPassword.email
      });

      mostrarMensaje(
        'success',
        `Contraseña de ${usuarioPassword.nombre} actualizada`
      );

      setUsuarioPassword(null);
      setNuevaPassword('');
    } catch (err) {
      mostrarMensaje(
        'error',
        'Error al resetear la contraseña: ' + (err.message || '')
      );
    } finally {
      setReseteando(false);
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const term = terminoBusqueda.toLowerCase();

    return usuarios.filter((usuario) => {
      const role = normalizarRol(usuario.role);
      const area = obtenerAreaUsuario(usuario);
      const areaLabel = AREAS[area]?.label || area;

      return (
        (usuario.nombre || '').toLowerCase().includes(term)
        || (usuario.email || '').toLowerCase().includes(term)
        || (areaLabel || '').toLowerCase().includes(term)
        || (ROLES[role]?.label || usuario.role || '')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [usuarios, terminoBusqueda]);

  if (loading) {
    return <Loading message="Cargando usuarios..." />;
  }

  return (
    <div className={embebido ? 'usuarios-embebido' : 'pagina'}>
      <div className={embebido ? 'seccion-header' : 'pagina-header'}>
        <div>
          <h1 className={embebido ? 'seccion-titulo' : 'pagina-titulo'}>
            Usuarios y Roles
          </h1>
          <p className={embebido ? 'seccion-pista' : 'pagina-subtitle'}>
            Gestiona el área, rol y estado de acceso de cada colaborador.
            Los permisos se derivan del rol y ya no se editan manualmente
            usuario por usuario.
          </p>
        </div>

        <button
          className="btn-principal"
          onClick={() => {
            reset(USUARIO_VACIO);
            setMostrarModalNuevo(true);
          }}
        >
          <FiPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, área o rol..."
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="tarjeta-tabla">
        {usuariosFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Cargo</th>
                  <th>Área</th>
                  <th>Rol</th>
                  <th className="texto-centro">Nube</th>
                  <th className="texto-centro">Estado</th>
                  <th className="texto-centro">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((usuario) => {
                  const area = obtenerAreaUsuario(usuario);
                  const nube = etiquetaNube(usuario);

                  return (
                    <tr
                      key={usuario.uid}
                      className={usuario.activo === false ? 'fila-inactiva' : ''}
                    >
                      <td className="texto-negrita">
                        {usuario.nombre || '—'}
                      </td>
                      <td>{usuario.email}</td>
                      <td>{usuario.cargo || '—'}</td>
                      <td>{AREAS[area]?.label || area || '—'}</td>

                      <td>
                        <select
                          className="usuarios-select-rol"
                          value={normalizarRol(usuario.role)}
                          onChange={(e) =>
                            alCambiarRol(usuario, e.target.value)
                          }
                          disabled={usuario.uid === userProfile?.uid}
                          title={
                            usuario.uid === userProfile?.uid
                              ? 'No puedes cambiar tu propio rol'
                              : 'Cambiar rol'
                          }
                        >
                          {Object.entries(ROLES).map(([clave, cfg]) => (
                            <option key={clave} value={clave}>
                              {cfg.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="texto-centro">
                        <span
                          className={
                            nube.completo
                              ? 'usuarios-tag-nube usuarios-tag-nube-completo'
                              : 'usuarios-tag-nube'
                          }
                        >
                          {nube.texto}
                        </span>
                      </td>

                      <td className="texto-centro">
                        <span
                          className={`badge-estado ${
                            usuario.activo === false
                              ? 'rechazada'
                              : 'aprobada'
                          }`}
                        >
                          {usuario.activo === false ? 'Inactivo' : 'Activo'}
                        </span>
                      </td>

                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button
                            className="btn-accion"
                            onClick={() => abrirEditar(usuario)}
                            title="Editar datos"
                          >
                            <FiEdit2 size={16} />
                          </button>

                          <button
                            className="btn-accion"
                            onClick={() => {
                              setUsuarioPassword(usuario);
                              setNuevaPassword('');
                            }}
                            title="Resetear contraseña"
                          >
                            <FiKey size={16} />
                          </button>

                          {usuario.uid !== userProfile?.uid && (
                            <button
                              className={`btn-accion ${
                                usuario.activo === false
                                  ? ''
                                  : 'btn-eliminar'
                              }`}
                              onClick={() => setUsuarioEstado(usuario)}
                              title={
                                usuario.activo === false
                                  ? 'Reactivar'
                                  : 'Desactivar'
                              }
                            >
                              {usuario.activo === false
                                ? <FiUserCheck size={16} />
                                : <FiUserX size={16} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: nuevo usuario */}
      <Modal
        isOpen={mostrarModalNuevo}
        onClose={() => setMostrarModalNuevo(false)}
        title="Nuevo Usuario"
      >
        <form onSubmit={handleSubmit(alCrearUsuario)} className="formulario">
          <div className="campo">
            <label>Nombre completo *</label>
            <input
              {...register('nombre', {
                required: 'El nombre es requerido'
              })}
              className={errors.nombre ? 'input-error' : ''}
            />
            {errors.nombre && (
              <span className="mensaje-error">
                {errors.nombre.message}
              </span>
            )}
          </div>

          <div className="campo">
            <label>Correo *</label>
            <input
              type="email"
              {...register('email', {
                required: 'El correo es requerido',
                pattern: {
                  value: EMAIL_REGEX,
                  message: 'Correo inválido'
                }
              })}
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && (
              <span className="mensaje-error">
                {errors.email.message}
              </span>
            )}
          </div>

          <div className="campo">
            <label>Contraseña temporal *</label>
            <input
              type="text"
              {...register('password', {
                required: 'La contraseña es requerida',
                minLength: {
                  value: 6,
                  message: 'Mínimo 6 caracteres'
                }
              })}
              className={errors.password ? 'input-error' : ''}
              placeholder="El usuario podrá cambiarla luego si su rol lo permite"
            />
            {errors.password && (
              <span className="mensaje-error">
                {errors.password.message}
              </span>
            )}
          </div>

          <div className="campo">
            <label>Cargo</label>
            <input
              {...register('cargo')}
              placeholder="Ej: Responsable de Marketing"
            />
          </div>

          <div className="campo">
            <label>Teléfono</label>
            <input {...register('telefono')} />
          </div>

          <div className="campo">
            <label>Área *</label>
            <select {...register('area', { required: true })}>
              {Object.entries(AREAS).map(([clave, cfg]) => (
                <option key={clave} value={clave}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>Rol *</label>
            <select {...register('role', { required: true })}>
              {Object.entries(ROLES).map(([clave, cfg]) => (
                <option key={clave} value={clave}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="acciones-form">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setMostrarModalNuevo(false)}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-principal"
              disabled={creando}
            >
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: editar datos */}
      <Modal
        isOpen={!!usuarioEditar}
        onClose={() => setUsuarioEditar(null)}
        title={`Editar ${usuarioEditar?.nombre || ''}`}
      >
        <form
          onSubmit={handleSubmitEdit(alGuardarDatos)}
          className="formulario"
        >
          <div className="campo">
            <label>Nombre completo *</label>
            <input {...registerEdit('nombre', { required: true })} />
          </div>

          <div className="campo">
            <label>Cargo</label>
            <input {...registerEdit('cargo')} />
          </div>

          <div className="campo">
            <label>Teléfono</label>
            <input {...registerEdit('telefono')} />
          </div>

          <div className="campo">
            <label>Área *</label>
            <select {...registerEdit('area', { required: true })}>
              {Object.entries(AREAS).map(([clave, cfg]) => (
                <option key={clave} value={clave}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="usuarios-permisos">
            <p>
              Los permisos ya no se personalizan por usuario. Se aplican
              automáticamente según el rol seleccionado.
            </p>
          </div>

          <div className="acciones-form">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setUsuarioEditar(null)}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-principal"
              disabled={guardandoDatos}
            >
              {guardandoDatos ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: resetear contraseña */}
      <Modal
        isOpen={!!usuarioPassword}
        onClose={() => setUsuarioPassword(null)}
        title={`Resetear contraseña de ${usuarioPassword?.nombre || ''}`}
      >
        <form onSubmit={confirmarResetPassword} className="formulario">
          <div className="campo">
            <label>Nueva contraseña *</label>
            <input
              type="text"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>

          <div className="acciones-form">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setUsuarioPassword(null)}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-principal"
              disabled={reseteando}
            >
              {reseteando ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!usuarioEstado}
        onClose={() => setUsuarioEstado(null)}
        onConfirm={confirmarCambioEstado}
        title={
          usuarioEstado?.activo === false
            ? '¿Reactivar usuario?'
            : '¿Desactivar usuario?'
        }
        message={
          usuarioEstado?.activo === false
            ? `${usuarioEstado?.nombre} podrá volver a iniciar sesión en el ERP.`
            : `${usuarioEstado?.nombre} no podrá iniciar sesión hasta que lo reactives. No se borra su cuenta ni su historial.`
        }
      />
    </div>
  );
}
