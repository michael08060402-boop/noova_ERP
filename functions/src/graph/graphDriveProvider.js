const graphClient = require('./graphClient');

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

function codificarItemId(itemId) {
  const id = String(itemId || '').trim();
  if (!id) throw new Error('Se requiere un itemId de Microsoft Graph.');
  return encodeURIComponent(id);
}

function codificarRuta(ruta) {
  const segmentos = String(ruta || '')
    .split('/')
    .map((segmento) => segmento.trim())
    .filter(Boolean);

  if (segmentos.length === 0) {
    throw new Error('Se requiere una ruta lógica de Nube.');
  }

  return segmentos.map(encodeURIComponent).join('/');
}

async function obtenerCarpetaPorRuta(rutaCarpeta) {
  const prefijo = obtenerPrefijoDrive();
  const data = await graphClient.get(
    `${prefijo}/root:/${codificarRuta(rutaCarpeta)}`,
    { $select: 'id,name,folder,parentReference' }
  );

  if (!data.folder) {
    throw new Error(`La ruta de Nube configurada no es una carpeta: ${rutaCarpeta}`);
  }

  return {
    id: data.id,
    nombre: data.name,
    parentId: data.parentReference?.id || null
  };
}

async function obtenerItem(itemId) {
  const prefijo = obtenerPrefijoDrive();
  return graphClient.get(`${prefijo}/items/${codificarItemId(itemId)}`, {
    $select: 'id,name,folder,file,parentReference,webUrl,eTag'
  });
}

async function listarCarpeta(carpetaId) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaId)}/children`;

  const params = {
    $select: 'id,name,size,lastModifiedDateTime,folder,file,webUrl',
    $orderby: 'name',
    $top: 200
  };

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
}

async function buscarDocumentos(termino, carpetaRaizId) {
  const prefijo = obtenerPrefijoDrive();
  const terminoCodificado = encodeURIComponent(termino).replace(/'/g, '%27');
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaRaizId)}/search(q='${terminoCodificado}')`;

  const params = {
    $select: 'id,name,size,lastModifiedDateTime,folder,file,webUrl,parentReference',
    $top: 50
  };

  const data = await graphClient.get(endpoint, params);
  const items = Array.isArray(data.value) ? data.value : [];

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
      _rutaPadreCompleta: rutaPadre,
      _parentId: item.parentReference?.id || null
    };
  });
}

async function crearCarpeta(carpetaPadreId, nombre) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaPadreId)}/children`;

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

const LIMITE_SUBIDA_BYTES = 4 * 1024 * 1024;

async function subirArchivo(carpetaPadreId, nombre, contenidoBase64, mimeType) {
  const prefijo = obtenerPrefijoDrive();
  const buffer = Buffer.from(contenidoBase64, 'base64');

  if (buffer.length > LIMITE_SUBIDA_BYTES) {
    throw new Error('El archivo supera los 4MB permitidos para subida directa.');
  }

  const nombreCodificado = encodeURIComponent(nombre);
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaPadreId)}:/${nombreCodificado}:/content`;

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

async function renombrarItem(itemId, nuevoNombre, eTag) {
  const prefijo = obtenerPrefijoDrive();
  const data = await graphClient.patch(
    `${prefijo}/items/${codificarItemId(itemId)}`,
    { name: nuevoNombre },
    eTag ? { 'If-Match': eTag } : {}
  );
  return { id: data.id, nombre: data.name };
}

async function eliminarItem(itemId, eTag) {
  const prefijo = obtenerPrefijoDrive();
  await graphClient.del(
    `${prefijo}/items/${codificarItemId(itemId)}`,
    eTag ? { 'If-Match': eTag } : {}
  );
  return { eliminado: true };
}

async function estaDentroDeCarpeta(itemId, carpetaRaizId) {
  const raizId = String(carpetaRaizId || '').trim();
  let actualId = String(itemId || '').trim();
  if (!raizId || !actualId) return false;
  if (actualId === raizId) return true;

  const prefijo = obtenerPrefijoDrive();

  for (let intentos = 0; intentos < 100; intentos++) {
    const data = await graphClient.get(`${prefijo}/items/${codificarItemId(actualId)}`, {
      $select: 'id,parentReference'
    });
    const padreId = data.parentReference?.id;
    if (!padreId) return false;
    if (padreId === raizId) return true;
    actualId = padreId;
  }

  return false;
}

// Lista solo las imágenes de una carpeta con sus miniaturas. Las URLs de
// miniatura de Graph son temporales, por eso se piden en cada consulta.
async function listarArchivosPublicacionCarpeta(carpetaId) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaId)}/children`;

  const items = await graphClient.getPaginado(endpoint, {
    $select: 'id,name,size,lastModifiedDateTime,file,webUrl',
    $expand: 'thumbnails',
    $orderby: 'lastModifiedDateTime desc',
    $top: 200
  });

  return Promise.all(items
    .filter((item) => item.file && (
      /^image\//i.test(item.file.mimeType || '') ||
      item.file.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.name)
    ))
    .map(async (item) => {
      const miniatura = item.thumbnails?.[0] || {};
      const esPdf = item.file.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.name);
      const descarga = esPdf ? await obtenerLinkDescarga(item.id) : null;
      return {
        id: item.id,
        nombre: item.name,
        tamaño: item.size || 0,
        fechaModificacion: item.lastModifiedDateTime,
        urlWeb: item.webUrl || null,
        tipo: esPdf ? 'pdf' : 'imagen',
        urlDocumento: descarga?.urlDescarga || null,
        urlMiniatura: miniatura.medium?.url || miniatura.small?.url || null,
        urlGrande: miniatura.large?.url || miniatura.medium?.url || null
      };
    }));
}

module.exports = {
  listarArchivosPublicacionCarpeta,
  listarCarpeta,
  buscarDocumentos,
  obtenerCarpetaPorRuta,
  obtenerItem,
  crearCarpeta,
  subirArchivo,
  renombrarItem,
  eliminarItem,
  estaDentroDeCarpeta,
  LIMITE_SUBIDA_BYTES
};
