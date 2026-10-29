const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function cargarProveedor(graphClient) {
  const contexto = {
    Buffer,
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
