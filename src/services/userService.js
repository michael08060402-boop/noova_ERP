import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  AREAS,
  ROLES,
  MODULOS,
  SECCIONES_CONFIGURACION,
  normalizarRol,
  normalizarArea,
  esRolValido,
  esUsuarioActivo,
  puede,
  tienePermiso,
  getPermisosUsuario,
  puedeConfiguracion,
  puedeEditarConfiguracion,
  puedeGestionarUsuarios,
  getRutaInicial,
  getCarpetaNube,
  getAreaPredeterminada,
  getNombreArea
} from './accessControl';

export {
  AREAS,
  ROLES,
  MODULOS,
  SECCIONES_CONFIGURACION,
  normalizarRol,
  normalizarArea,
  esRolValido,
  esUsuarioActivo,
  puede,
  tienePermiso,
  getPermisosUsuario,
  puedeConfiguracion,
  puedeEditarConfiguracion,
  puedeGestionarUsuarios,
  getRutaInicial,
  getCarpetaNube,
  getAreaPredeterminada,
  getNombreArea
};

const COLECCION = 'users';

const PERFIL_DEFECTO = {
  nombre: '',
  cargo: '',
  telefono: '',
  role: '',
  area: '',
  activo: true
};

export async function getUserProfile(uid) {
  const docRef = doc(db, COLECCION, uid);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const role = normalizarRol(data.role);
  const area = normalizarArea(data.area)
    || normalizarArea(data.sector)
    || getAreaPredeterminada(role);

  return {
    uid,
    ...PERFIL_DEFECTO,
    ...data,
    role,
    area
  };
}

export async function createUserProfile(uid, data = {}) {
  const role = normalizarRol(data.role);
  const area = normalizarArea(data.area) || getAreaPredeterminada(role);

  const perfil = {
    ...PERFIL_DEFECTO,
    ...data,
    role,
    area,
    email: data.email || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // `permissions` ya no se persiste como fuente de autorización.
  delete perfil.permissions;

  await setDoc(doc(db, COLECCION, uid), perfil);
  return { uid, ...perfil };
}

export async function updateUserProfile(uid, data) {
  const docRef = doc(db, COLECCION, uid);
  const payload = { ...data, updatedAt: new Date().toISOString() };

  // Evita volver a introducir permisos planos legacy desde formularios viejos.
  delete payload.permissions;

  if ('role' in payload) payload.role = normalizarRol(payload.role);
  if ('area' in payload) payload.area = normalizarArea(payload.area);

  await updateDoc(docRef, payload);
}
