import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';

async function listarPublicaciones() {
  try {
    const funcion = httpsCallable(functions, 'marketingListarPublicaciones');
    const resultado = await funcion();
    return resultado.data.items;
  } catch (error) {
    const code = String(error?.code || '');
    const mensaje = String(error?.message || '');
    if (code.includes('not-found') && /function|NOT_FOUND/i.test(mensaje)) {
      throw new Error('La función de Marketing no está desplegada. Ejecuta firebase deploy --only functions.');
    }
    throw new Error(mensaje || 'No se pudieron cargar las publicaciones.');
  }
}

export { listarPublicaciones };
