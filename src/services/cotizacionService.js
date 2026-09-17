import { auth, db } from '../firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const COLLECTION_NAME = 'cotizaciones';

function limpiarPrefijo(valor) {
  return String(valor || 'NV').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) || 'NV';
}

// opciones.soloEpp: usado por el rol Jefe de Proyecto de Mina. Las reglas de
// Firestore solo le permiten leer cotizaciones con tipoItem == 'epp' y, como
// las rules NO actúan como filtros, la consulta debe incluir el where
// explícito para no fallar. Las solicitudes se ordenan en memoria por fecha,
// así no necesitan un correlativo ni un índice compuesto adicional.
export async function getCotizaciones(opciones = {}) {
  const { soloEpp = false } = opciones;
  const base = collection(db, COLLECTION_NAME);
  const q = soloEpp
    ? query(base, where('tipoItem', '==', 'epp'))
    : query(base, orderBy('codigo', 'desc'));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (soloEpp) {
    data.sort((a, b) => String(b.createdAt || b.fechaEmision || '').localeCompare(String(a.createdAt || a.fechaEmision || '')));
  }
  return data;
}

export async function getCotizacionById(id) {
  const snapshot = await getDoc(doc(db, COLLECTION_NAME, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createCotizacion(data) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Debes iniciar sesión para crear una cotización');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('La cotización debe contener al menos un ítem');
  }

  // Solicitud: escritura directa con ID único. No actualiza el documento
  // global de Configuración, por lo que Jefe de Proyecto de Mina puede crearla
  // con sus permisos EPP sin recibir "permission-denied" por el correlativo.
  if (data.tipoItem === 'epp' && data.esSolicitudCotizacion === true) {
    const ref = doc(collection(db, COLLECTION_NAME));
    const ahoraIso = new Date().toISOString();

    await setDoc(ref, {
      ...data,
      creadoPorUid: usuario.uid,
      creadoPorNombre: data.responsable || usuario.email || usuario.uid,
      createdAt: ahoraIso,
      updatedAt: ahoraIso
    });

    return { id: ref.id };
  }

  // Cotización comercial: conserva el correlativo configurado de NOOVA.
  const configRef = doc(db, 'configuracion', 'general');
  return runTransaction(db, async (tx) => {
    const configSnap = await tx.get(configRef);
    const config = configSnap.exists() ? configSnap.data() : {};
    const actual = {
      prefijo: 'NV',
      longitud: 7,
      proximoNumero: 1000001,
      ...(config.cotizacion || {})
    };
    const prefijo = limpiarPrefijo(actual.prefijo);
    const longitud = Math.min(12, Math.max(1, Number(actual.longitud) || 7));
    let numero = Math.max(1, Math.trunc(Number(actual.proximoNumero) || 1000001));
    let codigo = `${prefijo}${String(numero).padStart(longitud, '0')}`;
    let ref = doc(db, COLLECTION_NAME, codigo);

    for (let intentos = 0; intentos < 100; intentos += 1) {
      const existente = await tx.get(ref);
      if (!existente.exists()) break;
      numero += 1;
      codigo = `${prefijo}${String(numero).padStart(longitud, '0')}`;
      ref = doc(db, COLLECTION_NAME, codigo);
      if (intentos === 99) throw new Error('No se pudo reservar un correlativo único para la cotización');
    }

    const ahora = new Date().toISOString();
    tx.set(ref, {
      ...data,
      codigo,
      creadoPorUid: usuario.uid,
      creadoPorNombre: data.elaboradoPor || usuario.email || usuario.uid,
      createdAt: ahora,
      updatedAt: ahora
    });
    tx.set(configRef, {
      cotizacion: {
        ...actual,
        prefijo,
        longitud,
        ultimoCorrelativo: codigo,
        proximoNumero: numero + 1
      },
      updatedAt: ahora
    }, { merge: true });
    return { id: ref.id, codigo };
  });
}

export async function updateCotizacion(id, data) {
  await updateDoc(doc(db, COLLECTION_NAME, id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteCotizacion(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
