import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, authPersistenceReady } from '../firebase/config';
import { getUserProfile } from '../services/userService';
import { addLog } from '../services/logService';
import Loading from '../components/Loading';

const AuthContext = createContext();
const PROFILE_CACHE_PREFIX = 'noova:user-profile:';

export function useAuth() {
  return useContext(AuthContext);
}

function cacheKey(uid) {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

function readCachedProfile(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile) {
  if (!profile?.uid) return;
  try {
    localStorage.setItem(cacheKey(profile.uid), JSON.stringify(profile));
  } catch {
    // La caché es solo un respaldo de disponibilidad; nunca debe bloquear Auth.
  }
}

function clearCachedProfile(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(cacheKey(uid));
  } catch {
    // Nada que hacer.
  }
}

function createDevelopmentFallbackProfile(user) {
  return {
    uid: user.uid,
    nombre: user.displayName || user.email || 'Administrador local',
    email: user.email || '',
    cargo: 'Administrador',
    role: 'administrador',
    sector: 'Administración',
    permissions: null,
    activo: true,
    _compatibilityFallback: true
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef(null);

  const resolveFallbackProfile = useCallback((user, reason) => {
    const cached = readCachedProfile(user.uid);
    if (cached) {
      console.warn(`Perfil remoto no disponible (${reason}). Se reutiliza el último perfil válido en caché.`);
      setUserProfile(cached);
      return cached;
    }

    // El ERP histórico era single-tenant y el desarrollo local necesita poder
    // seguir probándose aunque Firestore tenga reglas/configuración temporalmente
    // incompatibles. Este fallback NUNCA se activa en un build de producción.
    if (import.meta.env.DEV) {
      const fallback = createDevelopmentFallbackProfile(user);
      console.warn(`Perfil remoto no disponible (${reason}). Modo local de compatibilidad: administrador.`);
      setUserProfile(fallback);
      return fallback;
    }

    return null;
  }, []);

  const loadUserProfile = useCallback(async (user) => {
    if (!user) {
      setUserProfile(null);
      return null;
    }

    try {
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        const fallback = resolveFallbackProfile(user, 'perfil inexistente');
        if (fallback) return fallback;

        await signOut(auth);
        clearCachedProfile(user.uid);
        throw new Error('Tu cuenta no tiene un perfil habilitado en el ERP. Solicita acceso a un administrador.');
      }

      if (profile.activo === false) {
        await signOut(auth);
        clearCachedProfile(user.uid);
        setUserProfile(null);
        return null;
      }

      if (!profile.role || profile.role === 'sin_acceso') {
        await signOut(auth);
        clearCachedProfile(user.uid);
        throw new Error('Tu cuenta todavía no tiene un rol con acceso al ERP.');
      }

      setUserProfile(profile);
      writeCachedProfile(profile);
      return profile;
    } catch (err) {
      // Si Auth sigue vigente, un fallo de Firestore no debe secuestrar toda la
      // aplicación. Se usa el último perfil válido o, solo en desarrollo, el
      // perfil administrador de compatibilidad.
      if (auth.currentUser?.uid === user.uid) {
        const fallback = resolveFallbackProfile(user, err?.code || err?.message || 'error desconocido');
        if (fallback) return fallback;
      }

      console.error('Error cargando perfil:', err);
      // En producción, si no existe perfil válido ni caché, cerramos Auth de
      // forma limpia para evitar el bucle /login <-> /dashboard.
      if (!import.meta.env.DEV && auth.currentUser?.uid === user.uid) {
        await signOut(auth);
        clearCachedProfile(user.uid);
        setUserProfile(null);
      }
      throw err;
    }
  }, [resolveFallbackProfile]);

  async function login(email, password) {
    await authPersistenceReady;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadUserProfile(credential.user);

    if (profile && !profile._compatibilityFallback) {
      try {
        await addLog({ usuario: profile.nombre || email, accion: 'inicio_sesion', detalle: email });
      } catch (error) {
        console.warn('No se pudo registrar el inicio de sesión:', error);
      }
    }

    return credential;
  }

  const logout = useCallback(async (motivo = 'manual') => {
    const uid = currentUser?.uid;

    if (userProfile && !userProfile._compatibilityFallback) {
      try {
        await addLog({
          usuario: userProfile.nombre || currentUser?.email,
          accion: 'cierre_sesion',
          detalle: motivo
        });
      } catch (e) {
        console.warn('No se pudo registrar log de cierre de sesión:', e);
      }
    }

    await signOut(auth);
    setUserProfile(null);

    // El cierre manual limpia también el respaldo local. En el próximo login se
    // vuelve a consultar Firestore y no se conserva un rol antiguo indefinidamente.
    if (motivo === 'manual') clearCachedProfile(uid);
  }, [currentUser, userProfile]);

  const refreshProfile = useCallback(async () => {
    if (!currentUser) return null;

    try {
      return await loadUserProfile(currentUser);
    } catch (err) {
      console.error('No se pudo actualizar el perfil:', err);
      return userProfile;
    }
  }, [currentUser, loadUserProfile, userProfile]);

  useEffect(() => {
    let mounted = true;

    authPersistenceReady.finally(() => {
      if (!mounted) return;

      unsubscribeRef.current = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return;
        setCurrentUser(user);

        if (!user) {
          setUserProfile(null);
          setLoading(false);
          return;
        }

        try {
          await loadUserProfile(user);
        } catch (err) {
          // Si llegamos aquí en producción no existe un perfil válido ni caché.
          // No mostramos una pantalla intermedia irresoluble: Auth/loadUserProfile
          // decide si corresponde cerrar sesión y React vuelve al login normal.
          console.error('No se pudo establecer un perfil válido para la sesión:', err);
        } finally {
          if (mounted) setLoading(false);
        }
      });
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [loadUserProfile]);

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    logout,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <Loading message="Verificando sesión..." /> : children}
    </AuthContext.Provider>
  );
}
