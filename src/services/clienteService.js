import { db } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy
} from 'firebase/firestore';

const COLLECTION_NAME = 'clientes';

export async function getClientes() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('razonSocial', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getClienteById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

export async function createCliente(data) {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateCliente(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteCliente(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
