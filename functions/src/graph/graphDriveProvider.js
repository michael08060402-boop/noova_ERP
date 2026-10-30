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

// Enlace temporal para abrir los PDF de Publicaciones.
async function obtenerLinkDescarga(itemId) {
  const prefijo = obtenerPrefijoDrive();
  const data = await graphClient.get(
    `${prefijo}/items/${codificarItemId(itemId)}`,
    { $select: 'id,@microsoft.graph.downloadUrl' }
  );
  return { urlDescarga: data['@microsoft.graph.downloadUrl'] || null };
}

function leerAprobacion(valor) {
  if (!valor || typeof valor !== 'object') return null;
  const texto = (campo, max) => (typeof valor[campo] === 'string' ? valor[campo].slice(0, max) : '');
  return { por: texto('por', 150), red: texto('red', 20), fecha: texto('fecha', 10), hora: texto('hora', 5), revision: Number.isInteger(valor.revision) ? valor.revision : null };
}

function leerDevolucion(valor) {
  if (!valor || typeof valor !== 'object') return null;
  const texto = (campo, max) => (typeof valor[campo] === 'string' ? valor[campo].slice(0, max) : '');
  return { motivo: texto('motivo', 500), por: texto('por', 150), en: texto('en', 40) };
}

// Lista imágenes y PDF con miniaturas y enlaces temporales de Graph.
async function listarArchivosPublicacionCarpeta(carpetaId) {
  const prefijo = obtenerPrefijoDrive();
  const endpoint = `${prefijo}/items/${codificarItemId(carpetaId)}/children`;

  const items = await graphClient.getPaginado(endpoint, {
    $select: 'id,name,size,lastModifiedDateTime,file,webUrl,eTag',
    $expand: 'thumbnails',
    $orderby: 'lastModifiedDateTime desc',
    $top: 200
  });

  let metadatos = null;
  let aviso = null;
  const jsons = items.filter((item) => item.file && /\.json$/i.test(item.name));
  const json = jsons.find((item) => /^publicacion\.json$/i.test(item.name)) || (jsons.length === 1 ? jsons[0] : null);
  if (json) {
    try {
      if (json.size > 128 * 1024) throw new Error('JSON demasiado grande');
      const contenido = await graphClient.getTexto(`${prefijo}/items/${codificarItemId(json.id)}/content`);
      const datos = JSON.parse(contenido.replace(/^\uFEFF/, ''));
      if (!datos || typeof datos !== 'object' || Array.isArray(datos) || datos.schema_version !== 1) throw new Error('Esquema no reconocido');
      if (typeof datos.archivo !== 'string' || !items.some((item) => item.file && item.name === datos.archivo)) throw new Error('No se encontró el archivo asociado');
      metadatos = {
        jsonId: json.id,
        jsonEtag: json.eTag || null,
        titulo: typeof datos.titulo === 'string' ? datos.titulo.slice(0, 300) : '',
        texto: typeof datos.texto === 'string' ? datos.texto.slice(0, 32000) : '',
        red: ['facebook', 'instagram', 'linkedin', 'tiktok'].includes(datos.red) ? datos.red : null,
        estado: typeof datos.estado === 'string' ? datos.estado.slice(0, 40) : '',
        archivo: datos.archivo,
        portada: typeof datos.portada === 'string' ? datos.portada : null,
        paginas: Number.isInteger(datos.paginas) && datos.paginas > 0 ? datos.paginas : null,
        formato: typeof datos.formato === 'string' ? datos.formato.slice(0, 60) : '',
        revision: Number.isInteger(datos.revision) ? datos.revision : null,
        publicadoEn: typeof datos.publicado_en === 'string' ? datos.publicado_en : null,
        urlPublicada: typeof datos.url_publicada === 'string' && /^https:\/\//i.test(datos.url_publicada) ? datos.url_publicada.slice(0, 500) : null,
        origen: datos.origen === 'manual' ? 'manual' : 'generado',
        versiones: Array.isArray(datos.versiones) ? datos.versiones.length : 0,
        aprobadoEn: typeof datos.aprobado_en === 'string' ? datos.aprobado_en : null,
        aprobacion: leerAprobacion(datos.aprobacion),
        devuelto: leerDevolucion(datos.devuelto),
        pendientes: Array.isArray(datos.pendientes) ? datos.pendientes.filter((p) => typeof p === 'string').slice(0, 20).map((p) => p.slice(0, 1000)) : []
      };
    } catch {
      aviso = 'No se pudo leer el JSON de esta publicación. Se muestra el archivo sin su texto.';
    }
  } else if (jsons.length > 1) {
    aviso = 'Hay varios JSON en esta carpeta y no se encontró publicacion.json.';
  }

  return Promise.all(items
    .filter((item) => item.file && (
      /^image\//i.test(item.file.mimeType || '') ||
      item.file.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.name)
    ) && (!metadatos || item.name === metadatos.archivo))
    .map(async (item) => {
      const portada = metadatos?.portada ? items.find((p) => p.file && /^image\//i.test(p.file.mimeType || '') && p.name === metadatos.portada) : null;
      const miniatura = (portada || item).thumbnails?.[0] || {};
      const esPdf = item.file.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.name);
      const descarga = esPdf ? await obtenerLinkDescarga(item.id) : null;
      return {
        id: item.id,
        nombre: item.name,
        titulo: metadatos?.titulo || item.name,
        texto: metadatos?.texto || '',
        metadatos,
        aviso,
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

// Cada subcarpeta de una red es un post. Los archivos sueltos se mantienen
// para seguir mostrando publicaciones anteriores a la estructura con JSON.
async function listarPostsRed(carpetaId) {
  const hijos = await listarCarpeta(carpetaId);
  const resultados = [await listarArchivosPublicacionCarpeta(carpetaId)];
  const carpetas = hijos.filter((item) => item.tipo === 'carpeta');
  // Limitar las consultas simultáneas evita ráfagas de peticiones a Graph.
  for (let i = 0; i < carpetas.length; i += 4) {
    resultados.push(...await Promise.all(carpetas.slice(i, i + 4).map((carpeta) => listarArchivosPublicacionCarpeta(carpeta.id))));
  }
  return resultados.flat();
}

function errorPublicacion(codigo, mensaje) {
  const error = new Error(mensaje);
  error.code = codigo;
  return error;
}

// Localiza publicacion.json junto al archivo, comprueba que no cambió desde que el ERP lo leyó
// (ETag) y devuelve su contenido. Toda escritura sobre el JSON pasa por aquí.
async function abrirJsonPublicacion(publicacionId, eTag) {
  const archivo = await obtenerItem(publicacionId);
  if (!archivo.parentReference?.id) throw new Error('No se encontró la carpeta de la publicación.');
  const hijos = await listarCarpeta(archivo.parentReference.id);
  const jsons = hijos.filter((item) => item.tipo === 'archivo' && /\.json$/i.test(item.nombre));
  const json = jsons.find((item) => /^publicacion\.json$/i.test(item.nombre)) || (jsons.length === 1 ? jsons[0] : null);
  if (!json) throw new Error('No se encontró el JSON de la publicación.');
  const actual = await obtenerItem(json.id);
  if (!eTag || actual.eTag !== eTag) {
    throw errorPublicacion('PUBLICACION_CONFLICTO', 'El post cambió en SharePoint. Actualiza las publicaciones antes de editarlo.');
  }
  const prefijo = obtenerPrefijoDrive();
  const contenido = await graphClient.getTexto(`${prefijo}/items/${codificarItemId(json.id)}/content`);
  const datos = JSON.parse(contenido.replace(/^\uFEFF/, ''));
  if (!datos || datos.schema_version !== 1 || datos.archivo !== archivo.name) {
    throw new Error('El JSON no corresponde a esta publicación.');
  }
  return { prefijo, json, datos };
}

async function guardarJsonPublicacion({ prefijo, json }, actualizado, eTag) {
  const buffer = Buffer.from(`${JSON.stringify(actualizado, null, 2)}
`, 'utf8');
  if (buffer.length > 128 * 1024) throw new Error('El JSON supera el tamaño permitido.');
  return graphClient.putBinario(
    `${prefijo}/items/${codificarItemId(json.id)}/content`, buffer,
    'application/json; charset=utf-8', { 'If-Match': eTag }
  );
}

async function actualizarTextoPublicacion(publicacionId, texto, eTag) {
  const abierto = await abrirJsonPublicacion(publicacionId, eTag);
  const { datos } = abierto;
  const actualizado = {
    ...datos,
    texto,
    revision: Number.isInteger(datos.revision) ? datos.revision + 1 : 1,
    actualizado_en: new Date().toISOString(),
    estado: 'borrador',
    aprobado_en: null,
    aprobacion: null
  };
  const guardado = await guardarJsonPublicacion(abierto, actualizado, eTag);
  return {
    texto, jsonEtag: guardado.eTag || null, revision: actualizado.revision, estado: actualizado.estado,
    estadoAnterior: typeof datos.estado === 'string' ? datos.estado : '', aprobadoEn: null, aprobacion: null
  };
}

const ESTADO_BLOQUEADO = /aprob|program|publicad/i;

// Taller manual: la versión editada reemplaza el contenido del mismo archivo. Así conserva su id
// (y con él las observaciones y el historial) y SharePoint guarda la versión anterior.
const LIMITE_VERSION_BYTES = 25 * 1024 * 1024;
const TAMANO_TROZO_BYTES = 10 * 320 * 1024; // Graph exige múltiplos de 320 KiB
const TIPOS_VERSION = { png: 'imagen', jpg: 'imagen', webp: 'imagen', pdf: 'pdf' };

function extensionVersion(nombre) {
  const extension = String(nombre || '').split('.').pop().toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension;
}

async function crearSesionSubidaVersion(publicacionId, { nombre, tamano }) {
  const actual = await obtenerItem(publicacionId);
  if (!actual.file) throw errorPublicacion('PUBLICACION_ARCHIVO', 'La publicación no es un archivo.');
  const extensionActual = extensionVersion(actual.name);
  const extensionNueva = extensionVersion(nombre);
  if (!TIPOS_VERSION[extensionNueva]) throw errorPublicacion('PUBLICACION_ARCHIVO', 'Solo se pueden subir imágenes PNG, JPG o WEBP, o PDF.');
  if (extensionActual !== extensionNueva) {
    throw errorPublicacion('PUBLICACION_ARCHIVO', `La versión debe ser ${extensionActual.toUpperCase()}, igual que el archivo actual.`);
  }
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > LIMITE_VERSION_BYTES) {
    throw errorPublicacion('PUBLICACION_ARCHIVO', 'El archivo debe pesar entre 1 byte y 25 MB.');
  }
  const prefijo = obtenerPrefijoDrive();
  const sesion = await graphClient.post(`${prefijo}/items/${codificarItemId(publicacionId)}/createUploadSession`, {
    item: { '@microsoft.graph.conflictBehavior': 'replace' }
  });
  if (!sesion.uploadUrl) throw new Error('SharePoint no devolvió la sesión de subida.');
  return { uploadUrl: sesion.uploadUrl, tamanoTrozo: TAMANO_TROZO_BYTES };
}

function validarUrlSesion(url) {
  let direccion;
  try { direccion = new URL(url); } catch { throw errorPublicacion('PUBLICACION_ARCHIVO', 'La sesión de subida no es válida.'); }
  if (direccion.protocol !== 'https:' || !/(^|\.)sharepoint(-df)?\.com$/i.test(direccion.hostname) || !/uploadSession/i.test(direccion.pathname)) {
    throw errorPublicacion('PUBLICACION_ARCHIVO', 'La sesión de subida no es válida.');
  }
}

async function subirTrozoVersion(uploadUrl, { inicio, fin, total, contenidoBase64 }) {
  validarUrlSesion(uploadUrl);
  const buffer = Buffer.from(contenidoBase64, 'base64');
  const esperado = fin - inicio + 1;
  if (!Number.isInteger(inicio) || !Number.isInteger(fin) || !Number.isInteger(total) || inicio < 0 || fin < inicio || fin >= total
    || total > LIMITE_VERSION_BYTES || buffer.length !== esperado || buffer.length > TAMANO_TROZO_BYTES) {
    throw errorPublicacion('PUBLICACION_ARCHIVO', 'El trozo del archivo no es válido.');
  }
  const { estado } = await graphClient.putSesion(uploadUrl, buffer, inicio, fin, total);
  return { completo: estado === 200 || estado === 201 };
}

// Anota en publicacion.json que hay una versión hecha a mano: vuelve a borrador y anula la aprobación.
async function registrarVersionManual(publicacionId, { eTag, usuario }) {
  const abierto = await abrirJsonPublicacion(publicacionId, eTag);
  const { datos } = abierto;
  const ahora = new Date().toISOString();
  const extension = extensionVersion(datos.archivo);
  const actualizado = {
    ...datos,
    origen: 'manual',
    revision: Number.isInteger(datos.revision) ? datos.revision + 1 : 1,
    estado: 'borrador',
    aprobado_en: null,
    aprobacion: null,
    sha256_archivo: null,
    actualizado_en: ahora,
    versiones: [...(Array.isArray(datos.versiones) ? datos.versiones : []), { archivo: datos.archivo, tipo: TIPOS_VERSION[extension] || null, en: ahora, por: usuario.nombre }].slice(-20)
  };
  const guardado = await guardarJsonPublicacion(abierto, actualizado, eTag);
  return {
    jsonEtag: guardado.eTag || null, revision: actualizado.revision, estado: actualizado.estado, estadoAnterior: typeof datos.estado === 'string' ? datos.estado : '',
    origen: 'manual', aprobadoEn: null, aprobacion: null
  };
}

// Aprobar: confirma el texto exacto que se vio, exige que no queden pendientes y guarda quién,
// para qué red y cuándo. Devolver: vuelve a borrador y deja el motivo. Ninguna cambia el texto.
async function cambiarEstadoPublicacion(publicacionId, { accion, eTag, texto, red, fecha, hora, usuario, motivo, url }) {
  const abierto = await abrirJsonPublicacion(publicacionId, eTag);
  const { datos } = abierto;
  const ahora = new Date().toISOString();
  const estadoAnterior = typeof datos.estado === 'string' ? datos.estado : '';
  let actualizado;

  if (accion === 'aprobar') {
    if (ESTADO_BLOQUEADO.test(estadoAnterior)) throw errorPublicacion('PUBLICACION_ESTADO', 'Esta publicación ya está aprobada.');
    if (datos.texto !== texto) throw errorPublicacion('PUBLICACION_TEXTO_CAMBIO', 'El texto cambió desde que lo revisaste. Actualiza y vuelve a revisarlo.');
    if (Array.isArray(datos.pendientes) && datos.pendientes.length > 0) {
      throw errorPublicacion('PUBLICACION_PENDIENTES', 'La publicación tiene pendientes por completar.');
    }
    actualizado = {
      ...datos, estado: 'aprobado', aprobado_en: ahora, actualizado_en: ahora, devuelto: null,
      aprobacion: { por: usuario.nombre, uid: usuario.uid, red, fecha, hora, revision: Number.isInteger(datos.revision) ? datos.revision : null }
    };
  } else if (accion === 'publicar') {
    if (!/aprob/i.test(estadoAnterior) || /publicad/i.test(estadoAnterior)) {
      throw errorPublicacion('PUBLICACION_ESTADO', 'Solo se puede marcar como publicada una pieza aprobada.');
    }
    if (url && !/^https:\/\/\S{3,490}$/i.test(url)) throw errorPublicacion('PUBLICACION_ESTADO', 'El enlace debe empezar con https://.');
    actualizado = { ...datos, estado: 'publicado', publicado_en: ahora, url_publicada: url || null, actualizado_en: ahora };
  } else if (accion === 'devolver') {
    if (/publicad/i.test(estadoAnterior)) throw errorPublicacion('PUBLICACION_ESTADO', 'La publicación ya salió y no se puede devolver.');
    actualizado = {
      ...datos, estado: 'borrador', aprobado_en: null, aprobacion: null, actualizado_en: ahora,
      devuelto: { motivo, por: usuario.nombre, uid: usuario.uid, en: ahora }
    };
  } else {
    throw new Error('Acción no válida.');
  }

  const guardado = await guardarJsonPublicacion(abierto, actualizado, eTag);
  return {
    jsonEtag: guardado.eTag || null, revision: Number.isInteger(actualizado.revision) ? actualizado.revision : null,
    estado: actualizado.estado, estadoAnterior, aprobadoEn: actualizado.aprobado_en,
    aprobacion: leerAprobacion(actualizado.aprobacion), devuelto: leerDevolucion(actualizado.devuelto),
    publicadoEn: actualizado.publicado_en || null, urlPublicada: actualizado.url_publicada || null
  };
}

module.exports = {
  actualizarTextoPublicacion,
  cambiarEstadoPublicacion,
  crearSesionSubidaVersion,
  subirTrozoVersion,
  registrarVersionManual,
  obtenerLinkDescarga,
  LIMITE_VERSION_BYTES,
  listarPostsRed,
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
