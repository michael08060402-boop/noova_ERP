import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, authPersistenceReady } from '../firebase/config';
import { getUserProfile } from '../services/userService';
import { addLog } from '../services/logService';
import Loading from '../components/Loading';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef(null);

  const loadUserProfile = useCallback(async (user) => {
    if (!user) {
      setUserProfile(null);
      return null;
    }

    try {
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        await signOut(auth);
        throw new Error('Tu cuenta no tiene un perfil habilitado en el ERP. Solicita acceso a un administrador.');
      }

      if (profile.activo === false) {
        await signOut(auth);
        setUserProfile(null);
        return null;
      }

      if (!profile.role || profile.role === 'sin_acceso') {
        await signOut(auth);
        throw new Error('Tu cuenta todavía no tiene un rol con acceso al ERP.');
      }

      setUserProfile(profile);
      return profile;
    } catch (err) {
      // Sin un perfil vigente de Firestore no se conserva ni se inventa una
      // autorización local: se cierra la sesión de forma segura.
      if (auth.currentUser?.uid === user.uid) {
        await signOut(auth);
        setUserProfile(null);
      }
      console.error('Error cargando perfil:', err);
      throw err;
    }
  }, []);

  async function login(email, password) {
    await authPersistenceReady;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadUserProfile(credential.user);

    if (profile) {
      try {
        await addLog({ usuario: profile.nombre || email, accion: 'inicio_sesion', detalle: email });
      } catch (error) {
        console.warn('No se pudo registrar el inicio de sesión:', error);
      }
    }

    return credential;
  }

  const logout = useCallback(async (motivo = 'manual') => {
    if (userProfile) {
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
          // Auth/loadUserProfile cierra la sesión si no existe un perfil válido.
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
