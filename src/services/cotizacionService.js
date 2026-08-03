import { db } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where
} from 'firebase/firestore';
import { getConfig, updateConfig } from './configService';

const COLLECTION_NAME = 'cotizaciones';

export async function getCotizaciones() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('codigo', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getCotizacionById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

// ============================================================
// GENERACIÓN DE CÓDIGO CORRELATIVO DE COTIZACIÓN
// ============================================================
// Lee la configuración (colección configuracion/general) para obtener:
//   - cotizacion.prefijo (default 'NV')
//   - cotizacion.proximoNumero ← editable por el usuario en Configuración
//   - cotizacion.ultimoCorrelativo ← se actualiza solo al crear
//
// Lógica:
//   1. El SIGUIENTE número es `proximoNumero` guardado en la config
//      (eso es lo que el usuario edita en Configuración).
//   2. Si proximoNumero falta (configuración muy vieja), se calcula como:
//        max(ultimoCorrelativo + 1, último código en colección + 1, 1000001)
//      (solo como mecanismo de recuperación una sola vez)
//   3. Genera el código: <prefijo> + <número padded a 7 dígitos>
//   4. AUTO-INCREMENTA proximoNumero en +1 y actualiza ultimoCorrelativo
//      en la configuración, para que la próxima cotización siga el correlativo.
//
// Comportamiento esperado:
//   - El usuario pone proximoNumero=1004321 en Configuración.
//   - Crea cotización → se genera NV1004321.
//   - proximoNumero se auto-incrementa a 1004322.
//   - La siguiente cotización será NV1004322.
//   - Y así sucesivamente.
// ============================================================

// Extrae el número de un código (ej: 'NV1000005' → 1000005).
// Si el código no coincide con el prefijo, devuelve null.
function extraerNumero(codigo, prefijo) {
  if (!codigo || typeof codigo !== 'string') return null;
  const p = String(prefijo || '');
  if (p && codigo.startsWith(p)) {
    const numStr = codigo.slice(p.length).trim();
    const num = parseInt(numStr, 10);
    return isNaN(num) ? null : num;
  }
  if (!p) {
    const m = codigo.match(/(\d+)\s*$/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

export async function generateCodigoCotizacion() {
  // 1. Leer configuración con refresh forzado
  const config = await getConfig(true);
  const prefijo = config?.cotizacion?.prefijo || 'NV';
  const ultimoCorrelativoGuardado = config?.cotizacion?.ultimoCorrelativo || null;
  // proximoNumero es lo que el usuario edita en Configuración.
  let proximoNumero = Number(config?.cotizacion?.proximoNumero) || 0;

  // 2. Si proximoNumero no está definido (configuración muy vieja),
  //    calcularlo como el máximo entre último guardado, último en colección
  //    y 1000001 (piso por defecto para no romper con cotizaciones existentes).
  //    Esto solo pasa UNA vez; después proximoNumero queda guardado.
  if (!proximoNumero) {
    let ultimoNumeroEnColeccion = 0;
    const q = query(
      collection(db, COLLECTION_NAME),
      where('codigo', '>=', prefijo),
      where('codigo', '<', prefijo + '\uf8ff'),
      orderBy('codigo', 'desc'),
      limit(1)
    );
    try {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const lastCodigo = snapshot.docs[0].data().codigo;
        ultimoNumeroEnColeccion = extraerNumero(lastCodigo, prefijo) || 0;
      }
    } catch (err) {
      console.warn('Fallback en generateCodigoCotizacion (where falló):', err.message);
      const qFallback = query(collection(db, COLLECTION_NAME), orderBy('codigo', 'desc'), limit(50));
      const snap = await getDocs(qFallback);
      snap.forEach((d) => {
        const num = extraerNumero(d.data().codigo, prefijo);
        if (num && num > ultimoNumeroEnColeccion) {
          ultimoNumeroEnColeccion = num;
        }
      });
    }

    let ultimoNumeroConfig = 0;
    if (ultimoCorrelativoGuardado) {
      ultimoNumeroConfig = extraerNumero(ultimoCorrelativoGuardado, prefijo) || 0;
    }

    proximoNumero = Math.max(
      ultimoNumeroEnColeccion + 1,
      ultimoNumeroConfig + 1,
      1000001
    );
  }

  // 3. Generar el código con el proximoNumero (lo que el usuario eligió)
  const siguienteNumero = proximoNumero;
  const siguienteCodigo = `${prefijo}${siguienteNumero.toString().padStart(7, '0')}`;

  // 4. AUTO-INCREMENTAR: guardar proximoNumero + 1 y ultimoCorrelativo en la config
  //    para que la próxima cotización continúe el correlativo.
  try {
    await updateConfig({
      ...config,
      cotizacion: {
        ...config.cotizacion,
        proximoNumero: siguienteNumero + 1,
        ultimoCorrelativo: siguienteCodigo,
        prefijo
      }
    });
  } catch (err) {
    // Si no se puede actualizar la config (permisos), no bloqueamos la creación
    console.warn('No se pudo actualizar proximoNumero/ultimoCorrelativo en la configuración:', err.message);
  }

  return siguienteCodigo;
}

export async function createCotizacion(data) {
  const codigo = await generateCodigoCotizacion();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    codigo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { id: docRef.id, codigo };
}

export async function updateCotizacion(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteCotizacion(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
