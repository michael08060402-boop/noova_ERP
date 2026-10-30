const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function cargarProveedor(graphClient) {
  const contexto = {
    Buffer,
    URL,
    module: { exports: {} },
    process: { env: { GRAPH_DRIVE_TYPE: 'site', GRAPH_DRIVE_ID: 'sitio-prueba' } },
    require: (nombre) => {
      assert.equal(nombre, './graphClient');
      return graphClient;
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'graphDriveProvider.js'), 'utf8'), contexto);
  return contexto.module.exports;
}

test('Publicaciones lista PDF con enlace temporal e imágenes sin consultar su descarga', async () => {
  const consultas = [];
  const proveedor = cargarProveedor({
    getPaginado: async () => [
      { id: 'imagen', name: 'flyer.png', file: { mimeType: 'image/png' }, thumbnails: [{ medium: { url: 'miniatura' } }] },
      { id: 'pdf', name: 'carrusel.pdf', file: { mimeType: 'application/pdf' } },
      { id: 'pdf-extension', name: 'CARRUSEL.PDF', file: { mimeType: 'application/octet-stream' } },
      { id: 'documento', name: 'texto.docx', file: { mimeType: 'application/msword' } },
      { id: 'carpeta', name: 'carpeta.pdf', folder: {} }
    ],
    get: async (endpoint, parametros) => {
      consultas.push(endpoint);
      assert.ok(parametros.$select.includes('@microsoft.graph.downloadUrl'));
      return { '@microsoft.graph.downloadUrl': `https://ejemplo.sharepoint.com${endpoint}` };
    }
  });
  const items = await proveedor.listarArchivosPublicacionCarpeta('borradores');
  assert.equal(items.length, 3);
  assert.equal(items[0].tipo, 'imagen');
  assert.equal(items[0].urlMiniatura, 'miniatura');
  assert.equal(items[0].urlDocumento, null);
  assert.equal(items[1].tipo, 'pdf');
  assert.equal(items[1].urlDocumento, 'https://ejemplo.sharepoint.com/sites/sitio-prueba/drive/items/pdf');
  assert.equal(items[2].tipo, 'pdf');
  assert.deepEqual(consultas, ['/sites/sitio-prueba/drive/items/pdf', '/sites/sitio-prueba/drive/items/pdf-extension']);
});

test('Publicaciones conserva el enlace web cuando Graph no proporciona una descarga de PDF', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async () => [{
      id: 'pdf', name: 'carrusel.pdf', file: { mimeType: 'application/pdf' },
      webUrl: 'https://ejemplo.sharepoint.com/carrusel.pdf'
    }],
    get: async () => ({})
  });
  const [item] = await proveedor.listarArchivosPublicacionCarpeta('borradores');
  assert.equal(item.urlDocumento, null);
  assert.equal(item.urlWeb, 'https://ejemplo.sharepoint.com/carrusel.pdf');
});

test('Relaciona el JSON con el PDF indicado sin duplicar su portada como otro post', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async () => [
      { id: 'pdf', name: 'carrusel.pdf', file: { mimeType: 'application/pdf' } },
      { id: 'portada', name: 'portada.png', file: { mimeType: 'image/png' }, thumbnails: [{ large: { url: 'portada-grande' } }] },
      { id: 'json', name: 'publicacion.json', size: 1000, file: { mimeType: 'application/json' } }
    ],
    getTexto: async (endpoint) => {
      assert.ok(endpoint.endsWith('/items/json/content'));
      return JSON.stringify({
        schema_version: 1, archivo: 'carrusel.pdf', portada: 'portada.png',
        titulo: 'Del campo al estudio', texto: 'Primer párrafo.\n\nSegundo párrafo.',
        red: 'instagram', paginas: 4, estado: 'borrador', pendientes: ['Revisar texto']
      });
    },
    get: async () => ({ '@microsoft.graph.downloadUrl': 'https://ejemplo.sharepoint.com/carrusel.pdf' })
  });
  const items = await proveedor.listarArchivosPublicacionCarpeta('post');
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'pdf');
  assert.equal(items[0].titulo, 'Del campo al estudio');
  assert.equal(items[0].texto, 'Primer párrafo.\n\nSegundo párrafo.');
  assert.equal(items[0].metadatos.paginas, 4);
  assert.equal(items[0].urlGrande, 'portada-grande');
  assert.equal(items[0].aviso, null);
});

