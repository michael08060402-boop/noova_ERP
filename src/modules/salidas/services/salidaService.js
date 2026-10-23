import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { aBase64, desdeBase64 } from '../../../utils/base64';
import { claveGuia, formatearGuia } from '../utils/salida';

const COLECCION = 'salidasGuias';
const MAX_HISTORIAL = 50;
const MAX_ARCHIVO = 700 * 1024;

function limpiar(datos) {
  return JSON.parse(JSON.stringify(datos));
}

function datosGuardables(salida) {
  const { guia, formato, items, origen, documento, estado } = salida;
  return limpiar({ guia, formato, items, origen, documento: documento || null, estado });
}

function refArchivo(id) {
  return doc(db, COLECCION, id, 'archivos', 'guia');
}

// El proyecto no usa Firebase Storage: la guía (unos KB) se guarda en un documento aparte para no cargarla con la lista.
export async function guardarArchivoGuia(id, archivo) {
  if (!archivo?.bytes || archivo.bytes.length > MAX_ARCHIVO) return;
  await setDoc(refArchivo(id), { nombre: archivo.nombre, tipo: archivo.tipo, datos: aBase64(archivo.bytes) });
}

export async function leerArchivoGuia(id) {
  const snapshot = await getDoc(refArchivo(id));
  if (!snapshot.exists()) return null;
  const { nombre, tipo, datos } = snapshot.data();
  return { nombre, tipo, bytes: desdeBase64(datos) };
}

function entradaHistorial(accion, usuario) {
  return { accion, usuario: usuario || '', fecha: new Date().toISOString() };
}

function aMilis(valor) {
  return valor?.toMillis?.() ?? (valor ? new Date(valor).getTime() : 0);
}

export async function getSalidas() {
  const snapshot = await getDocs(collection(db, COLECCION));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => aMilis(b.actualizadoEn) - aMilis(a.actualizadoEn));
}

async function verificarDuplicado(clave, excluirId) {
  if (!clave) throw new Error('Completa el tipo, la serie y el número de la guía.');
  const snapshot = await getDocs(query(collection(db, COLECCION), where('claveGuia', '==', clave)));
  const otro = snapshot.docs.find((d) => d.id !== excluirId);
  if (otro) throw new Error(`La guía ${formatearGuia(otro.data().guia)} ya está registrada.`);
}

export async function crearSalidaGuia(salida, usuario) {
  const clave = claveGuia(salida.guia);
  await verificarDuplicado(clave);
  const ref = await addDoc(collection(db, COLECCION), {
    ...datosGuardables(salida),
    claveGuia: clave,
    version: 1,
    creadoPor: usuario || '',
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    historial: [entradaHistorial(salida.origen === 'pdf' ? 'importado' : 'creado', usuario)]
  });
  return ref.id;
}

export async function actualizarSalidaGuia(id, salida, { usuario, accion = 'editado', versionEsperada }) {
  const clave = claveGuia(salida.guia);
  await verificarDuplicado(clave, id);
  const ref = doc(db, COLECCION, id);
  return runTransaction(db, async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists()) throw new Error('El registro ya no existe.');
    const version = actual.data().version || 0;
    if (versionEsperada !== undefined && version !== versionEsperada) {
      throw new Error('Otra persona modificó este registro mientras lo editabas. Recarga para ver los cambios.');
    }
    const historial = [...(actual.data().historial || []), entradaHistorial(accion, usuario)].slice(-MAX_HISTORIAL);
    const cambios = {
      ...datosGuardables(salida),
      claveGuia: clave,
      version: version + 1,
      actualizadoEn: serverTimestamp(),
      historial
    };
    if (accion === 'exportado') cambios.exportadoEn = serverTimestamp();
    tx.update(ref, cambios);
    return version + 1;
  });
}

export async function eliminarSalidaGuia(id) {
  await deleteDoc(refArchivo(id));
  await deleteDoc(doc(db, COLECCION, id));
}
