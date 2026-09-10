const graphClient = require('./graphClient');

// Proveedor de almacenamiento para OneDrive/SharePoint
// Este módulo abstrae las llamadas a Graph API para operaciones sobre drives.
// En el futuro se pueden agregar otros providers (Google Drive, S3, etc.)
// sin tocar la UI ni el servicio del frontend.

// Determinar el prefijo del drive según la configuración
// GRAPH_DRIVE_TYPE: "user" | "site" | "group"
// GRAPH_DRIVE_ID: email del usuario, ID del sitio, o ID del grupo
function obtenerPrefijoDrive() {
  const tipo = process.env.GRAPH_DRIVE_TYPE || 'site';
  const driveId = process.env.GRAPH_DRIVE_ID;

  if (!driveId) {
    throw new Error('Falta variable GRAPH_DRIVE_ID. Debe ser el email del usuario o el ID del sitio.');
  }

  switch (tipo) {
    case 'user':
      return `/users/${driveId}/drive`;
    case 'site':
      return `/sites/${driveId}/drive`;
    case 'group':
      return `/groups/${driveId}/drive`;
    default:
      throw new Error(`GRAPH_DRIVE_TYPE inválido: ${tipo}. Usar "user", "site" o "group".`);
  }
}

// Listar contenido de una carpeta
// Si carpetaId es null, lista la raíz del drive
async function listarCarpeta(carpetaId) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = carpetaId
    ? `${prefijo}/items/${carpetaId}/children`
    : `${prefijo}/root/children`;

  const params = {
    $select: 'id,name,size,lastModifiedDateTime,folder,file,webUrl',
    $orderby: 'name',
    $top: 200
  };

  const items = await graphClient.getPaginado(endpoint, params);

  // Mapear a formato estándar del módulo Nube
  return items.map(item => ({
    id: item.id,
    nombre: item.name,
    tipo: item.folder ? 'carpeta' : 'archivo',
    tamaño: item.size || 0,
    fechaModificacion: item.lastModifiedDateTime,
    urlWeb: item.webUrl || null,
    extension: item.file ? item.name.split('.').pop().toLowerCase() : null,
    mimeType: item.file?.mimeType || null
  }));
}

// Obtener link de descarga de un archivo
// Graph devuelve @microsoft.graph.downloadUrl con URL temporal
async function obtenerLinkDescarga(itemId) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/items/${itemId}`;

  const data = await graphClient.get(endpoint, {
    $select: 'id,name,@microsoft.graph.downloadUrl,size,file'
  });

  return {
    id: data.id,
    nombre: data.name,
    urlDescarga: data['@microsoft.graph.downloadUrl'] || null,
    tamaño: data.size || 0,
    mimeType: data.file?.mimeType || null
  };
}

// Buscar documentos en todo el drive
async function buscarDocumentos(termino) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/root/search(q='${encodeURIComponent(termino)}')`;

  const params = {
    $select: 'id,name,size,lastModifiedDateTime,folder,file,webUrl,parentReference',
    $top: 50
  };

  const items = await graphClient.getPaginado(endpoint, params);

  return items.map(item => {
    const rutaPadre = (item.parentReference?.path || '').split('/root:').pop().replace(/^\//, '');
    return {
      id: item.id,
      nombre: item.name,
      tipo: item.folder ? 'carpeta' : 'archivo',
      tamaño: item.size || 0,
      fechaModificacion: item.lastModifiedDateTime,
      urlWeb: item.webUrl || null,
      extension: item.file ? item.name.split('.').pop().toLowerCase() : null,
      mimeType: item.file?.mimeType || null,
      ruta: rutaPadre ? `${rutaPadre}/${item.name}` : item.name,
      _rutaPadreCompleta: rutaPadre
    };
  });
}

// Listar contenido de una carpeta dada por RUTA (path-based addressing).
// Se usa para llevar a un usuario de rol restringido directo a la carpeta
// de su área (ej. "Marketing") sin tener que listar la raíz primero.
async function listarCarpetaPorRuta(rutaCarpeta) {
  const prefijo = obtenerPrefijoDrive();
  const rutaLimpia = String(rutaCarpeta || '').split('/').filter(Boolean).join('/');
  const endpoint = rutaLimpia
    ? `${prefijo}/root:/${encodeURIComponent(rutaLimpia).replace(/%2F/g, '/')}:/children`
    : `${prefijo}/root/children`;

  const params = {
    $select: 'id,name,size,lastModifiedDateTime,folder,file,webUrl',
    $orderby: 'name',
    $top: 200
  };

  try {
    const items = await graphClient.getPaginado(endpoint, params);
    return items.map(item => ({
      id: item.id,
      nombre: item.name,
      tipo: item.folder ? 'carpeta' : 'archivo',
      tamaño: item.size || 0,
      fechaModificacion: item.lastModifiedDateTime,
      urlWeb: item.webUrl || null,
      extension: item.file ? item.name.split('.').pop().toLowerCase() : null,
      mimeType: item.file?.mimeType || null
    }));
  } catch (err) {
    if (err.response?.status === 404) {
      // La carpeta del área todavía no existe en el drive: se crea vacía.
      await crearCarpeta(null, rutaLimpia);
      return [];
    }
    throw err;
  }
}

