const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CUENTAS, capturasParaGuardar, configurado, estadoParaGuardar, leerCuentas } = require('./monitoreoRedes');

const respuesta = (cuerpo, ok = true, estado = 200) => ({ ok, status: estado, json: async () => cuerpo });

test('Sin credenciales todas las cuentas quedan pendientes o sin API, y no se llama a ninguna red', async () => {
  const resultados = await leerCuentas({ fetchFn: async () => assert.fail('No debe llamar a ninguna red'), secretos: {}, config: {} });
  assert.equal(resultados.length, CUENTAS.length);
  const por = Object.fromEntries(resultados.map((r) => [r.cuenta, r.estado]));
  assert.deepEqual(por, { 'linkedin-perfil': 'sin_api', 'linkedin-empresa': 'sin_api', facebook: 'pendiente', instagram: 'pendiente', tiktok: 'sin_api', youtube: 'pendiente' });
});

test('El valor «pendiente» cuenta como secreto sin configurar', () => {
  assert.equal(configurado('pendiente'), false);
  assert.equal(configurado('  '), false);
  assert.equal(configurado(undefined), false);
  assert.equal(configurado('AIza123'), true);
});

test('Lee YouTube, Facebook e Instagram con sus APIs oficiales', async () => {
  const llamadas = [];
  const fetchFn = async (url) => {
    llamadas.push(url);
    if (url.includes('googleapis.com/youtube')) return respuesta({ items: [{ statistics: { subscriberCount: '161', videoCount: '35' } }] });
    if (url.includes('graph.facebook.com') && url.includes('/IG123?')) return respuesta({ followers_count: 560 });
    if (url.includes('graph.facebook.com')) return respuesta({ followers_count: 7650 });
    throw new Error('URL inesperada');
  };
  const resultados = await leerCuentas({
    fetchFn, secretos: { YOUTUBE_API_KEY: 'clave-yt', META_ACCESS_TOKEN: 'token-meta' }, config: { instagramUserId: 'IG123' }
  });
  const seguidores = Object.fromEntries(resultados.filter((r) => r.estado === 'ok').map((r) => [r.cuenta, r.seguidores]));
  assert.deepEqual(seguidores, { youtube: 161, facebook: 7650, instagram: 560 });
  assert.ok(llamadas.some((u) => u.includes('forHandle=%40noovas.a.c.831')));
});

test('Si una red falla, solo esa cuenta queda en error y el mensaje no deja ver el secreto', async () => {
  const fetchFn = async (url) => (url.includes('youtube')
    ? respuesta({ error: { message: 'API key not valid: clave-yt' } }, false, 400)
    : respuesta({ followers_count: 7650 }));
  const resultados = await leerCuentas({ fetchFn, secretos: { YOUTUBE_API_KEY: 'clave-yt', META_ACCESS_TOKEN: 'token' }, config: {} });
  const youtube = resultados.find((r) => r.cuenta === 'youtube');
  assert.equal(youtube.estado, 'error');
  assert.ok(!youtube.mensaje.includes('clave-yt'));
  assert.equal(resultados.find((r) => r.cuenta === 'facebook').estado, 'ok');
});

test('Guarda solo las lecturas correctas, con id por cuenta y fecha, y el estado de todas', () => {
  const resultados = [
    { cuenta: 'facebook', estado: 'ok', seguidores: 7650, mensaje: '' },
    { cuenta: 'youtube', estado: 'error', mensaje: 'fallo' },
    { cuenta: 'tiktok', estado: 'sin_api', mensaje: 'pendiente' }
  ];
  const capturas = capturasParaGuardar(resultados, '2026-11-02', '2026-11-02T12:00:00.000Z');
  assert.deepEqual(capturas.map((c) => c.id), ['facebook_2026-11-02']);
  assert.equal(capturas[0].datos.fuente, 'api');
  const estado = estadoParaGuardar(resultados, '2026-11-02T12:00:00.000Z');
  assert.equal(estado.cuentas.youtube.estado, 'error');
  assert.equal(estado.cuentas.facebook.leidoEn, '2026-11-02T12:00:00.000Z');
  assert.equal(estado.cuentas.youtube.leidoEn, undefined);
});
