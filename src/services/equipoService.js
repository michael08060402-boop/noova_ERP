import { db } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where
} from 'firebase/firestore';

const COLLECTION_NAME = 'equipos';

export async function getEquipos() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('codigo', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getEquipoById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

export async function searchEquipoByCodigo(codigo) {
  const q = query(collection(db, COLLECTION_NAME), where('codigo', '==', codigo));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
  return null;
}

export async function createEquipo(data) {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateEquipo(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteEquipo(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
