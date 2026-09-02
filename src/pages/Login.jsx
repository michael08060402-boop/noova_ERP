import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { verificarRateLimit, limpiarRateLimit, sanitizarTexto } from '../utils/validation';
import logo from '../assets/noova-logo.png';
import './Login.css';

// Rate limiting: máx 5 intentos por IP/navegador cada 5 minutos
const RATE_LIMIT_LOGIN = { maximo: 5, ventanaMs: 5 * 60 * 1000 };
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intentosRestantes, setIntentosRestantes] = useState(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  function validarCampos() {
    if (!email.trim()) return 'Ingrese su correo electrónico';
    if (!EMAIL_REGEX.test(email.trim())) return 'Formato de correo inválido';
    if (!password) return 'Ingrese su contraseña';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (password.length > 128) return 'La contraseña excede el tamaño permitido';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validación de campos antes de cualquier llamada
    const errValidacion = validarCampos();
    if (errValidacion) {
      setError(errValidacion);
      return;
    }

    // Rate limiting por navegador (defensa contra fuerza bruta).
    // IMPORTANTE: solo cuenta INTENTOS FALLIDOS, no cada envío del formulario.
    // Antes se consumía un intento incluso con la contraseña correcta, lo
    // que hacía aparecer el aviso de "bloqueo temporal" en sesiones normales.
    const rl = verificarRateLimit('login-intentos', RATE_LIMIT_LOGIN.maximo, RATE_LIMIT_LOGIN.ventanaMs, { soloVerificar: true });
    if (!rl.ok) {
      const mins = Math.ceil((rl.esperaMs || 0) / 60000);
      setError(`Demasiados intentos fallidos. Espere ${mins} minuto(s) antes de reintentar.`);
      setIntentosRestantes(0);
      return;
    }

    setLoading(true);
    try {
      // Sanitizar email antes de enviarlo a Firebase
      const emailLimpio = sanitizarTexto(email, 120).toLowerCase();
      await login(emailLimpio, password);
      // Login exitoso: se limpia el contador de intentos fallidos.
      limpiarRateLimit('login-intentos');
      setIntentosRestantes(null);
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', emailLimpio);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
    } catch {
      // Solo aquí, ante una credencial incorrecta, se registra el intento fallido.
      const rlFallo = verificarRateLimit('login-intentos', RATE_LIMIT_LOGIN.maximo, RATE_LIMIT_LOGIN.ventanaMs);
      setIntentosRestantes(rlFallo.ok ? rlFallo.restante : 0);
      setError('Credenciales incorrectas. Verifique su correo y contraseña.');
      // Limpia la contraseña por seguridad
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-form-container">

        <img src={logo} alt="NOOVA Logo" className="login-card-logo" />

        <div className="login-form-header">
          <h2>Bienvenido</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        {intentosRestantes !== null && intentosRestantes > 0 && intentosRestantes < 4 && !error && (
          <div className="login-warning">
            Intentos restantes antes del bloqueo temporal: {intentosRestantes}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <div className="login-field">
            <label htmlFor="email">Correo electrónico</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 120))}
                placeholder="correo@noova.com"
                required
                maxLength={120}
                autoComplete="email"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.slice(0, 128))}
                placeholder="••••••••"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="login-options">
            <label className="login-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Recordarme
            </label>
            <a href="#" className="login-forgot">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>

          <div className="login-secure">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Conexión segura y cifrada</span>
          </div>
        </form>
      </div>
    </div>
  );
}