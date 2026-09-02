import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ROLES, MODULOS, getPermisosUsuario, tienePermiso, normalizarRol } from './accessControl';

export { ROLES, MODULOS, getPermisosUsuario, tienePermiso, normalizarRol };

const COLECCION = 'users';

const PERFIL_DEFECTO = {
  nombre: '',
  cargo: '',
  telefono: '',
  role: 'sin_acceso',
  sector: 'Sin asignar',
  permissions: null,
  activo: true
};

export async function getUserProfile(uid) {
  const docRef = doc(db, COLECCION, uid);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { uid, ...PERFIL_DEFECTO, ...snapshot.data() };
  }
  return null;
}

export async function createUserProfile(uid, data = {}) {
  const perfil = {
    ...PERFIL_DEFECTO,
    ...data,
    email: data.email || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, COLECCION, uid), perfil);
  return { uid, ...perfil };
}

export async function updateUserProfile(uid, data) {
  const docRef = doc(db, COLECCION, uid);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}
