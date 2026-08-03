import { db, functions } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const COLLECTION_NAME = 'solicitudesCotizacion';
const CONTADOR_REF = ['contadores', 'solicitudesCotizacion'];
const PREFIJO = 'SC';

// Genera el siguiente correlativo de forma atómica: SC-2026-0001
async function generarCodigo() {
  const anio = new Date().getFullYear();
  const contadorDoc = doc(db, ...CONTADOR_REF);

  const siguiente = await runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorDoc);
    const data = snap.exists() ? snap.data() : {};
    const anioGuardado = data.anio === anio ? anio : anio;
    const actual = data.anio === anio ? (Number(data.ultimo) || 0) : 0;
    const nuevo = actual + 1;
    tx.set(contadorDoc, { anio: anioGuardado, ultimo: nuevo, updatedAt: new Date().toISOString() });
    return nuevo;
  });

  return `${PREFIJO}-${anio}-${String(siguiente).padStart(4, '0')}`;
}

export async function getSolicitudes() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getSolicitudById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

export async function createSolicitud(data) {
  const codigo = await generarCodigo();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    codigo,
    estado: data.estado || 'Borrador',
    historialEnvios: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { id: docRef.id, codigo };
}

export async function updateSolicitud(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteSolicitud(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

// Envía la solicitud de cotización al proveedor por correo (Microsoft Graph,
// vía Cloud Function). Actualiza estado e historial en el propio backend.
export async function enviarSolicitudPorCorreo({ solicitudId, destinatarios, cc, asunto, cuerpoHtml }) {
  const fn = httpsCallable(functions, 'solicitudCotizacionEnviarCorreo');
  const resultado = await fn({ solicitudId, destinatarios, cc, asunto, cuerpoHtml });
  return resultado.data;
}
