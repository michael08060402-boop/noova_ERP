const REGEX = {
  RUC: /^\d{11}$/,
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  CELULAR_PE: /^(\+?51)?\s*9\d{8}$/,
  DIGITS: /^\d+$/,
  ALFANUMERICO: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-_,()#&/]{1,200}$/,
  RAZON_SOCIAL: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-_,()#&/]{2,150}$/,
  MENSAJE_TEXTO: /^[\s\S]{1,4000}$/
};

const LIMITES = {
  RAZON_SOCIAL_MAX: 150,
  DIRECCION_MAX: 200,
  RUC_MAX: 11,
  NOMBRE_CONTACTO_MAX: 100,
  CELULAR_MAX: 20,
  EMAIL_MAX: 120,
  MENSAJE_MAX: 4000,
  CARGO_MAX: 80
};

// eslint-disable-next-line no-control-regex
const REGEX_CONTROL_1 = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// eslint-disable-next-line no-control-regex
const REGEX_CONTROL_2 = /[\x00-\x1F\x7F]/g;

export function sanitizarTexto(valor, maxLen = 1000) {
  if (valor == null) return '';
  const str = String(valor);
  const limpio = str.replace(REGEX_CONTROL_1, '');
  return limpio.slice(0, maxLen).trim();
}

export function sanitizarParaLog(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(REGEX_CONTROL_2, '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500)
    .trim();
}

export function normalizarCelularPE(valor) {
  if (!valor) return null;
  const limpio = String(valor).replace(/[\s\-().]/g, '');
  const sinPlus = limpio.startsWith('+') ? limpio.slice(1) : limpio;
  if (!REGEX.CELULAR_PE.test(sinPlus)) return null;
  if (sinPlus.startsWith('51')) return sinPlus;
  if (sinPlus.length === 9 && sinPlus.startsWith('9')) return `51${sinPlus}`;
  return null;
}

export function esCelularValido(valor) {
  if (!valor) return false;
  const limpio = String(valor).replace(/[\s\-().]/g, '');
  const sinPlus = limpio.startsWith('+') ? limpio.slice(1) : limpio;
  return REGEX.CELULAR_PE.test(sinPlus);
}

export function validarEmail(valor) {
  if (!valor) return null;
  const v = String(valor).trim();
  if (v.length > LIMITES.EMAIL_MAX) return `Máximo ${LIMITES.EMAIL_MAX} caracteres`;
  if (!REGEX.EMAIL.test(v)) return 'Email inválido';
  return null;
}

export function validarMensajeWhatsapp(valor) {
  if (!valor) return 'El mensaje es requerido';
  const v = String(valor);
  if (v.trim().length === 0) return 'El mensaje no puede estar vacío';
  if (v.length > LIMITES.MENSAJE_MAX) return `Máximo ${LIMITES.MENSAJE_MAX} caracteres`;
  return null;
}

export function validarCelular(valor) {
  if (!valor) return null;
  if (!esCelularValido(valor)) {
    return 'Formato inválido. Use 9XXXXXXXX o +51 9XXXXXXXX';
  }
  return null;
}

const RATE_LIMIT_STORE = new Map();

export function verificarRateLimit(clave, maximo, ventanaMs, opciones = {}) {
  const ahora = Date.now();
  const entradas = RATE_LIMIT_STORE.get(clave) || [];
  const recientes = entradas.filter(ts => ahora - ts < ventanaMs);

  if (recientes.length >= maximo) {
    const masAntiguo = Math.min(...recientes);
    return { ok: false, restante: 0, esperaMs: ventanaMs - (ahora - masAntiguo) };
  }

  if (opciones.soloVerificar) {
    return { ok: true, restante: maximo - recientes.length };
  }

  recientes.push(ahora);
  RATE_LIMIT_STORE.set(clave, recientes);
  return { ok: true, restante: maximo - recientes.length };
}

export function limpiarRateLimit(clave) {
  RATE_LIMIT_STORE.delete(clave);
}

const PATRONES_PELIGROSOS = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript:/i,
  /on\w+\s*=\s*["'][^"']*["']/i,
  /<iframe[\s\S]*?>/i,
  /<embed[\s\S]*?>/i,
  /<object[\s\S]*?>/i,
  /data:text\/html/i
];

export function contienePatronPeligroso(valor) {
  if (!valor) return false;
  const v = String(valor);
  return PATRONES_PELIGROSOS.some(p => p.test(v));
}