test('Un JSON inválido no impide mostrar su imagen y genera un aviso', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async () => [
      { id: 'imagen', name: 'flyer.png', file: { mimeType: 'image/png' } },
      { id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }
    ],
    getTexto: async () => '{json inválido'
  });
  const [item] = await proveedor.listarArchivosPublicacionCarpeta('post');
  assert.equal(item.id, 'imagen');
  assert.equal(item.texto, '');
  assert.ok(item.aviso.includes('No se pudo leer el JSON'));
});

test('Lee los posts de las subcarpetas y mantiene archivos anteriores de la carpeta de red', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async (endpoint) => {
      if (endpoint.endsWith('/items/red/children')) return [
        { id: 'anterior', name: 'anterior.png', file: { mimeType: 'image/png' } },
        { id: 'post', name: 'facebook-flyer', folder: {} }
      ];
      assert.ok(endpoint.endsWith('/items/post/children'));
      return [
        { id: 'nueva', name: 'flyer.png', file: { mimeType: 'image/png' } },
        { id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }
      ];
    },
    getTexto: async () => JSON.stringify({ schema_version: 1, archivo: 'flyer.png', texto: 'Texto del post', titulo: 'Nuevo flyer' })
  });
  const items = await proveedor.listarPostsRed('red');
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'anterior');
  assert.equal(items[1].id, 'nueva');
  assert.equal(items[1].texto, 'Texto del post');
});

test('Los JSON demasiado grandes no se descargan', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async () => [
      { id: 'imagen', name: 'flyer.png', file: { mimeType: 'image/png' } },
      { id: 'json', name: 'publicacion.json', size: 200000, file: { mimeType: 'application/json' } }
    ],
    getTexto: async () => assert.fail('No debe descargar un JSON que supera el límite')
  });
  const [item] = await proveedor.listarArchivosPublicacionCarpeta('post');
  assert.equal(item.id, 'imagen');
  assert.ok(item.aviso);
});

test('La edición actualiza el texto conservando los demás datos y la versión del JSON', async () => {
  let escrito;
  const proveedor = cargarProveedor({
    get: async (endpoint) => endpoint.endsWith('/items/imagen')
      ? { name: 'flyer.png', parentReference: { id: 'post' } }
      : { eTag: 'version-1' },
    getPaginado: async () => [{ id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }],
    getTexto: async () => JSON.stringify({ schema_version: 1, archivo: 'flyer.png', texto: 'Anterior', revision: 2, titulo: 'Conservar título', sha256_archivo: 'conservar-hash', estado: 'aprobado', aprobado_en: '2026-10-29' }),
    putBinario: async (endpoint, buffer, tipo, headers) => {
      assert.ok(endpoint.endsWith('/items/json/content'));
      assert.equal(headers['If-Match'], 'version-1');
      assert.equal(tipo, 'application/json; charset=utf-8');
      escrito = JSON.parse(buffer.toString('utf8'));
      return { eTag: 'version-2' };
    }
  });
  const resultado = await proveedor.actualizarTextoPublicacion('imagen', 'Nuevo texto\n\n#Minería', 'version-1');
  assert.equal(escrito.texto, 'Nuevo texto\n\n#Minería');
  assert.equal(escrito.titulo, 'Conservar título');
  assert.equal(escrito.sha256_archivo, 'conservar-hash');
  assert.equal(escrito.revision, 3);
  assert.equal(escrito.estado, 'borrador');
  assert.equal(escrito.aprobado_en, null);
  assert.equal(resultado.jsonEtag, 'version-2');
});

