import { db } from '../firebase/config';
import {
  collection, addDoc, query, orderBy, limit, getDocs, where,
  doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { sanitizarParaLog } from '../utils/validation';

const COLLECTION = 'mensajeria';

/**
 * Registra un envío de WhatsApp en el historial.
 * Si `programadoPara` es una fecha futura, se marca como 'pendiente'
 * y el worker local lo abrirá automáticamente cuando llegue la hora.
 */
export async function registrarEnvioMensaje({
  usuarioId,
  usuarioNombre,
  clienteId,
  clienteNombre,
  contactoNombre,
  numeroDestino,
  mensajeCompleto,
  mensajePreview,
  plantillaId = null,
  programadoPara = null
}) {
  const now = new Date();
  const fechaProgramada = programadoPara ? new Date(programadoPara) : null;
  const esProgramado = fechaProgramada && fechaProgramada > now;

  await addDoc(collection(db, COLLECTION), {
    usuarioId: sanitizarParaLog(usuarioId),
    usuarioNombre: sanitizarParaLog(usuarioNombre),
    clienteId: sanitizarParaLog(clienteId),
    clienteNombre: sanitizarParaLog(clienteNombre),
    contactoNombre: sanitizarParaLog(contactoNombre),
    numeroDestino: sanitizarParaLog(numeroDestino),
    // Mensaje completo (necesario para reproducir envíos programados)
    mensajeCompleto: sanitizarParaLog(mensajeCompleto).slice(0, 4000),
    // Preview corto para listados
    mensajePreview: sanitizarParaLog(mensajePreview || mensajeCompleto).slice(0, 120),
    plantillaId: plantillaId ? sanitizarParaLog(plantillaId) : null,
    fecha: now.toISOString().split('T')[0],
    hora: now.toLocaleTimeString('es-PE', { hour12: false }),
    createdAt: now.toISOString(),
    // Campos de programación
    programado: !!esProgramado,
    programadoPara: esProgramado ? fechaProgramada.toISOString() : null,
    estado: esProgramado ? 'pendiente' : 'enviado',
    enviadoEn: esProgramado ? null : now.toISOString()
  });
}

/**
 * Obtiene el historial reciente de envíos.
 */
export async function getHistorialMensajes(limitCount = 50) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Obtiene los envíos programados pendientes (estado = 'pendiente').
 * Opcionalmente filtra por usuario.
 */
export async function getEnviosProgramados(usuarioId = null, limitCount = 50) {
  let q;
  if (usuarioId) {
    q = query(
      collection(db, COLLECTION),
      where('estado', '==', 'pendiente'),
      where('usuarioId', '==', usuarioId),
      orderBy('programadoPara', 'asc'),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, COLLECTION),
      where('estado', '==', 'pendiente'),
      orderBy('programadoPara', 'asc'),
      limit(limitCount)
    );
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Marca un envío programado como enviado.
 */
export async function marcarComoEnviado(envioId) {
  const now = new Date();
  await updateDoc(doc(db, COLLECTION, envioId), {
    estado: 'enviado',
    enviadoEn: now.toISOString()
  });
}

/**
 * Cancela (elimina) un envío programado pendiente.
 */
export async function cancelarEnvioProgramado(envioId) {
  await deleteDoc(doc(db, COLLECTION, envioId));
}

/**
 * Obtiene el historial de envíos de un cliente específico.
 */
export async function getHistorialByCliente(clienteId, limitCount = 20) {
  const q = query(
    collection(db, COLLECTION),
    where('clienteId', '==', clienteId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
