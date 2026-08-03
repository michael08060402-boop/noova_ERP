import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const COLECCION = 'users';

const PERFIL_DEFECTO = {
  nombre: '',
  cargo: '',
  telefono: '',
  role: 'comercial',
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

// Roles disponibles y los módulos a los que tiene acceso cada uno.
// nubeCarpeta: null = ve todo el drive (raíz). Si tiene un nombre, el rol
// queda "encerrado" en esa carpeta del drive (no puede subir/ver fuera de ahí).
// puedeCotizar: controla el acceso a Cotizaciones/Compras/Facturación además
// de lo que ya filtra navItems (doble seguro por si se navega directo a la URL).
export const ROLES = {
  administrador: {
    label: 'Administrador',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'compras', 'facturacion', 'nube', 'usuarios', 'configuracion'],
    nubeCarpeta: null,
    puedeCotizar: true
  },
  gerencia: {
    label: 'Gerencia',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'compras', 'facturacion', 'nube', 'usuarios', 'configuracion'],
    nubeCarpeta: null,
    puedeCotizar: true
  },
  comercial: {
    label: 'Comercial',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'compras', 'facturacion', 'nube'],
    nubeCarpeta: null,
    puedeCotizar: true
  },
  operaciones: {
    label: 'Operaciones',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'mensajeria', 'compras', 'nube'],
    nubeCarpeta: 'Operaciones',
    puedeCotizar: false
  },
  marketing: {
    label: 'Marketing',
    navItems: ['dashboard', 'mensajeria', 'nube'],
    nubeCarpeta: 'Marketing',
    puedeCotizar: false
  },
  sistemas: {
    label: 'Sistemas',
    navItems: ['dashboard', 'nube', 'usuarios'],
    nubeCarpeta: 'Sistemas',
    puedeCotizar: false
  },
  ing_minas: {
    label: 'Ingeniería de Minas',
    navItems: ['dashboard', 'mensajeria', 'nube'],
    nubeCarpeta: 'Ingeniería de Minas',
    puedeCotizar: false
  }
};