test('Rechaza editar una versión antigua del post sin escribir en SharePoint', async () => {
  const proveedor = cargarProveedor({
    get: async (endpoint) => endpoint.endsWith('/items/imagen')
      ? { name: 'flyer.png', parentReference: { id: 'post' } }
      : { eTag: 'version-nueva' },
    getPaginado: async () => [{ id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }],
    putBinario: async () => assert.fail('No debe sobrescribir una versión más reciente')
  });
  await assert.rejects(proveedor.actualizarTextoPublicacion('imagen', 'Texto', 'version-vieja'), { code: 'PUBLICACION_CONFLICTO' });
});

function proveedorConJson(datosJson, alEscribir) {
  return cargarProveedor({
    get: async (endpoint) => endpoint.endsWith('/items/imagen')
      ? { name: 'flyer.png', parentReference: { id: 'post' } }
      : { eTag: 'version-1' },
    getPaginado: async () => [{ id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }],
    getTexto: async () => JSON.stringify({ schema_version: 1, archivo: 'flyer.png', revision: 2, ...datosJson }),
    putBinario: async (endpoint, buffer, tipo, headers) => {
      assert.equal(headers['If-Match'], 'version-1');
      alEscribir(JSON.parse(buffer.toString('utf8')));
      return { eTag: 'version-2' };
    }
  });
}

const USUARIO = { nombre: 'Gerencia', uid: 'uid-1' };

test('Aprobar guarda quién, para qué red y cuándo, sin cambiar el texto ni la revisión', async () => {
  let escrito;
  const proveedor = proveedorConJson({ texto: 'Texto final', estado: 'borrador', pendientes: [] }, (datos) => { escrito = datos; });
  const resultado = await proveedor.cambiarEstadoPublicacion('imagen', {
    accion: 'aprobar', eTag: 'version-1', texto: 'Texto final', red: 'linkedin', fecha: '2026-11-16', hora: '09:07', usuario: USUARIO
  });
  assert.equal(escrito.estado, 'aprobado');
  assert.equal(escrito.texto, 'Texto final');
  assert.equal(escrito.revision, 2);
  assert.deepEqual(escrito.aprobacion, { por: 'Gerencia', uid: 'uid-1', red: 'linkedin', fecha: '2026-11-16', hora: '09:07', revision: 2 });
  assert.equal(resultado.estado, 'aprobado');
  assert.equal(resultado.estadoAnterior, 'borrador');
  assert.equal(resultado.aprobacion.red, 'linkedin');
  assert.equal(resultado.jsonEtag, 'version-2');
});

test('No aprueba si el texto cambió, hay pendientes o ya estaba aprobada', async () => {
  const sinEscribir = () => assert.fail('No debe escribir en SharePoint');
  const base = { accion: 'aprobar', eTag: 'version-1', red: 'linkedin', fecha: '2026-11-16', hora: '09:07', usuario: USUARIO };
  await assert.rejects(
    proveedorConJson({ texto: 'Otro texto', estado: 'borrador' }, sinEscribir).cambiarEstadoPublicacion('imagen', { ...base, texto: 'Texto final' }),
    { code: 'PUBLICACION_TEXTO_CAMBIO' }
  );
  await assert.rejects(
    proveedorConJson({ texto: 'Texto final', estado: 'borrador', pendientes: ['Falta la frase de apertura'] }, sinEscribir).cambiarEstadoPublicacion('imagen', { ...base, texto: 'Texto final' }),
    { code: 'PUBLICACION_PENDIENTES' }
  );
  await assert.rejects(
    proveedorConJson({ texto: 'Texto final', estado: 'aprobado' }, sinEscribir).cambiarEstadoPublicacion('imagen', { ...base, texto: 'Texto final' }),
    { code: 'PUBLICACION_ESTADO' }
  );
});

test('Devolver vuelve a borrador, anula la aprobación y deja el motivo', async () => {
  let escrito;
  const proveedor = proveedorConJson({ texto: 'Texto', estado: 'aprobado', aprobado_en: '2026-11-01', aprobacion: { por: 'Gerencia', red: 'linkedin' } }, (datos) => { escrito = datos; });
  const resultado = await proveedor.cambiarEstadoPublicacion('imagen', { accion: 'devolver', eTag: 'version-1', motivo: 'Falta una foto autorizada', usuario: USUARIO });
  assert.equal(escrito.estado, 'borrador');
  assert.equal(escrito.aprobado_en, null);
  assert.equal(escrito.aprobacion, null);
  assert.equal(escrito.devuelto.motivo, 'Falta una foto autorizada');
  assert.equal(resultado.estadoAnterior, 'aprobado');
  assert.equal(resultado.devuelto.por, 'Gerencia');
});

