import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLECCION = 'plantillasSolicitud';

export async function getPlantillasGuardadas() {
  const snapshot = await getDocs(collection(db, COLECCION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function guardarPlantilla(plantilla) {
  const { id, nombre, descripcion, icono, orden, activa, bloques } = plantilla;
  const ref = id ? doc(db, COLECCION, id) : doc(collection(db, COLECCION));
  const datos = JSON.parse(JSON.stringify({ nombre, descripcion, icono, orden, activa, bloques }));
  await setDoc(ref, { ...datos, updatedAt: new Date().toISOString() });
  return ref.id;
}

export async function eliminarPlantilla(id) {
  await deleteDoc(doc(db, COLECCION, id));
}
