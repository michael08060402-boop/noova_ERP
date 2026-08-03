/**
 * Utilidades centralizadas de validación y sanitización.
 * Usadas en formularios, ruteo y servicios para reforzar la seguridad
 * de la aplicación (defensa en profundidad).
 */

// ───────────────────────────────────────────────────────
// Patrones regex (sólo longitud y formato, no semántica)
// ───────────────────────────────────────────────────────

const REGEX = {
  // RUC peruano: 11 dígitos numéricos
  RUC: /^\d{11}$/,
  // Email: RFC 5322 simplificado
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Celular peruano: acepta 9 dígitos, con o sin +51
  CELULAR_PE: /^(\+?51)?\s*9\d{8}$/,
  // Sólo dígitos
  DIGITS: /^\d+$/,
  // Alfanumérico básico (sin símbolos peligrosos)
  ALFANUMERICO: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-_,()#&/]{1,200}$/,
  // Texto de razón social permitido
  RAZON_SOCIAL: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-_,()#&/]{2,150}$/,
  // Mensaje de WhatsApp (permite saltos de línea y emojis comunes)
  MENSAJE_TEXTO: /^[\s\S]{1,4000}$/
};

// ───────────────────────────────────────────────────────
// Límites
// ───────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────
// Sanitización
// ───────────────────────────────────────────────────────

/**
 * Elimina caracteres de control y espacios en los extremos.
 * No modifica contenido legítimo del usuario.
 */
// eslint-disable-next-line no-control-regex
const REGEX_CONTROL_1 = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// eslint-disable-next-line no-control-regex
const REGEX_CONTROL_2 = /[\x00-\x1F\x7F]/g;

export function sanitizarTexto(valor, maxLen = 1000) {
  if (valor == null) return '';
  const str = String(valor);
  // Quita caracteres de control (excepto \n \r \t) y NULL bytes
  const limpio = str.replace(REGEX_CONTROL_1, '');
  return limpio.slice(0, maxLen).trim();
}

/**
 * Sanitiza texto que se mostrará como texto plano en React.
 * React ya escapa automáticamente, pero esto previene entradas maliciosas
 * en pasos previos (logs, almacenamiento, etc.).
 */
export function sanitizarParaLog(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(REGEX_CONTROL_2, '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500)
    .trim();
}

/**
 * Normaliza un número de celular peruano al formato internacional
 * sin "+", espacios ni guiones. Ej: "+51 999 888 777" → "51999888777".
 * Retorna null si el número no es válido.
 */
export function normalizarCelularPE(valor) {
  if (!valor) return null;
  const limpio = String(valor).replace(/[\s\-().]/g, '');
  // Quitar prefijo + si existe
  const sinPlus = limpio.startsWith('+') ? limpio.slice(1) : limpio;
  // Validar formato
  if (!REGEX.CELULAR_PE.test(sinPlus)) return null;
  // Asegurar prefijo 51
  if (sinPlus.startsWith('51')) return sinPlus;
  if (sinPlus.length === 9 && sinPlus.startsWith('9')) return `51${sinPlus}`;
  return null;
}

/**
 * Valida si un número de celular es válido (sin normalizar).
 */
export function esCelularValido(valor) {
  if (!valor) return false;
  const limpio = String(valor).replace(/[\s\-().]/g, '');
  const sinPlus = limpio.startsWith('+') ? limpio.slice(1) : limpio;
  return REGEX.CELULAR_PE.test(sinPlus);
}

// ───────────────────────────────────────────────────────
// Validadores de campos
// ───────────────────────────────────────────────────────

export function validarRUC(valor) {
  if (!valor) return 'El RUC es requerido';
  const v = String(valor).trim();
  if (!REGEX.RUC.test(v)) return 'El RUC debe tener 11 dígitos numéricos';
  // Validación dígito verificador módulo 11 (RUC Perú)
  if (!validarDigitoRUC(v)) return 'RUC inválido (dígito verificador incorrecto)';
  return null;
}

function validarDigitoRUC(ruc) {
  if (!/^\d{11}$/.test(ruc)) return false;
  // Algoritmo módulo 11 para RUC Perú (persona jurídica 20######)
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(ruc[i], 10) * factores[i];
  }
  const resto = suma % 11;
  const dig = (11 - resto) % 10;
  return dig === parseInt(ruc[10], 10);
}