test('Cambiar el estado con una versión antigua no escribe en SharePoint', async () => {
  const proveedor = cargarProveedor({
    get: async (endpoint) => endpoint.endsWith('/items/imagen') ? { name: 'flyer.png', parentReference: { id: 'post' } } : { eTag: 'version-nueva' },
    getPaginado: async () => [{ id: 'json', name: 'publicacion.json', file: { mimeType: 'application/json' } }],
    putBinario: async () => assert.fail('No debe sobrescribir una versión más reciente')
  });
  await assert.rejects(proveedor.cambiarEstadoPublicacion('imagen', { accion: 'devolver', eTag: 'version-vieja', motivo: 'Motivo', usuario: USUARIO }), { code: 'PUBLICACION_CONFLICTO' });
});

test('El listado expone quién aprobó y para cuándo', async () => {
  const proveedor = cargarProveedor({
    getPaginado: async () => [
      { id: 'imagen', name: 'flyer.png', file: { mimeType: 'image/png' } },
      { id: 'json', name: 'publicacion.json', size: 400, file: { mimeType: 'application/json' }, eTag: 'v1' }
    ],
    getTexto: async () => JSON.stringify({
      schema_version: 1, archivo: 'flyer.png', estado: 'aprobado', texto: 'T', aprobado_en: '2026-11-02T15:00:00.000Z',
      aprobacion: { por: 'Gerencia', red: 'facebook', fecha: '2026-11-06', hora: '12:07', revision: 1, uid: 'no-debe-salir' }
    })
  });
  const [item] = await proveedor.listarArchivosPublicacionCarpeta('post');
  assert.equal(item.metadatos.estado, 'aprobado');
  assert.equal(JSON.stringify(item.metadatos.aprobacion), JSON.stringify({ por: 'Gerencia', red: 'facebook', fecha: '2026-11-06', hora: '12:07', revision: 1 }));
});

test('La versión editada debe tener la misma extensión que el archivo actual y un tamaño permitido', async () => {
  const proveedor = cargarProveedor({
    get: async () => ({ name: 'flyer.png', file: { mimeType: 'image/png' } }),
    post: async () => ({ uploadUrl: 'https://noova.sharepoint.com/sites/x/_api/v2.0/drives/d/items/i/uploadSession?guid=1' })
  });
  const sesion = await proveedor.crearSesionSubidaVersion('imagen', { nombre: 'Mi edición.PNG', tamano: 2 * 1024 * 1024 });
  assert.ok(sesion.uploadUrl.includes('uploadSession'));
  assert.equal(sesion.tamanoTrozo % (320 * 1024), 0);
  await assert.rejects(proveedor.crearSesionSubidaVersion('imagen', { nombre: 'edicion.pdf', tamano: 1000 }), { code: 'PUBLICACION_ARCHIVO' });
  await assert.rejects(proveedor.crearSesionSubidaVersion('imagen', { nombre: 'video.mp4', tamano: 1000 }), { code: 'PUBLICACION_ARCHIVO' });
  await assert.rejects(proveedor.crearSesionSubidaVersion('imagen', { nombre: 'grande.png', tamano: 26 * 1024 * 1024 }), { code: 'PUBLICACION_ARCHIVO' });
});

