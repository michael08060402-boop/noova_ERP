import { db } from '../firebase/config';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

const COLLECTION = 'logs';

// Registra una acción en la colección de logs (append-only).
export async function addLog({ usuario, accion, detalle = '' }) {
  const now = new Date();
  await addDoc(collection(db, COLLECTION), {
    usuario,
    accion,
    detalle,
    fecha: now.toISOString().split('T')[0],
    hora: now.toLocaleTimeString('es-PE', { hour12: false }),
    createdAt: now.toISOString()
  });
}

export async function getLogs(limitCount = 100) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
