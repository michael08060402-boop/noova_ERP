import { db } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, deleteField,
  query, orderBy, where
} from 'firebase/firestore';

const COLLECTION_NAME = 'epp';

// El catálogo EPP ya no maneja estado activo/inactivo. Los registros antiguos
// pueden conservar ese campo en Firestore, pero el frontend lo ignora y al
// editar un EPP se elimina del documento.
function sinEstadoActivo(data = {}) {
  const resto = { ...data };
  delete resto.activo;
  return resto;
}

export async function getEpp() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('codigo', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...sinEstadoActivo(item.data()) }));
}

export async function getEppById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...sinEstadoActivo(snapshot.data()) };
  }
  return null;
}

export async function searchEppByCodigo(codigo) {
  const q = query(collection(db, COLLECTION_NAME), where('codigo', '==', codigo));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const encontrado = snapshot.docs[0];
    return { id: encontrado.id, ...sinEstadoActivo(encontrado.data()) };
  }
  return null;
}

export async function createEpp(data) {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...sinEstadoActivo(data),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateEpp(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...sinEstadoActivo(data),
    activo: deleteField(),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteEpp(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
