import { collection, deleteField, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLECCION = 'avatares';

export async function getAvatares() {
  const snapshot = await getDocs(collection(db, COLECCION));
  return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function guardarAvatar(uid, { nombre, email, foto }) {
  const datos = {
    nombre: String(nombre || '').slice(0, 100),
    email: String(email || '').trim().toLowerCase().slice(0, 120),
    updatedAt: serverTimestamp()
  };
  if (foto !== undefined) datos.foto = foto || deleteField();
  await setDoc(doc(db, COLECCION, uid), datos, { merge: true });
}
