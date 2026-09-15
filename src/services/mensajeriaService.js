import { db } from '../firebase/config';
import {
  collection, addDoc, query, orderBy, limit, getDocs, where,
  writeBatch
} from 'firebase/firestore';
import { sanitizarParaLog, sanitizarTexto } from '../utils/validation';

const COLLECTION = 'mensajeria';

/**
 * Registra la apertura solicitada de WhatsApp o correo, no la entrega del mensaje.
 */
export async function registrarEnvioMensaje({
  usuarioId,
  usuarioNombre,
  clienteId,
  clienteNombre,
  contactoNombre,
  numeroDestino,
  correoDestino = '',
  canal = 'whatsapp',
  asunto = '',
  mensajeCompleto,
  mensajePreview,
  plantillaId = null
}) {
  const now = new Date();

  await addDoc(collection(db, COLLECTION), {
    usuarioId: sanitizarParaLog(usuarioId),
    usuarioNombre: sanitizarParaLog(usuarioNombre),
    clienteId: sanitizarParaLog(clienteId),
    clienteNombre: sanitizarParaLog(clienteNombre),
    contactoNombre: sanitizarParaLog(contactoNombre),
    numeroDestino: sanitizarParaLog(numeroDestino),
    canal: canal === 'correo' ? 'correo' : 'whatsapp',
    correoDestino: sanitizarParaLog(correoDestino),
    asunto: sanitizarTexto(asunto, 160).replace(/[\r\n]/g, ' '),
    mensajeCompleto: sanitizarTexto(mensajeCompleto, 4000),
    // Preview corto para listados
    mensajePreview: sanitizarParaLog(mensajePreview || mensajeCompleto).slice(0, 120),
    plantillaId: plantillaId ? sanitizarParaLog(plantillaId) : null,
    fecha: now.toISOString().split('T')[0],
    hora: now.toLocaleTimeString('es-PE', { hour12: false }),
    createdAt: now.toISOString(),
    estado: 'apertura_solicitada'
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
 * Elimina exactamente los documentos presentes al confirmar la limpieza.
 * El historial es compartido; las reglas existentes verifican el permiso.
 * Los mensajes creados después de esta lectura no se eliminan.
 */
export async function limpiarHistorialMensajes() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  let eliminados = 0;
  try {
    for (let inicio = 0; inicio < snapshot.docs.length; inicio += 400) {
      const lote = snapshot.docs.slice(inicio, inicio + 400);
      const batch = writeBatch(db);
      lote.forEach(registro => batch.delete(registro.ref));
      await batch.commit();
      eliminados += lote.length;
    }
    return eliminados;
  } catch (error) {
    error.eliminados = eliminados;
    throw error;
  }
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
