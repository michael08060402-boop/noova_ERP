import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { puede, updateUserProfile } from '../services/userService';
import { addLog } from '../services/logService';
import {
  sanitizarTexto,
  esCelularValido,
  contienePatronPeligroso
} from '../utils/validation';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import logo from '../assets/noova-logo.png';
import '../styles/shared.css';
import './Perfil.css';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Perfil({ embebido = false }) {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const puedeEditarPerfil = puede(userProfile, 'perfil', 'update');

  const [form, setForm] = useState({
    nombre: '',
    cargo: '',
    telefono: '',
    email: ''
  });

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errorCampo, setErrorCampo] = useState({});

  const [editandoEmail, setEditandoEmail] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const [errorEmail, setErrorEmail] = useState('');

  const [editandoPassword, setEditandoPassword] = useState(false);
  const [passwordActualCambio, setPasswordActualCambio] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState('');

  useEffect(() => {
    if (userProfile) {
      setForm({
        nombre: userProfile.nombre || '',
        cargo: userProfile.cargo || '',
        telefono: userProfile.telefono || '',
        email: userProfile.email || currentUser?.email || ''
      });
    }
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (!puedeEditarPerfil) {
      setEditandoEmail(false);
      setEditandoPassword(false);
    }
  }, [puedeEditarPerfil]);

  function handleChange(campo, valor) {
    if (!puedeEditarPerfil) return;

    const limites = { nombre: 100, cargo: 80, telefono: 20 };
    const valorLimpio = sanitizarTexto(valor, limites[campo] || 200);

    setForm((prev) => ({ ...prev, [campo]: valorLimpio }));

    if (errorCampo[campo]) {
      setErrorCampo((prev) => ({ ...prev, [campo]: null }));
    }
  }

  function validarFormulario() {
    const errores = {};

    if (!form.nombre.trim()) {
      errores.nombre = 'El nombre es requerido';
    } else if (form.nombre.length < 2) {
      errores.nombre = 'Mínimo 2 caracteres';
    } else if (contienePatronPeligroso(form.nombre)) {
      errores.nombre = 'El nombre contiene caracteres no permitidos';
    }

    if (form.cargo && contienePatronPeligroso(form.cargo)) {
      errores.cargo = 'El cargo contiene caracteres no permitidos';
    }

    if (form.telefono && !esCelularValido(form.telefono)) {
      errores.telefono = 'Formato inválido. Use 9XXXXXXXX o +51 9XXXXXXXX';
    }

    if (form.email && !EMAIL_REGEX.test(form.email)) {
      errores.email = 'Email inválido';
    }

    setErrorCampo(errores);
    return Object.keys(errores).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje(null);

    if (!puedeEditarPerfil) {
      setMensaje({
        tipo: 'error',
        texto: 'Tu rol tiene acceso de solo lectura al perfil.'
      });
      return;
    }

    if (!validarFormulario()) {
      setMensaje({
        tipo: 'error',
        texto: 'Corrija los errores antes de guardar'
      });
      return;
    }

    setGuardando(true);

    try {
      const datosLimpios = {
        nombre: sanitizarTexto(form.nombre, 100),
        cargo: sanitizarTexto(form.cargo, 80),
        telefono: sanitizarTexto(form.telefono, 20)
      };

      await updateUserProfile(currentUser.uid, datosLimpios);
      await addLog({
        usuario: datosLimpios.nombre,
        accion: 'editar_perfil'
      });
      await refreshProfile();

      setMensaje({
        tipo: 'success',
        texto: 'Perfil actualizado correctamente'
      });
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      console.error('Error actualizando perfil:', err);
      setMensaje({
        tipo: 'error',
        texto: err?.code === 'permission-denied'
          ? 'Tu rol no permite modificar el perfil.'
          : 'Error al actualizar perfil'
      });
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicionEmail() {
    if (!puedeEditarPerfil) return;
    setNuevoEmail(form.email);
    setPasswordActual('');
    setErrorEmail('');
    setEditandoEmail(true);
  }

  function cerrarEdicionEmail() {
    setEditandoEmail(false);
    setPasswordActual('');
    setErrorEmail('');
  }

  async function guardarNuevoEmail() {
    if (!puedeEditarPerfil) {
      setErrorEmail('Tu rol tiene acceso de solo lectura al perfil.');
      return;
    }

    setErrorEmail('');
    const emailLimpio = sanitizarTexto(nuevoEmail, 120)
      .trim()
      .toLowerCase();

    if (!EMAIL_REGEX.test(emailLimpio)) {
      setErrorEmail('Email inválido');
      return;
    }

    if (!passwordActual) {
      setErrorEmail('Ingrese su contraseña actual para confirmar el cambio');
      return;
    }

    setGuardandoEmail(true);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordActual
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updateEmail(currentUser, emailLimpio);
      await updateUserProfile(currentUser.uid, { email: emailLimpio });
      await addLog({
        usuario: form.nombre,
        accion: 'cambiar_correo_erp'
      });
      await refreshProfile();

      setForm((prev) => ({ ...prev, email: emailLimpio }));
      setEditandoEmail(false);
      setPasswordActual('');
      setMensaje({
        tipo: 'success',
        texto: 'Correo actualizado correctamente'
      });
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      console.error('Error actualizando correo:', err);

      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setErrorEmail('Contraseña incorrecta');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorEmail('Ese correo ya está en uso');
      } else if (err.code === 'auth/requires-recent-login') {
        setErrorEmail('Por seguridad, vuelva a iniciar sesión e intente de nuevo');
      } else if (err.code === 'permission-denied') {
        setErrorEmail('Tu rol no permite modificar el perfil');
      } else {
        setErrorEmail('No se pudo actualizar el correo');
      }
    } finally {
      setGuardandoEmail(false);
    }
  }

  function abrirEdicionPassword() {
    if (!puedeEditarPerfil) return;

    setPasswordActualCambio('');
    setPasswordNueva('');
    setPasswordConfirmar('');
    setErrorPassword('');
    setEditandoPassword(true);
  }

  function cerrarEdicionPassword() {
    setEditandoPassword(false);
    setPasswordActualCambio('');
    setPasswordNueva('');
    setPasswordConfirmar('');
    setErrorPassword('');
  }

  async function guardarNuevaPassword() {
    if (!puedeEditarPerfil) {
      setErrorPassword('Tu rol tiene acceso de solo lectura al perfil.');
      return;
    }

    setErrorPassword('');

    if (!passwordActualCambio) {
      setErrorPassword('Ingrese su contraseña actual');
      return;
    }

    if (passwordNueva.length < 6) {
      setErrorPassword('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordNueva !== passwordConfirmar) {
      setErrorPassword('Las contraseñas no coinciden');
      return;
    }

    if (passwordNueva === passwordActualCambio) {
      setErrorPassword('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setGuardandoPassword(true);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordActualCambio
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordNueva);
      await addLog({
        usuario: form.nombre,
        accion: 'cambiar_password_erp'
      });

      cerrarEdicionPassword();
      setMensaje({
        tipo: 'success',
        texto: 'Contraseña actualizada correctamente'
      });
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      console.error('Error actualizando contraseña:', err);

      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setErrorPassword('Contraseña actual incorrecta');
      } else if (err.code === 'auth/requires-recent-login') {
        setErrorPassword('Por seguridad, vuelva a iniciar sesión e intente de nuevo');
      } else if (err.code === 'auth/weak-password') {
        setErrorPassword('La contraseña es demasiado débil');
      } else {
        setErrorPassword('No se pudo actualizar la contraseña');
      }
    } finally {
      setGuardandoPassword(false);
    }
  }

  return (
    <div className="pagina perfil-pagina">
      {!embebido && (
        <div className="pagina-header">
          <div>
            <h1 className="pagina-titulo">Mi Perfil</h1>
            <p className="pagina-subtitle">
              {puedeEditarPerfil
                ? 'Gestiona tu información personal'
                : 'Información de perfil · acceso de solo lectura'}
            </p>
          </div>
        </div>
      )}

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className={`perfil-grid ${!puedeEditarPerfil ? 'perfil-grid-solo-datos' : ''}`}>
      <div className="perfil-card perfil-datos">
        <div className="perfil-avatar-section">
          <img className="perfil-logo" src={logo} alt="Noova" />
          <div className="perfil-avatar-info">
            <span className="perfil-name">{form.nombre || 'Sin nombre'}</span>
            <span className="perfil-email">
              {form.email || currentUser?.email}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="formulario">
          <div className="fila-form">
            <div className="campo">
              <label>Nombre Completo</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                placeholder="Nombre completo"
                required
                maxLength={100}
                readOnly={!puedeEditarPerfil}
                className={
                  !puedeEditarPerfil
                    ? 'input-solo-lectura'
                    : errorCampo.nombre
                      ? 'input-error'
                      : ''
                }
              />
              {errorCampo.nombre && (
                <span className="mensaje-error">
                  {errorCampo.nombre}
                </span>
              )}
            </div>

            <div className="campo">
              <label>Cargo</label>
              <input
                type="text"
                value={form.cargo}
                onChange={(e) => handleChange('cargo', e.target.value)}
                placeholder="Ej: Ejecutivo Comercial"
                maxLength={80}
                readOnly={!puedeEditarPerfil}
                className={
                  !puedeEditarPerfil
                    ? 'input-solo-lectura'
                    : errorCampo.cargo
                      ? 'input-error'
                      : ''
                }
              />
              {errorCampo.cargo && (
                <span className="mensaje-error">
                  {errorCampo.cargo}
                </span>
              )}
            </div>
          </div>

          <div className="fila-form">
            <div className="campo">
              <label>Teléfono / Celular</label>
              <input
                type="text"
                value={form.telefono}
                onChange={(e) => handleChange('telefono', e.target.value)}
                placeholder="+51 999 999 999"
                maxLength={20}
                readOnly={!puedeEditarPerfil}
                className={
                  !puedeEditarPerfil
                    ? 'input-solo-lectura'
                    : errorCampo.telefono
                      ? 'input-error'
                      : ''
                }
              />
              {errorCampo.telefono && (
                <span className="mensaje-error">
                  {errorCampo.telefono}
                </span>
              )}
            </div>

            <div className="campo">
              <label>Correo Electrónico (correo del ERP)</label>

              {editandoEmail && puedeEditarPerfil ? (
                <div className="email-edicion">
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    placeholder="nuevo@correo.com"
                    maxLength={120}
                    className={errorEmail ? 'input-error' : ''}
                  />

                  <input
                    type="password"
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    placeholder="Contraseña actual (para confirmar)"
                    className={errorEmail ? 'input-error' : ''}
                    style={{ marginTop: 6 }}
                  />

                  {errorEmail && (
                    <span className="mensaje-error">{errorEmail}</span>
                  )}

                  <div className="acciones-form" style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-secundario btn-pequeno"
                      onClick={cerrarEdicionEmail}
                      disabled={guardandoEmail}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className="btn-principal btn-pequeno"
                      onClick={guardarNuevoEmail}
                      disabled={guardandoEmail}
                    >
                      {guardandoEmail ? 'Guardando...' : 'Guardar correo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="email-solo-lectura-wrap">
                  <input
                    type="email"
                    value={form.email}
                    readOnly
                    className="input-solo-lectura"
                  />

                  {puedeEditarPerfil && (
                    <button
                      type="button"
                      className="btn-secundario btn-pequeno"
                      onClick={abrirEdicionEmail}
                    >
                      Cambiar correo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {puedeEditarPerfil && (
            <div className="acciones-form">
              <button
                type="submit"
                className="btn-principal"
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>
      </div>

      {puedeEditarPerfil && (
        <div className="perfil-card perfil-seguridad">
          <h2 className="perfil-seccion-titulo">Seguridad</h2>

          {editandoPassword ? (
            <div className="password-edicion">
              <div className="campo">
                <label>Contraseña actual</label>
                <input
                  type="password"
                  value={passwordActualCambio}
                  onChange={(e) => setPasswordActualCambio(e.target.value)}
                  placeholder="Ingrese su contraseña actual"
                  className={errorPassword ? 'input-error' : ''}
                />
              </div>

              <div className="fila-form">
                <div className="campo">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={errorPassword ? 'input-error' : ''}
                  />
                </div>

                <div className="campo">
                  <label>Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    value={passwordConfirmar}
                    onChange={(e) => setPasswordConfirmar(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    className={errorPassword ? 'input-error' : ''}
                  />
                </div>
              </div>

              {errorPassword && (
                <span className="mensaje-error">{errorPassword}</span>
              )}

              <div className="acciones-form">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={cerrarEdicionPassword}
                  disabled={guardandoPassword}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn-principal"
                  onClick={guardarNuevaPassword}
                  disabled={guardandoPassword}
                >
                  {guardandoPassword
                    ? 'Guardando...'
                    : 'Actualizar contraseña'}
                </button>
              </div>
            </div>
          ) : (
            <div className="password-solo-lectura-wrap">
              <span className="pista">
                Por seguridad, tu contraseña no se muestra. Puedes cambiarla
                cuando quieras.
              </span>

              <button
                type="button"
                className="btn-secundario btn-pequeno"
                onClick={abrirEdicionPassword}
              >
                Cambiar contraseña
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
