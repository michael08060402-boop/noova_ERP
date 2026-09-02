import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'proveedores';
const DEMO_ID = 'instruments-labs-testo-demo';
const DEMO = {
  razonSocial: 'INSTRUMENTS LABS / TESTO (DEMO)',
  ruc: '',
  contacto: 'Completar datos reales',
  direccion: '',
  telefono: '',
  email: '',
  activo: true,
  esDemo: true,
  notaInterna: 'Proveedor inicial de prueba. Editar con los datos comerciales reales antes de emitir una OC definitiva.'
};

function limpiar(valor, maximo = 300) {
  return String(valor || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maximo);
}

function normalizarProveedor(data = {}) {
  const razonSocial = limpiar(data.razonSocial, 180);
  if (!razonSocial) throw new Error('La razón social del proveedor es obligatoria');
  return {
    razonSocial,
    ruc: limpiar(data.ruc, 20),
    contacto: limpiar(data.contacto, 120),
    direccion: limpiar(data.direccion, 300),
    telefono: limpiar(data.telefono || data.celular, 30),
    email: limpiar(data.email, 160).toLowerCase(),
    activo: data.activo !== false,
    notaInterna: limpiar(data.notaInterna, 500),
    esDemo: data.esDemo === true
  };
}

async function asegurarDemo() {
  const ref = doc(db, COLLECTION_NAME, DEMO_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const ahora = new Date().toISOString();
  await setDoc(ref, { ...DEMO, createdAt: ahora, updatedAt: ahora });
}

export async function getProveedores() {
  await asegurarDemo();
  const q = query(collection(db, COLLECTION_NAME), orderBy('razonSocial', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProveedorById(id) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProveedor(data) {
  const proveedor = normalizarProveedor(data);
  const ahora = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    ...proveedor,
    esDemo: false,
    createdAt: ahora,
    updatedAt: ahora
  });
  return ref.id;
}

export async function updateProveedor(id, data) {
  const proveedor = normalizarProveedor(data);
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...proveedor,
    esDemo: false,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteProveedor(id) {
  const usada = await getDocs(query(
    collection(db, 'ordenesCompra'),
    where('proveedorId', '==', id),
    limit(1)
  ));
  if (!usada.empty) {
    throw new Error('No puedes eliminar un proveedor que ya está asociado a una orden de compra. Desactívalo en su lugar.');
  }
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
