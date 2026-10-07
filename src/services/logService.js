import { db, functions } from '../firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const COLLECTION = 'logs';

export async function addLog({ accion, detalle = '' }) {
  const crearLog = httpsCallable(functions, 'logsCrear');
  await crearLog({ accion, detalle });
}

export async function getLogs(limitCount = 100) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
