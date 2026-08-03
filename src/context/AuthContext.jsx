import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile, createUserProfile } from '../services/userService';
import { addLog } from '../services/logService';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Tiempo de inactividad antes de cerrar sesión automáticamente (30 min)
const TIMEOUT_INACTIVIDAD_MS = 30 * 60 * 1000;
// Eventos del usuario que reinician el contador de inactividad
const EVENTOS_INACTIVIDAD = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avisoTimeout, setAvisoTimeout] = useState(false);
  const timerInactividadRef = useRef(null);
  const timerAvisoRef = useRef(null);

  async function loadUserProfile(user) {
    if (!user) {
      setUserProfile(null);
      return null;
    }
    try {
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        profile = await createUserProfile(user.uid, {
          email: user.email || '',
          nombre: user.displayName || user.email?.split('@')[0] || '',
          role: 'comercial'
        });
      }
      // Verificación de seguridad: si el perfil está marcado inactivo, cerrar sesión
      if (profile.activo === false) {
        console.warn('Usuario inactivo, cerrando sesión');
        await signOut(auth);
        setUserProfile(null);
        return null;
      }
      setUserProfile(profile);
      return profile;
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setUserProfile(null);
      return null;
    }
  }

  async function login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadUserProfile(credential.user);
    if (profile) {
      await addLog({ usuario: profile.nombre || email, accion: 'inicio_sesion', detalle: email });
    }
    return credential;
  }

  async function logout(motivo = 'manual') {
    if (userProfile) {
      try {
        await addLog({ usuario: userProfile.nombre || currentUser?.email, accion: 'cierre_sesion', detalle: motivo });
      } catch (e) {
        console.warn('No se pudo registrar log de cierre de sesión:', e);
      }
    }
    // Limpia timers de inactividad
    if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    if (timerAvisoRef.current) clearTimeout(timerAvisoRef.current);
    setAvisoTimeout(false);
    // Marca el motivo para que el Login muestre un aviso claro (no un error)
    if (motivo === 'inactividad') {
      try {
        sessionStorage.setItem('noova_logout_motivo', 'inactividad');
      } catch (e) {
        console.warn('No se pudo guardar el motivo de cierre de sesión:', e);
      }
    }
    await signOut(auth);
    setUserProfile(null);
  }

  async function refreshProfile() {
    if (currentUser) {
      await loadUserProfile(currentUser);
    }
  }

  // ── Timeout de inactividad ──
  const reiniciarTimerInactividad = useCallback(() => {
    if (!currentUser) return;
    setAvisoTimeout(false);
    if (timerAvisoRef.current) clearTimeout(timerAvisoRef.current);
    if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);

    // Aviso 2 minutos antes del cierre
    timerAvisoRef.current = setTimeout(() => {
      setAvisoTimeout(true);
    }, TIMEOUT_INACTIVIDAD_MS - 2 * 60 * 1000);

    // Cierre de sesión
    timerInactividadRef.current = setTimeout(() => {
      console.info('Cerrando sesión por inactividad');
      logout('inactividad');
    }, TIMEOUT_INACTIVIDAD_MS);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Reinicia el timer en cada evento de actividad del usuario.
    // IMPORTANTE: se escucha en fase de CAPTURA (capture: true). Varios
    // componentes (Modal, ConfirmDialog, comboboxes de Cotizaciones) llaman a
    // e.stopPropagation() en clicks/mousedown internos para no cerrar el
    // modal, lo cual impedía que esos eventos llegaran al listener en fase
    // de burbuja y provocaba el "deslogueo de la nada" mientras se trabajaba
    // dentro de un modal o formulario. La fase de captura se ejecuta ANTES
    // de que cualquier stopPropagation() en burbuja pueda bloquear el evento.
    const handler = () => reiniciarTimerInactividad();
    EVENTOS_INACTIVIDAD.forEach(evt => window.addEventListener(evt, handler, { passive: true, capture: true }));
    reiniciarTimerInactividad();

    return () => {
      EVENTOS_INACTIVIDAD.forEach(evt => window.removeEventListener(evt, handler, { capture: true }));
      if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
      if (timerAvisoRef.current) clearTimeout(timerAvisoRef.current);
    };
  }, [currentUser, reiniciarTimerInactividad]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    logout,
    refreshProfile,
    avisoTimeout,
    setAvisoTimeout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
