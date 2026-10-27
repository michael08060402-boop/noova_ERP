import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';

function errorObservaciones(error, mensaje) {
  const codigo = String(error?.code || '');
  if (codigo.includes('not-found')) {
    return new Error('El servicio de observaciones todavía no está disponible.');
  }
  if (codigo.includes('permission-denied') || codigo.includes('unauthenticated')) {
    return new Error('Tu sesión no tiene acceso a las observaciones de esta publicación.');
  }
  return new Error(mensaje);
}

export async function listarObservaciones(publicacionId) {
  try {
    const listar = httpsCallable(functions, 'marketingListarObservaciones');
    const resultado = await listar({ publicacionId });
    return resultado.data.items;
  } catch (error) {
    throw errorObservaciones(error, 'No se pudieron cargar las observaciones. Intenta nuevamente.');
  }
}

export async function crearObservacion({ publicacionId, texto, solicitudId }) {
  try {
    const crear = httpsCallable(functions, 'marketingCrearObservacion');
    const resultado = await crear({ publicacionId, texto, solicitudId });
    return resultado.data.item;
  } catch (error) {
    throw errorObservaciones(error, 'No se pudo enviar la observación. Tu texto se conserva para reintentar.');
  }
}
