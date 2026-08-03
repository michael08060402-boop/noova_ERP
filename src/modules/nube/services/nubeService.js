// Capa de comunicacion del modulo Nube.
// La UI nunca sabe de donde vienen los datos — solo llama a estas funciones.
//
// Proveedor activo: se controla con VITE_NUBE_PROVIDER
//   "local" → API local que lee la carpeta OneDrive sincronizada
//   "graph" → Cloud Functions que llaman Microsoft Graph API
//
// Para cambiar de proveedor solo se modifica la variable de entorno,
// sin tocar la UI, el hook ni los componentes.

const PROVEEDOR = import.meta.env.VITE_NUBE_PROVIDER || 'local';

// ── UTILIDADES ──

// Codificar ruta relativa como ID (base64url) — coincide con el servidor
// Usado para reconstruir breadcrumbs al navegar desde busqueda
function codificarRuta(rutaRelativa) {
  if (!rutaRelativa) return 'root';
  const bytes = new TextEncoder().encode(rutaRelativa);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── PROVEEDOR LOCAL ──
// Llama al servidor Express que lee el filesystem

const API_BASE = '/api/nube';

// Mensaje de ayuda cuando la API local no esta conectada
const MSG_API_DESCONECTADA = 'No se pudo conectar con el servidor de documentos. Verifica que local-api este iniciado con: cd local-api && set "ONEDRIVE_LOCAL_PATH=RUTA_ONEDRIVE" && set "ONEDRIVE_WEB_BASE_URL=URL_SHAREPOINT" && npm start';

async function fetchLocal(url) {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({ error: 'Error de conexion' }));
      throw new Error(error.error || 'Error de conexion');
    }
    return respuesta;
  } catch (err) {
    // fetch lanza TypeError cuando el servidor no esta corriendo
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(MSG_API_DESCONECTADA);
    }
    throw err;
  }
}

async function listarCarpetaLocal(carpetaId = null) {
  const params = new URLSearchParams();
  if (carpetaId && carpetaId !== 'root') {
    params.set('id', carpetaId);
  }
  const url = `${API_BASE}/carpeta${params.toString() ? '?' + params.toString() : ''}`;
  const respuesta = await fetchLocal(url);
  const data = await respuesta.json();
  return data.items;
}

async function buscarDocumentosLocal(termino) {
  const params = new URLSearchParams({ q: termino });
  const url = `${API_BASE}/buscar?${params.toString()}`;
  const respuesta = await fetchLocal(url);
  const data = await respuesta.json();
  return data.items;
}

// ── PROVEEDOR GRAPH (Cloud Functions) ──
// Llama a Firebase Cloud Functions que usan Microsoft Graph API

import { functions } from '../../../firebase/config';
import { httpsCallable } from 'firebase/functions';

async function listarCarpetaGraph(carpetaId = null) {
  const fn = httpsCallable(functions, 'nubeListarCarpeta');
  const resultado = await fn({ carpetaId });
  return resultado.data.items;
}

async function buscarDocumentosGraph(termino) {
  const fn = httpsCallable(functions, 'nubeBuscarDocumentos');
  const resultado = await fn({ termino });
  return resultado.data.items;
}

// Contexto de rol: si el usuario está restringido a una carpeta de área
async function obtenerContextoGraph() {
  const fn = httpsCallable(functions, 'nubeObtenerContexto');
  const resultado = await fn();
  return resultado.data; // { carpetaArea, carpetaId }
}

async function crearCarpetaGraph(carpetaPadreId, nombre) {
  const fn = httpsCallable(functions, 'nubeCrearCarpeta');
  const resultado = await fn({ carpetaPadreId, nombre });
  return resultado.data.item;
}

// archivo: objeto File del navegador
async function subirArchivoGraph(carpetaPadreId, archivo) {
  const contenidoBase64 = await archivoABase64(archivo);
  const fn = httpsCallable(functions, 'nubeSubirArchivo');
  const resultado = await fn({
    carpetaPadreId,
    nombre: archivo.name,
    contenidoBase64,
    mimeType: archivo.type || 'application/octet-stream'
  });
  return resultado.data.item;
}

async function renombrarItemGraph(itemId, nuevoNombre) {
  const fn = httpsCallable(functions, 'nubeRenombrarItem');
  const resultado = await fn({ itemId, nuevoNombre });
  return resultado.data.item;
}

async function eliminarItemGraph(itemId) {
  const fn = httpsCallable(functions, 'nubeEliminarItem');
  await fn({ itemId });
  return true;
}

function archivoABase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

const LIMITE_SUBIDA_BYTES = 4 * 1024 * 1024;

// ── INTERFAZ PUBLICA ──
// El hook y los componentes solo usan estas funciones,
// nunca saben que proveedor hay detras.

async function listarCarpeta(carpetaId = null) {
  if (PROVEEDOR === 'graph') return listarCarpetaGraph(carpetaId);
  return listarCarpetaLocal(carpetaId);
}

async function buscarDocumentos(termino) {
  if (PROVEEDOR === 'graph') return buscarDocumentosGraph(termino);
  return buscarDocumentosLocal(termino);
}

// Devuelve { carpetaArea: null|string, carpetaId: null|string }.
// En modo "local" nunca hay restricción por rol (no aplica CRUD todavía).
async function obtenerContexto() {
  if (PROVEEDOR === 'graph') return obtenerContextoGraph();
  return { carpetaArea: null, carpetaId: null };
}

async function crearCarpeta(carpetaPadreId, nombre) {
  if (PROVEEDOR !== 'graph') throw new Error('Crear carpetas solo está disponible en el modo Graph (nube en línea).');
  return crearCarpetaGraph(carpetaPadreId, nombre);
}

async function subirArchivo(carpetaPadreId, archivo) {
  if (PROVEEDOR !== 'graph') throw new Error('Subir archivos solo está disponible en el modo Graph (nube en línea).');
  if (archivo.size > LIMITE_SUBIDA_BYTES) {
    throw new Error('El archivo supera los 4MB permitidos para subida directa.');
  }
  return subirArchivoGraph(carpetaPadreId, archivo);
}

async function renombrarItem(itemId, nuevoNombre) {
  if (PROVEEDOR !== 'graph') throw new Error('Renombrar solo está disponible en el modo Graph (nube en línea).');
  return renombrarItemGraph(itemId, nuevoNombre);
}

async function eliminarItem(itemId) {
  if (PROVEEDOR !== 'graph') throw new Error('Eliminar solo está disponible en el modo Graph (nube en línea).');
  return eliminarItemGraph(itemId);
}

export {
  listarCarpeta, buscarDocumentos, PROVEEDOR, codificarRuta,
  obtenerContexto, crearCarpeta, subirArchivo, renombrarItem, eliminarItem,
  LIMITE_SUBIDA_BYTES
};
