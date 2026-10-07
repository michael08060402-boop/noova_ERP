const axios = require('axios');
const { obtenerToken } = require('./graphAuth');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TIMEOUT_MS = 30000;

async function get(endpoint, params = {}, headers = {}) {
  const token = await obtenerToken();

  const url = `${GRAPH_BASE}${endpoint}`;
  const config = {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    params,
    timeout: TIMEOUT_MS
  };

  const respuesta = await axios.get(url, config);
  return respuesta.data;
}

async function getPaginado(endpoint, params = {}) {
  const token = await obtenerToken();
  let url = `${GRAPH_BASE}${endpoint}`;

  const resultados = [];
  let paginas = 0;
  const MAX_PAGINAS = 50;

  while (url && paginas < MAX_PAGINAS) {
    const config = {
      headers: { Authorization: `Bearer ${token}` },
      timeout: TIMEOUT_MS
    };

    if (paginas === 0) {
      config.params = params;
    }

    const respuesta = await axios.get(url, config);
    const data = respuesta.data;

    if (data.value) {
      resultados.push(...data.value);
    }

    url = data['@odata.nextLink'] || null;
    paginas++;
  }

  return resultados;
}

async function post(endpoint, body, params = {}) {
  const token = await obtenerToken();

  const url = `${GRAPH_BASE}${endpoint}`;
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    params,
    timeout: TIMEOUT_MS
  };

  const respuesta = await axios.post(url, body, config);
  return respuesta.data;
}

async function patch(endpoint, body, headers = {}) {
  const token = await obtenerToken();

  const url = `${GRAPH_BASE}${endpoint}`;
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers
    },
    timeout: TIMEOUT_MS
  };

  const respuesta = await axios.patch(url, body, config);
  return respuesta.data;
}

async function del(endpoint, headers = {}) {
  const token = await obtenerToken();

  const url = `${GRAPH_BASE}${endpoint}`;
  const config = {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    timeout: TIMEOUT_MS
  };

  await axios.delete(url, config);
}

async function putBinario(endpoint, buffer, contentType) {
  const token = await obtenerToken();

  const url = `${GRAPH_BASE}${endpoint}`;
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType || 'application/octet-stream'
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 60000
  };

  const respuesta = await axios.put(url, buffer, config);
  return respuesta.data;
}

module.exports = { get, getPaginado, post, patch, del, putBinario };
