import { db } from '../firebase/config';
import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  AREAS,
  ROLES,
  FAMILIAS_COTIZACION,
  normalizarRol,
  normalizarArea,
  esRolValido,
  puede,
  tienePermiso,
  puedeConfiguracion,
  puedeEditarConfiguracion,
  getRutaInicial,
  getCarpetaNube,
  getAreaPredeterminada,
  getNombreArea,
  esRolMinas
} from './accessControl';

export {
  AREAS,
  ROLES,
  FAMILIAS_COTIZACION,
  normalizarRol,
  normalizarArea,
  esRolValido,
  puede,
  tienePermiso,
  puedeConfiguracion,
  puedeEditarConfiguracion,
  getRutaInicial,
  getCarpetaNube,
  getAreaPredeterminada,
  esRolMinas
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
  const area = getAreaPredeterminada(role)
    || normalizarArea(data.area)
    || normalizarArea(data.sector)
    || '';

  return {
    uid,
    ...PERFIL_DEFECTO,
    ...data,
    role,
    area
  };
}

export async function updateUserProfile(uid, data) {
  const docRef = doc(db, COLECCION, uid);
  const payload = { ...data, updatedAt: new Date().toISOString() };

  delete payload.permissions;

  if ('role' in payload) payload.role = normalizarRol(payload.role);
  if ('role' in payload) {
    if (!esRolValido(payload.role)) throw new Error('El rol seleccionado no es válido');
    payload.area = getAreaPredeterminada(payload.role);
    payload.sector = getNombreArea(payload.area);
    payload.permissions = deleteField();
  } else if ('area' in payload) {
    payload.area = normalizarArea(payload.area);
  }

  await updateDoc(docRef, payload);
}
