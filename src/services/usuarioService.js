import { db, functions } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { updateUserProfile } from './userService';

const COLECCION = 'users';

export async function getUsuarios() {
  const q = query(collection(db, COLECCION), orderBy('nombre', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

export async function crearUsuario({ email, password, nombre, cargo, telefono, role }) {
  const fn = httpsCallable(functions, 'usuariosCrear');
  const resultado = await fn({ email, password, nombre, cargo, telefono, role });
  return resultado.data;
}

export async function cambiarRolUsuario(uid, role) {
  await updateUserProfile(uid, { role });
}

export async function cambiarDatosUsuario(uid, { nombre, cargo, telefono }) {
  await updateUserProfile(uid, { nombre, cargo, telefono });
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
