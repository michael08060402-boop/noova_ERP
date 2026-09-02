import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let cachedConfig = null;

// Estructura base: los datos de empresa vienen exclusivamente de Firestore
// (colección configuracion/general). Si el documento no existe, los campos
// de empresa quedan vacíos. Los demás campos (condiciones de pago,
// correlativos de cotización) sí tienen valores por defecto porque son
// configuración operativa del sistema, no datos sensibles de la empresa.
const CONFIG_BASE = {
  empresa: {
    razonSocial: '',
    ruc: '',
    direccion: '',
    telefono: '',
    celular: '',
    email: '',
    web: '',
    contacto: '',
    lemaAnual: ''
  },
  condicionesPago: ['Contado', '7 días', '15 días'],
  condicionesVenta: [],
  cuentasBancarias: '',
  cotizacion: {
    ultimoCorrelativo: 'NV1000000',
    prefijo: 'NV',
    secuenciaInicio: 1000001,
    proximoNumero: 1000001
  },
  ordenCompra: {
    prefijo: 'OC',
    longitud: 6,
    ultimoCorrelativo: 'OC100110',
    proximoNumero: 100111,
    elaboradoPor: '',
    cargoElaborador: '',
    autorizadoPor: '',
    cargoAutorizador: 'GERENTE GENERAL NOOVA S.A.C.'
  }
};

function mergeConfig(data = {}) {
  return {
    empresa: { ...CONFIG_BASE.empresa, ...(data.empresa || {}) },
    condicionesPago: Array.isArray(data.condicionesPago) ? data.condicionesPago : CONFIG_BASE.condicionesPago,
    condicionesVenta: Array.isArray(data.condicionesVenta) ? data.condicionesVenta : CONFIG_BASE.condicionesVenta,
    cuentasBancarias: data.cuentasBancarias || CONFIG_BASE.cuentasBancarias,
    cotizacion: { ...CONFIG_BASE.cotizacion, ...(data.cotizacion || {}) },
    ordenCompra: { ...CONFIG_BASE.ordenCompra, ...(data.ordenCompra || {}) }
  };
}

export async function getConfig(forceRefresh = false) {
  if (cachedConfig && !forceRefresh) return cachedConfig;
  const docRef = doc(db, 'configuracion', 'general');
  const snapshot = await getDoc(docRef);
  const data = snapshot.exists() ? mergeConfig(snapshot.data()) : mergeConfig({});
  cachedConfig = data;
  return data;
}

export async function updateConfig(data) {
  const docRef = doc(db, 'configuracion', 'general');
  await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  cachedConfig = mergeConfig({ ...cachedConfig, ...data });
}

export function clearConfigCache() {
  cachedConfig = null;
}
