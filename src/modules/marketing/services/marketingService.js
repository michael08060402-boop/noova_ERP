import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';

async function listarPublicaciones() {
  try {
    const funcion = httpsCallable(functions, 'marketingListarPublicaciones', { timeout: 130000 });
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

async function actualizarTextoPublicacion({ publicacionId, texto, eTag }) {
  try {
    const guardar = httpsCallable(functions, 'marketingActualizarTexto', { timeout: 70000 });
    return (await guardar({ publicacionId, texto, eTag })).data;
  } catch (error) {
    const codigo = String(error?.code || '');
    if (codigo.includes('aborted')) throw new Error('El post cambió en SharePoint. Conserva tu texto y actualiza las publicaciones antes de guardar.');
    if (codigo.includes('permission-denied')) throw new Error('Tu cuenta no tiene permiso para editar esta publicación.');
    if (codigo.includes('not-found')) throw new Error('El servicio de edición todavía no está desplegado.');
    throw new Error('No se pudo guardar en SharePoint. Tu texto se conserva para reintentar.');
  }
}

async function generarPieza({ red, formato, tema }) {
  try {
    const generar = httpsCallable(functions, 'marketingGenerarPieza', { timeout: 40000 });
    return (await generar({ red, formato, tema })).data;
  } catch (error) {
    const codigo = String(error?.code || '');
    if (codigo.includes('permission-denied')) throw new Error('Tu cuenta no tiene permiso para generar piezas.');
    if (codigo.includes('not-found')) throw new Error('El servicio de generación todavía no está desplegado.');
    if (codigo.includes('invalid-argument')) throw new Error('Revisa los datos: alguna opción no es válida.');
    throw new Error('No se pudo iniciar la generación. Intenta de nuevo en un momento.');
  }
}

async function eliminarPublicacion(publicacionId) {
  try {
    const eliminar = httpsCallable(functions, 'marketingEliminarPublicacion', { timeout: 70000 });
    return (await eliminar({ publicacionId })).data;
  } catch (error) {
    const codigo = String(error?.code || '');
    if (codigo.includes('permission-denied')) throw new Error('Tu cuenta no tiene permiso para eliminar publicaciones.');
    if (codigo.includes('failed-precondition')) throw new Error(error.message || 'Esta publicación no se puede eliminar.');
    if (codigo.includes('not-found')) throw new Error('El servicio de eliminación todavía no está desplegado.');
    throw new Error('No se pudo eliminar la publicación. Intenta de nuevo.');
  }
}

export { listarPublicaciones, actualizarTextoPublicacion, generarPieza, eliminarPublicacion };
