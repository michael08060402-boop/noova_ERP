import { db, functions } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const COLECCION = 'facturacion';

export const TIPOS_COMPROBANTE = {
  BOLETA: 'Boleta',
  FACTURA: 'Factura',
};

export async function getFacturas() {
  const q = query(collection(db, COLECCION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function crearFacturaDesdeCotizacion(cotizacion, facturaData, datosEmpresa) {
  if (!datosEmpresa || !datosEmpresa.ruc) {
    throw new Error('Faltan datos de la empresa (ruc). Verifica que ConfigContext tenga el campo "empresa".');
  }

  const data = {
    ...facturaData,
    tipoOperacion: facturaData.tipoOperacion || facturaData.operacion || '0101',
    estadoSunat: 'PENDIENTE',
    mensajeSunat: 'Enviando a SUNAT BETA...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let docRef = null;

  try {
    docRef = await addDoc(collection(db, COLECCION), data);

    const emitirComprobante = httpsCallable(functions, 'emitirComprobante', { timeout: 120000 });
    const resultado = await emitirComprobante({
      facturaId: docRef.id,
      facturaData: data,
      empresaData: datosEmpresa,
    });

    const docActualizado = await getDoc(doc(db, COLECCION, docRef.id));
    const datosActualizados = docActualizado.data();

    return {
      id: docRef.id,
      ...data,
      ...datosActualizados,
      estadoSunat: resultado?.data?.estado || datosActualizados.estadoSunat || 'PENDIENTE',
      mensajeSunat: resultado?.data?.mensaje || datosActualizados.mensajeSunat || '',
      codigo: resultado?.data?.codigo || datosActualizados.codigoRespuesta || '',
    };
  } catch (err) {
    console.error('Error en el proceso de facturación:', err);

    if (docRef) {
      try {
        await updateDoc(doc(db, COLECCION, docRef.id), {
          estadoSunat: 'ERROR',
          mensajeSunat: err.message || 'Error interno del servidor de funciones.',
          updatedAt: new Date().toISOString(),
        });
      } catch (updateErr) {
        console.error('No se pudo actualizar el estado de error en Firestore:', updateErr);
      }

      return {
        id: docRef.id,
        ...data,
        estadoSunat: 'ERROR',
        mensajeSunat: err.message || 'Error interno del servidor de funciones.',
        codigo: '',
      };
    }

    return {
      estadoSunat: 'ERROR',
      mensajeSunat: err.message || 'Error interno del servidor de funciones.',
    };
  }
}

export async function eliminarFactura(id) {
  const docRef = doc(db, COLECCION, id);
  await deleteDoc(docRef);
}