test('Solo acepta subir trozos a sesiones de SharePoint con el tamaño declarado', async () => {
  let rango;
  const proveedor = cargarProveedor({ putSesion: async (url, buffer, inicio, fin, total) => { rango = [inicio, fin, total]; return { estado: 201 }; } });
  const url = 'https://noova.sharepoint.com/sites/x/_api/v2.0/drives/d/items/i/uploadSession?guid=1';
  const contenido = Buffer.alloc(1000).toString('base64');
  const resultado = await proveedor.subirTrozoVersion(url, { inicio: 0, fin: 999, total: 1000, contenidoBase64: contenido });
  assert.equal(resultado.completo, true);
  assert.equal(rango.join(','), '0,999,1000');
  await assert.rejects(proveedor.subirTrozoVersion('https://malicioso.example.com/uploadSession', { inicio: 0, fin: 999, total: 1000, contenidoBase64: contenido }), { code: 'PUBLICACION_ARCHIVO' });
  await assert.rejects(proveedor.subirTrozoVersion('http://noova.sharepoint.com/uploadSession', { inicio: 0, fin: 999, total: 1000, contenidoBase64: contenido }), { code: 'PUBLICACION_ARCHIVO' });
  await assert.rejects(proveedor.subirTrozoVersion(url, { inicio: 0, fin: 500, total: 1000, contenidoBase64: contenido }), { code: 'PUBLICACION_ARCHIVO' });
});

test('Registrar la versión manual vuelve a borrador, anula la aprobación y conserva la lista de versiones', async () => {
  let escrito;
  const proveedor = proveedorConJson({ texto: 'T', estado: 'aprobado', aprobado_en: '2026-11-01', aprobacion: { por: 'Gerencia' }, sha256_archivo: 'viejo' }, (datos) => { escrito = datos; });
  const resultado = await proveedor.registrarVersionManual('imagen', { eTag: 'version-1', usuario: { nombre: 'Editor', uid: 'uid-2' } });
  assert.equal(escrito.origen, 'manual');
  assert.equal(escrito.estado, 'borrador');
  assert.equal(escrito.aprobacion, null);
  assert.equal(escrito.sha256_archivo, null);
  assert.equal(escrito.revision, 3);
  assert.equal(escrito.versiones.length, 1);
  assert.equal(escrito.versiones[0].por, 'Editor');
  assert.equal(resultado.origen, 'manual');
  assert.equal(resultado.estadoAnterior, 'aprobado');
});

test('Marcar como publicada exige una pieza aprobada y guarda cuándo y el enlace', async () => {
  let escrito;
  const base = { accion: 'publicar', eTag: 'version-1', usuario: USUARIO };
  const proveedor = proveedorConJson({ texto: 'T', estado: 'aprobado', aprobado_en: '2026-11-01' }, (datos) => { escrito = datos; });
  const resultado = await proveedor.cambiarEstadoPublicacion('imagen', { ...base, url: 'https://www.linkedin.com/feed/update/123' });
  assert.equal(escrito.estado, 'publicado');
  assert.equal(escrito.url_publicada, 'https://www.linkedin.com/feed/update/123');
  assert.ok(escrito.publicado_en);
  assert.equal(resultado.estado, 'publicado');
  const sinEscribir = () => assert.fail('No debe escribir en SharePoint');
  await assert.rejects(proveedorConJson({ texto: 'T', estado: 'borrador' }, sinEscribir).cambiarEstadoPublicacion('imagen', base), { code: 'PUBLICACION_ESTADO' });
  await assert.rejects(proveedorConJson({ texto: 'T', estado: 'publicado' }, sinEscribir).cambiarEstadoPublicacion('imagen', base), { code: 'PUBLICACION_ESTADO' });
  await assert.rejects(proveedorConJson({ texto: 'T', estado: 'aprobado' }, sinEscribir).cambiarEstadoPublicacion('imagen', { ...base, url: 'javascript:alert(1)' }), { code: 'PUBLICACION_ESTADO' });
});

test('Una publicación ya publicada no se puede devolver a borrador', async () => {
  const proveedor = proveedorConJson({ texto: 'T', estado: 'publicado' }, () => assert.fail('No debe escribir en SharePoint'));
  await assert.rejects(proveedor.cambiarEstadoPublicacion('imagen', { accion: 'devolver', eTag: 'version-1', motivo: 'Motivo', usuario: USUARIO }), { code: 'PUBLICACION_ESTADO' });
});
