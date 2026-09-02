import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';

// Arquitectura única de producción:
// navegador -> Firebase callable -> Microsoft Graph -> OneDrive/SharePoint.
// No hay fallback al disco local ni a un servidor Express del equipo.
const PROVEEDOR = 'graph';
const LIMITE_SUBIDA_BYTES = 4 * 1024 * 1024;

async function llamar(nombre, datos = {}) {
  try {
    const funcion = httpsCallable(functions, nombre);
    const resultado = await funcion(datos);
    return resultado.data;
  } catch (error) {
    const code = String(error?.code || '');
    const mensaje = String(error?.message || '');
    if (code.includes('not-found') && /function|not found|NOT_FOUND/i.test(mensaje)) {
      throw new Error('Las Cloud Functions de Nube no están desplegadas o están desactualizadas. Ejecuta firebase deploy --only functions.');
    }
    if (code.includes('failed-precondition')) {
      throw new Error(mensaje || 'Microsoft Graph no está configurado. Revisa los secretos de Firebase Functions.');
    }
    if (code.includes('permission-denied')) {
      throw new Error(mensaje || 'Microsoft Graph o tu perfil no tienen permisos suficientes para acceder a Nube.');
    }
    if (code.includes('not-found')) {
      throw new Error(mensaje || 'No se encontró el OneDrive/SharePoint configurado. Revisa el tipo e identificador del drive.');
    }
    if (code.includes('unavailable')) {
      throw new Error(mensaje || 'Microsoft Graph no está disponible en este momento.');
    }
    if (code.includes('internal')) {
      throw new Error(mensaje && !/internal/i.test(mensaje)
        ? mensaje
        : 'OneDrive respondió con un error interno. Revisa los logs de Firebase Functions y la configuración de Microsoft Graph.');
    }
    throw new Error(mensaje || 'No se pudo comunicar con OneDrive.');
  }
}

async function listarCarpeta(carpetaId = null) {
  const data = await llamar('nubeListarCarpeta', { carpetaId });
  return data.items;
}

async function buscarDocumentos(termino) {
  const data = await llamar('nubeBuscarDocumentos', { termino });
  return data.items;
}

async function obtenerContexto() {
  return llamar('nubeObtenerContexto');
}

async function crearCarpeta(carpetaPadreId, nombre) {
  const data = await llamar('nubeCrearCarpeta', { carpetaPadreId, nombre });
  return data.item;
}

function archivoABase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

async function subirArchivo(carpetaPadreId, archivo) {
  if (archivo.size > LIMITE_SUBIDA_BYTES) {
    throw new Error('El archivo supera los 4 MB permitidos para subida directa.');
  }

  const contenidoBase64 = await archivoABase64(archivo);
  const data = await llamar('nubeSubirArchivo', {
    carpetaPadreId,
    nombre: archivo.name,
    contenidoBase64,
    mimeType: archivo.type || 'application/octet-stream'
  });
  return data.item;
}

async function renombrarItem(itemId, nuevoNombre) {
  const data = await llamar('nubeRenombrarItem', { itemId, nuevoNombre });
  return data.item;
}

async function eliminarItem(itemId) {
  await llamar('nubeEliminarItem', { itemId });
  return true;
}

export {
  listarCarpeta,
  buscarDocumentos,
  PROVEEDOR,
  obtenerContexto,
  crearCarpeta,
  subirArchivo,
  renombrarItem,
  eliminarItem,
  LIMITE_SUBIDA_BYTES
};
