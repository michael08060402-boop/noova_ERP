import { auth, db, functions } from '../firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

function sinControles(valor) {
  return Array.from(String(valor || '')).filter((caracter) => {
    const codigo = caracter.codePointAt(0);
    return codigo === 9 || codigo === 10 || codigo === 13 || (codigo >= 32 && codigo !== 127);
  }).join('');
}

function limpiar(valor, maximo = 5000) {
  return sinControles(valor).trim().slice(0, maximo);
}

function normalizarSolicitud(data = {}) {
  const proveedorEmail = limpiar(data.proveedorEmail, 250).toLowerCase();
  const detalle = limpiar(data.detalle, 5000);
  if (!proveedorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedorEmail)) {
    throw new Error('El correo del proveedor no es válido');
  }
  if (!detalle) throw new Error('El detalle de la solicitud es obligatorio');
  return {
    tipo: limpiar(data.tipo || 'Otro', 80),
    proveedorId: limpiar(data.proveedorId, 150),
    proveedorNombre: limpiar(data.proveedorNombre, 250),
    proveedorEmail,
    fechaLimite: limpiar(data.fechaLimite, 30),
    detalle
  };
}

export async function getSolicitudes() {
  const q = query(collection(db, 'solicitudesCotizacion'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSolicitudById(id) {
  const solicitudes = await getSolicitudes();
  return solicitudes.find((s) => s.id === id) || null;
}

export async function createSolicitud(data) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Debes iniciar sesión para crear una solicitud');
  const solicitud = normalizarSolicitud(data);
  const contadorRef = doc(db, 'contadores', 'solicitudesCotizacion');
  const ref = doc(collection(db, 'solicitudesCotizacion'));
  const anio = new Date().getFullYear();

  return runTransaction(db, async (tx) => {
    const contadorSnap = await tx.get(contadorRef);
    const contador = contadorSnap.exists() ? contadorSnap.data() : {};
    const actual = contador.anio === anio ? Number(contador.ultimo) || 0 : 0;
    const siguiente = actual + 1;
    const codigo = `SC-${anio}-${String(siguiente).padStart(4, '0')}`;
    const ahora = new Date().toISOString();
    tx.set(contadorRef, { anio, ultimo: siguiente, updatedAt: ahora }, { merge: true });
    tx.set(ref, {
      ...solicitud,
      codigo,
      estado: 'Borrador',
      historialEnvios: [],
      creadoPorUid: usuario.uid,
      creadoPorNombre: usuario.email || usuario.uid,
      createdAt: ahora,
      updatedAt: ahora
    });
    return { id: ref.id, codigo };
  });
}

export async function updateSolicitud(id, data) {
  const solicitud = normalizarSolicitud(data);
  await updateDoc(doc(db, 'solicitudesCotizacion', id), { ...solicitud, updatedAt: new Date().toISOString() });
}

export async function deleteSolicitud(id) {
  await deleteDoc(doc(db, 'solicitudesCotizacion', id));
}

export async function enviarSolicitudPorCorreo({ solicitudId, destinatarios, cc, asunto, cuerpoHtml }) {
  try {
    const callable = httpsCallable(functions, 'solicitudCotizacionEnviarCorreo');
    const result = await callable({ solicitudId, destinatarios, cc, asunto, cuerpoHtml });
    return result.data;
  } catch (error) {
    const code = String(error?.code || '');
    const mensaje = String(error?.message || '');
    if (code.includes('not-found') || code.includes('internal') || code.includes('unavailable')) {
      throw new Error(mensaje && !/internal/i.test(mensaje)
        ? mensaje
        : 'El envío por Microsoft Graph todavía no está habilitado. Configura los secretos GRAPH_* y despliega la Function de correo.');
    }
    throw new Error(mensaje || 'No se pudo enviar la solicitud por correo');
  }
}
