// Lectura automática de seguidores con las APIs oficiales de cada red.
// Nada de leer páginas públicas ni de saltarse protecciones: cada red entra solo cuando tiene sus credenciales.
//   YouTube  → YouTube Data API (secreto YOUTUBE_API_KEY)
//   Facebook → Graph API de Meta (secreto META_ACCESS_TOKEN, token de la página)
//   Instagram→ Graph API de Meta (mismo token; id de la cuenta profesional en marketingConfig/redes)
// TikTok y LinkedIn necesitan una app aprobada por cada plataforma y un perfil personal de LinkedIn no tiene API.

const GRAPH = 'https://graph.facebook.com/v21.0';

const CUENTAS = ['linkedin-perfil', 'linkedin-empresa', 'facebook', 'instagram', 'tiktok', 'youtube'];

const SIN_API = {
  tiktok: 'TikTok exige una app aprobada para dar sus cifras por API. Pendiente.',
  'linkedin-empresa': 'LinkedIn exige acceso aprobado a su API de páginas de empresa. Pendiente.',
  'linkedin-perfil': 'Un perfil personal de LinkedIn no tiene API. Solo una página de empresa puede leerse sola.'
};

function configurado(valor) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto !== '' && texto.toLowerCase() !== 'pendiente';
}

async function pedirJson(fetchFn, url, secretos) {
  const respuesta = await fetchFn(url);
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    let mensaje = cuerpo?.error?.message || `La red respondió ${respuesta.status}.`;
    for (const secreto of secretos) if (secreto) mensaje = mensaje.split(secreto).join('***');
    throw new Error(mensaje);
  }
  return cuerpo;
}

async function leerYoutube({ fetchFn, apiKey, handle }) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(apiKey)}`;
  const canal = (await pedirJson(fetchFn, url, [apiKey])).items?.[0];
  if (!canal) throw new Error('No se encontró el canal.');
  if (canal.statistics.hiddenSubscriberCount) throw new Error('El canal oculta sus suscriptores.');
  return { seguidores: Number(canal.statistics.subscriberCount) };
}

async function leerFacebook({ fetchFn, token, paginaId }) {
  const url = `${GRAPH}/${encodeURIComponent(paginaId)}?fields=followers_count,fan_count&access_token=${encodeURIComponent(token)}`;
  const datos = await pedirJson(fetchFn, url, [token]);
  const seguidores = datos.followers_count ?? datos.fan_count;
  if (!Number.isInteger(seguidores)) throw new Error('Meta no devolvió los seguidores de la página.');
  return { seguidores };
}

async function leerInstagram({ fetchFn, token, usuarioId }) {
  const url = `${GRAPH}/${encodeURIComponent(usuarioId)}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`;
  const datos = await pedirJson(fetchFn, url, [token]);
  if (!Number.isInteger(datos.followers_count)) throw new Error('Meta no devolvió los seguidores de la cuenta.');
  return { seguidores: datos.followers_count };
}

// Un resultado por cuenta: { cuenta, estado: 'ok' | 'pendiente' | 'error' | 'sin_api', seguidores?, mensaje }
async function leerCuentas({ fetchFn, secretos = {}, config = {} }) {
  const tareas = {
    youtube: () => (configurado(secretos.YOUTUBE_API_KEY)
      ? leerYoutube({ fetchFn, apiKey: secretos.YOUTUBE_API_KEY, handle: config.youtubeHandle || '@noovas.a.c.831' })
      : { pendiente: 'Falta el secreto YOUTUBE_API_KEY.' }),
    facebook: () => (configurado(secretos.META_ACCESS_TOKEN)
      ? leerFacebook({ fetchFn, token: secretos.META_ACCESS_TOKEN, paginaId: config.facebookPageId || 'contratistasgeneralesnoovasac' })
      : { pendiente: 'Falta el secreto META_ACCESS_TOKEN.' }),
    instagram: () => {
      if (!configurado(secretos.META_ACCESS_TOKEN)) return { pendiente: 'Falta el secreto META_ACCESS_TOKEN.' };
      if (!configurado(config.instagramUserId)) return { pendiente: 'Falta el id de la cuenta profesional de Instagram (marketingConfig/redes).' };
      return leerInstagram({ fetchFn, token: secretos.META_ACCESS_TOKEN, usuarioId: config.instagramUserId });
    }
  };

  return Promise.all(CUENTAS.map(async (cuenta) => {
    if (SIN_API[cuenta]) return { cuenta, estado: 'sin_api', mensaje: SIN_API[cuenta] };
    try {
      const lectura = await tareas[cuenta]();
      if (lectura.pendiente) return { cuenta, estado: 'pendiente', mensaje: lectura.pendiente };
      return { cuenta, estado: 'ok', seguidores: lectura.seguidores, mensaje: '' };
    } catch (error) {
      return { cuenta, estado: 'error', mensaje: String(error.message || 'No se pudo leer la cuenta.').slice(0, 200) };
    }
  }));
}

// Documentos de capturas para Firestore (id cuenta_fecha: repetir el mismo día corrige, no duplica).
function capturasParaGuardar(resultados, fecha, ahoraIso) {
  return resultados
    .filter((r) => r.estado === 'ok' && Number.isInteger(r.seguidores) && r.seguidores >= 0)
    .map((r) => ({ id: `${r.cuenta}_${fecha}`, datos: { cuenta: r.cuenta, fecha, seguidores: r.seguidores, fuente: 'api', leidoEn: ahoraIso } }));
}

function estadoParaGuardar(resultados, ahoraIso) {
  const cuentas = {};
  for (const r of resultados) {
    cuentas[r.cuenta] = { estado: r.estado, mensaje: r.mensaje || '', ...(r.estado === 'ok' ? { leidoEn: ahoraIso } : {}) };
  }
  return { cuentas, actualizadoEn: ahoraIso };
}

module.exports = { CUENTAS, SIN_API, configurado, leerCuentas, capturasParaGuardar, estadoParaGuardar };
