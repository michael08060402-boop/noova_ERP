const https = require('https');
const http = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 0;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                   '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let _db = null;
function getDb() {
  if (!_db) {
    if (getApps().length === 0) initializeApp();
    _db = getFirestore();
  }
  return _db;
}

function validarRuc(ruc) {
  if (!ruc) return { valido: false, error: 'RUC no proporcionado' };
  const rucStr = String(ruc).trim();
  if (!/^\d{11}$/.test(rucStr)) {
    return { valido: false, error: 'El RUC debe tener 11 dígitos numéricos' };
  }
  const prefijo = rucStr.substring(0, 2);
  const prefijosValidos = ['10', '15', '17', '20'];
  if (!prefijosValidos.includes(prefijo)) {
    return { valido: false, error: `Prefijo de RUC no válido: ${prefijo}` };
  }
  return { valido: true };
}

function httpRequest(url, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const bodyBuffer = options.body ? Buffer.from(options.body, 'utf8') : null;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        ...(bodyBuffer ? { 'Content-Length': bodyBuffer.length } : {}),
        ...(options.headers || {}),
      },
      timeout: TIMEOUT_MS,
    };

    const req = lib.request(reqOptions, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error(`Demasiados redirects en ${url}`));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        const nextOpts = { ...options };
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
          delete nextOpts.body;
          nextOpts.method = 'GET';
        }
        httpRequest(nextUrl, nextOpts, maxRedirects - 1).then(resolve, reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: res.headers,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout tras ${TIMEOUT_MS}ms consultando ${url}`));
    });

    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

function limpiar(str) {
  if (!str) return '';
  return String(str).replace(/\s+/g, ' ').trim();
}

function normalizarRespuesta(data) {
  return {
    ruc: limpiar(data.ruc),
    razonSocial: limpiar(data.razonSocial),
    direccion: limpiar(data.direccion),
    estado: limpiar(data.estado) || 'ACTIVO',
    condicion: limpiar(data.condicion) || '',
    ubigeo: limpiar(data.ubigeo) || '',
    departamento: limpiar(data.departamento) || '',
    provincia: limpiar(data.provincia) || '',
    distrito: limpiar(data.distrito) || '',
    fuente: data.fuente || 'unknown',
    consultadoEn: new Date().toISOString(),
  };
}

// Fuente: api.apis.net.pe/v1/ruc (gratis, sin token)
async function consultarApisNetPe(ruc) {
  const url = `https://api.apis.net.pe/v1/ruc?numero=${ruc}`;
  const resp = await httpRequest(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (resp.status !== 200) {
    throw new Error(`apis.net.pe devolvió HTTP ${resp.status}`);
  }
  const json = JSON.parse(resp.body);
  if (!json || json.error) {
    throw new Error(`apis.net.pe: ${json?.error || 'respuesta vacía'}`);
  }
  if (!json.nombre) {
    throw new Error('apis.net.pe: respuesta sin razón social');
  }
  return normalizarRespuesta({
    ruc,
    razonSocial: json.nombre,
    direccion: json.direccion || '',
    estado: json.estado || 'ACTIVO',
    condicion: json.condicion || '',
    ubigeo: json.ubigeo || '',
    distrito: json.distrito || '',
    provincia: json.provincia || '',
    departamento: json.departamento || '',
    fuente: 'apis.net.pe',
  });
}

// Lee del cache de Firestore. CACHE_TTL_MS = 0 significa cache permanente.
async function leerCache(ruc) {
  try {
    const db = getDb();
    const docSnap = await db.collection('ruc_cache').doc(ruc).get();
    if (!docSnap.exists) return null;
    const data = docSnap.data();
    if (!data || !data.cachedAt) return null;
    // Si TTL es 0, el cache es permanente
    if (CACHE_TTL_MS > 0) {
      const edad = Date.now() - data.cachedAt;
      if (edad > CACHE_TTL_MS) return null;
    }
    return {
      ...data,
      fuente: data.fuente + '+cache',
      consultadoEn: data.cachedAt,
      desdeCache: true,
    };
  } catch (err) {
    console.warn('[consultarRuc] cache read falló (no bloqueante):', err.message);
    return null;
  }
}

async function escribirCache(datos) {
  try {
    const db = getDb();
    await db.collection('ruc_cache').doc(datos.ruc).set({
      ...datos,
      cachedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[consultarRuc] cache write falló (no bloqueante):', err.message);
  }
}

// Orquesta la consulta: cache permanente -> apis.net.pe.
async function consultarRucCompleto(ruc) {
  // 1. Intentar cache permanente primero
  const cacheado = await leerCache(ruc);
  if (cacheado) {
    console.log('[consultarRuc] cache HIT para', ruc);
    return cacheado;
  }
  console.log('[consultarRuc] cache MISS para', ruc, '— consultando apis.net.pe');

  // 2. Consultar apis.net.pe (única fuente externa)
  try {
    const resultado = await consultarApisNetPe(ruc);
    await escribirCache(resultado);
    return resultado;
  } catch (err) {
    console.warn('[consultarRuc] apis.net.pe falló:', err.message);
    throw new Error(
      `No se pudo consultar el RUC ${ruc}. El servicio de consulta externa ` +
      `(apis.net.pe) está fuera de línea. Si el RUC ya fue consultado antes, ` +
      `los datos están en cache. Detalle: ${err.message}`
    );
  }
}

module.exports = {
  validarRuc,
  consultarRucCompleto,
};
