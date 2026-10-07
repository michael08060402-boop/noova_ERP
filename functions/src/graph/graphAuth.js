const axios = require('axios');

let tokenCacheado = null;
let tokenExpiracion = 0;

async function obtenerToken() {
  const ahora = Date.now();

  if (tokenCacheado && ahora < tokenExpiracion - 60000) {
    return tokenCacheado;
  }

  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Faltan variables GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET');
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const respuesta = await axios.post(url, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  tokenCacheado = respuesta.data.access_token;
  tokenExpiracion = ahora + respuesta.data.expires_in * 1000;

  return tokenCacheado;
}

function limpiarCache() {
  tokenCacheado = null;
  tokenExpiracion = 0;
}

module.exports = { obtenerToken, limpiarCache };
