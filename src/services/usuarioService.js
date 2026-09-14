import { db, functions } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ROLES,
  esRolValido,
  normalizarRol,
  normalizarArea,
  getAreaPredeterminada,
  updateUserProfile
} from './userService';

const COLECCION = 'users';

export async function getUsuarios() {
  const q = query(collection(db, COLECCION), orderBy('nombre', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((documento) => {
    const data = documento.data();
    const role = normalizarRol(data.role);
    const area = getAreaPredeterminada(role)
      || normalizarArea(data.area)
      || normalizarArea(data.sector)
      || '';

    return {
      uid: documento.id,
      ...data,
      role,
      area
    };
  });
}

export async function crearUsuario({
  email,
  password,
  nombre,
  cargo,
  telefono,
  role,
  area
}) {
  const roleNormalizado = normalizarRol(role);
  if (!esRolValido(roleNormalizado)) {
    throw new Error('El rol seleccionado no es válido');
  }

  const areaNormalizada = normalizarArea(area)
    || getAreaPredeterminada(roleNormalizado);

  const fn = httpsCallable(functions, 'usuariosCrear');
  const resultado = await fn({
    email,
    password,
    nombre,
    cargo,
    telefono,
    role: roleNormalizado,
    area: getAreaPredeterminada(roleNormalizado) || areaNormalizada
  });

  return resultado.data;
}

export async function cambiarRolUsuario(uid, role) {
  const roleNormalizado = normalizarRol(role);

  if (!ROLES[roleNormalizado]) {
    throw new Error('El rol seleccionado no es válido');
  }

  const area = getAreaPredeterminada(roleNormalizado);
  await updateUserProfile(uid, { role: roleNormalizado, area });
  return { role: roleNormalizado, area };
}

export async function cambiarDatosUsuario(uid, {
  nombre,
  cargo,
  telefono
}) {
  await updateUserProfile(uid, {
    nombre,
    cargo,
    telefono
  });
}

export async function cambiarEstadoUsuario(uid, activo) {
  const fn = httpsCallable(functions, 'usuariosCambiarEstado');
  const resultado = await fn({ uid, activo });
  return resultado.data;
}

export async function resetearPasswordUsuario(uid, nuevaPassword) {
  const fn = httpsCallable(functions, 'usuariosResetearPassword');
  const resultado = await fn({ uid, nuevaPassword });
  return resultado.data;
}
