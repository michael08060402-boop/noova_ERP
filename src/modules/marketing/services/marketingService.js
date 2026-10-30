import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';
import { trozos } from '../utils/archivosVersion';

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

async function generarPieza({ red, formato, tema, variante }) {
  try {
    const generar = httpsCallable(functions, 'marketingGenerarPieza', { timeout: 40000 });
    return (await generar({ red, formato, tema, variante })).data;
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

function errorCambioEstado(error, accion) {
  const codigo = String(error?.code || '');
  if (codigo.includes('aborted')) return new Error('El post cambió en SharePoint. Actualiza las publicaciones y vuelve a intentarlo.');
  if (codigo.includes('permission-denied')) return new Error(`Tu rol no puede ${accion} publicaciones.`);
  if (codigo.includes('failed-precondition') || codigo.includes('invalid-argument')) return new Error(error.message || 'Revisa los datos de la publicación.');
  if (codigo.includes('not-found')) return new Error('El servicio de aprobación todavía no está desplegado.');
  return new Error('No se pudo guardar el cambio. Intenta de nuevo.');
}

async function aprobarPublicacion(datos) {
  try {
    const aprobar = httpsCallable(functions, 'marketingAprobar', { timeout: 70000 });
    return (await aprobar(datos)).data;
  } catch (error) {
    throw errorCambioEstado(error, 'aprobar');
  }
}

async function devolverPublicacion(datos) {
  try {
    const devolver = httpsCallable(functions, 'marketingDevolver', { timeout: 70000 });
    return (await devolver(datos)).data;
  } catch (error) {
    throw errorCambioEstado(error, 'devolver');
  }
}

async function marcarPublicada(datos) {
  try {
    const marcar = httpsCallable(functions, 'marketingMarcarPublicada', { timeout: 70000 });
    return (await marcar(datos)).data;
  } catch (error) {
    throw errorCambioEstado(error, 'marcar como publicadas');
  }
}

async function listarHistorial(publicacionId) {
  try {
    const listar = httpsCallable(functions, 'marketingListarHistorial');
    return (await listar({ publicacionId })).data.items;
  } catch {
    throw new Error('No se pudo cargar el historial.');
  }
}

function errorTaller(error) {
  const codigo = String(error?.code || '');
  if (codigo.includes('aborted')) return new Error('El post cambió en SharePoint. Actualiza las publicaciones y vuelve a intentarlo.');
  if (codigo.includes('permission-denied')) return new Error('Tu rol no puede subir versiones editadas.');
  if (codigo.includes('invalid-argument')) return new Error(error.message || 'El archivo no es válido.');
  if (codigo.includes('not-found')) return new Error('El servicio del taller todavía no está desplegado.');
  return new Error('No se pudo completar la operación. Intenta de nuevo.');
}

async function descargarPaquete(publicacionId) {
  try {
    const paquete = httpsCallable(functions, 'marketingDescargarPaquete', { timeout: 70000 });
    return (await paquete({ publicacionId })).data.items;
  } catch (error) {
    throw errorTaller(error);
  }
}

function leerBase64(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1] || '');
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(blob);
  });
}

// Sube la versión editada por trozos y la registra en la ficha. Devuelve el nuevo estado de la pieza.
async function subirVersionEditada({ publicacionId, eTag, archivo, alAvanzar }) {
  try {
    const iniciar = httpsCallable(functions, 'marketingIniciarSubida', { timeout: 70000 });
    const subirParte = httpsCallable(functions, 'marketingSubirParte', { timeout: 130000 });
    const registrar = httpsCallable(functions, 'marketingRegistrarVersion', { timeout: 70000 });
    const { uploadUrl, tamanoTrozo } = (await iniciar({ publicacionId, nombre: archivo.name, tamano: archivo.size })).data;
    let completo = false;
    for (const { inicio, fin } of trozos(archivo.size, tamanoTrozo)) {
      const contenidoBase64 = await leerBase64(archivo.slice(inicio, fin + 1));
      completo = (await subirParte({ publicacionId, uploadUrl, inicio, fin, total: archivo.size, contenidoBase64 })).data.completo;
      alAvanzar?.(fin + 1, archivo.size);
    }
    if (!completo) throw new Error('SharePoint no confirmó la subida completa.');
    return (await registrar({ publicacionId, eTag })).data;
  } catch (error) {
    throw error instanceof Error && !error.code ? error : errorTaller(error);
  }
}

export { descargarPaquete, subirVersionEditada };

export { listarPublicaciones, actualizarTextoPublicacion, generarPieza, eliminarPublicacion, aprobarPublicacion, devolverPublicacion, listarHistorial, marcarPublicada };