export function validarEmail(valor) {
  if (!valor) return null; // email opcional
  const v = String(valor).trim();
  if (v.length > LIMITES.EMAIL_MAX) return `Máximo ${LIMITES.EMAIL_MAX} caracteres`;
  if (!REGEX.EMAIL.test(v)) return 'Email inválido';
  return null;
}

export function validarRazonSocial(valor) {
  if (!valor) return 'La razón social es requerida';
  const v = String(valor).trim();
  if (v.length < 2) return 'Mínimo 2 caracteres';
  if (v.length > LIMITES.RAZON_SOCIAL_MAX) return `Máximo ${LIMITES.RAZON_SOCIAL_MAX} caracteres`;
  if (!REGEX.RAZON_SOCIAL.test(v)) return 'Contiene caracteres no permitidos';
  return null;
}

export function validarDireccion(valor) {
  if (!valor) return null;
  const v = String(valor).trim();
  if (v.length > LIMITES.DIRECCION_MAX) return `Máximo ${LIMITES.DIRECCION_MAX} caracteres`;
  return null;
}

export function validarNombreContacto(valor) {
  if (!valor) return null;
  const v = String(valor).trim();
  if (v.length > LIMITES.NOMBRE_CONTACTO_MAX) return `Máximo ${LIMITES.NOMBRE_CONTACTO_MAX} caracteres`;
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
  if (!valor) return null; // opcional
  if (!esCelularValido(valor)) {
    return 'Formato inválido. Use 9XXXXXXXX o +51 9XXXXXXXX';
  }
  return null;
}

// ───────────────────────────────────────────────────────
// Rate limiting (cliente, por sesión)
// ───────────────────────────────────────────────────────

const RATE_LIMIT_STORE = new Map();

/**
 * Verifica si una acción puede ejecutarse dado un límite por ventana.
 * @param {string} clave - Identificador de la acción (ej: 'whatsapp-envio')
 * @param {number} maximo - Máximo de ejecuciones permitidas
 * @param {number} ventanaMs - Ventana de tiempo en ms
 * @returns {{ ok: boolean; restante: number; esperaMs?: number }}
 */
export function verificarRateLimit(clave, maximo, ventanaMs, opciones = {}) {
  const ahora = Date.now();
  const entradas = RATE_LIMIT_STORE.get(clave) || [];
  const recientes = entradas.filter(ts => ahora - ts < ventanaMs);

  if (recientes.length >= maximo) {
    const masAntiguo = Math.min(...recientes);
    return { ok: false, restante: 0, esperaMs: ventanaMs - (ahora - masAntiguo) };
  }

  // soloVerificar: solo consulta el estado sin registrar un nuevo intento
  // (usado antes de intentar el login, para no penalizar credenciales correctas)
  if (opciones.soloVerificar) {
    return { ok: true, restante: maximo - recientes.length };
  }

  recientes.push(ahora);
  RATE_LIMIT_STORE.set(clave, recientes);
  return { ok: true, restante: maximo - recientes.length };
}

/**
 * Limpia entradas expiradas de una clave (housekeeping).
 */
export function limpiarRateLimit(clave) {
  RATE_LIMIT_STORE.delete(clave);
}

// ───────────────────────────────────────────────────────
// Detección de patrones sospechosos (XSS injection)
// ───────────────────────────────────────────────────────

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

/**
 * Devuelve true si el texto contiene patrones típicos de XSS/inyección.
 * No es una defensa completa (la defensa principal es el escape de React),
 * pero permite bloquear entradas obviamente maliciosas en formularios.
 */
export function contienePatronPeligroso(valor) {
  if (!valor) return false;
  const v = String(valor);
  return PATRONES_PELIGROSOS.some(p => p.test(v));
}

// ───────────────────────────────────────────────────────
// Exportaciones auxiliares
// ───────────────────────────────────────────────────────

export const LIMITES_CAMPOS = LIMITES;
export const PATRONES_REGEX = REGEX;