// Obtener (o crear si no existe) el ID de la carpeta raíz de un área,
// dado su nombre (ej. "Marketing"). Se usa como carpeta padre por defecto
// para que un rol restringido solo pueda crear/subir dentro de su área.
async function obtenerOCrearCarpetaRaizArea(nombreArea) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/root:/${encodeURIComponent(nombreArea)}`;
  try {
    const data = await graphClient.get(endpoint, { $select: 'id,name' });
    return data.id;
  } catch (err) {
    if (err.response?.status === 404) {
      const nueva = await crearCarpeta(null, nombreArea);
      return nueva.id;
    }
    throw err;
  }
}

// Crear una carpeta nueva. carpetaPadreId null = raíz del drive.
async function crearCarpeta(carpetaPadreId, nombre) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = carpetaPadreId
    ? `${prefijo}/items/${carpetaPadreId}/children`
    : `${prefijo}/root/children`;

  const data = await graphClient.post(endpoint, {
    name: nombre,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename'
  });

  return {
    id: data.id,
    nombre: data.name,
    tipo: 'carpeta',
    tamaño: 0,
    fechaModificacion: data.lastModifiedDateTime,
    urlWeb: data.webUrl || null
  };
}

// Subir un archivo pequeño (< 4MB) directamente con su contenido en base64.
// Para archivos más grandes, Graph requiere upload sessions (no soportado aún).
const LIMITE_SUBIDA_BYTES = 4 * 1024 * 1024;

async function subirArchivo(carpetaPadreId, nombre, contenidoBase64, mimeType) {
  const prefijo = obtenerPrefijoDrive();
  const buffer = Buffer.from(contenidoBase64, 'base64');

  if (buffer.length > LIMITE_SUBIDA_BYTES) {
    throw new Error('El archivo supera los 4MB permitidos para subida directa.');
  }

  const nombreCodificado = encodeURIComponent(nombre);
  const endpoint = carpetaPadreId
    ? `${prefijo}/items/${carpetaPadreId}:/${nombreCodificado}:/content`
    : `${prefijo}/root:/${nombreCodificado}:/content`;

  const data = await graphClient.putBinario(endpoint, buffer, mimeType);

  return {
    id: data.id,
    nombre: data.name,
    tipo: 'archivo',
    tamaño: data.size || buffer.length,
    fechaModificacion: data.lastModifiedDateTime,
    urlWeb: data.webUrl || null,
    extension: data.name.includes('.') ? data.name.split('.').pop().toLowerCase() : null,
    mimeType: data.file?.mimeType || mimeType || null
  };
}

// Renombrar un archivo o carpeta existente
async function renombrarItem(itemId, nuevoNombre) {
  const prefijo = obtenerPrefijoDrive();
  const data = await graphClient.patch(`${prefijo}/items/${itemId}`, { name: nuevoNombre });
  return { id: data.id, nombre: data.name };
}

// Eliminar un archivo o carpeta (va a la papelera de reciclaje de OneDrive/SharePoint)
async function eliminarItem(itemId) {
  const prefijo = obtenerPrefijoDrive();
  await graphClient.del(`${prefijo}/items/${itemId}`);
  return { eliminado: true };
}

// Verifica que un item (carpeta o archivo) esté dentro de la carpeta raíz
// de un área (o sea esa misma carpeta). Se usa para que roles restringidos
// no puedan crear, subir, renombrar ni eliminar fuera de su propia área,
// incluso si alguien intenta llamar a la función directamente con otro ID.
async function estaDentroDeArea(itemId, nombreArea) {
  const prefijo = obtenerPrefijoDrive();
  const data = await graphClient.get(`${prefijo}/items/${itemId}`, {
    $select: 'id,name,parentReference'
  });

  const rutaPadre = data.parentReference?.path || ''; // ej: "/drive/root:/Marketing"
  const marcador = `/root:/${nombreArea}`;

  // El item ES la carpeta raíz del área, o está dentro de ella (ruta empieza igual o con "/subcarpeta")
  const esLaPropiaCarpeta = data.name === nombreArea && rutaPadre.endsWith('/root:');
  const estaAdentro = rutaPadre === marcador || rutaPadre.startsWith(`${marcador}/`);

  return esLaPropiaCarpeta || estaAdentro;
}

module.exports = {
  listarCarpeta,
  obtenerLinkDescarga,
  buscarDocumentos,
  listarCarpetaPorRuta,
  obtenerOCrearCarpetaRaizArea,
  crearCarpeta,
  subirArchivo,
  renombrarItem,
  eliminarItem,
  estaDentroDeArea,
  LIMITE_SUBIDA_BYTES
};
