// Cuentas de Noova que se monitorean y su punto de partida (leído el 2026-10-30, solo lectura pública).
// Los números de partida son estáticos; las capturas nuevas se guardan en Firestore (marketingRedes).

export const FECHA_BASE = '2026-10-30';
// A 30 días de la versión final (31/12/2026): fecha a la que apuntan las metas.
export const FECHA_META = '2027-01-31';

export const CUENTAS = [
  {
    id: 'linkedin-perfil', red: 'linkedin', nombre: 'LinkedIn · perfil Noova Consulting', acceso: true, activa: true,
    base: { seguidores: 5308 },
    datos: ['500+ contactos', 'Última publicación: hace 1 semana', 'Reacciones por publicación: de 1 a 24']
  },
  {
    id: 'linkedin-empresa', red: 'linkedin', nombre: 'LinkedIn · página de empresa', acceso: true, activa: false,
    base: { seguidores: 3700 },
    datos: ['11 a 50 empleados', 'Última publicación: hace 10 meses']
  },
  {
    id: 'facebook', red: 'facebook', nombre: 'Facebook · NOOVA', acceso: true, activa: true,
    base: { seguidores: 7600 },
    datos: ['275 seguidos', '2 opiniones', 'Se usa sobre todo para convocatorias de personal']
  },
  {
    id: 'instagram', red: 'instagram', nombre: 'Instagram · @noova_sac', acceso: false, activa: true,
    base: { seguidores: 552 },
    datos: ['244 publicaciones', '389 seguidos']
  },
  {
    id: 'tiktok', red: 'tiktok', nombre: 'TikTok · @noova.sac', acceso: false, activa: true,
    base: { seguidores: 1279 },
    datos: ['16 videos', '3.320 me gusta', 'Vistas por video: de 157 a 1.175']
  },
  {
    id: 'youtube', red: 'youtube', nombre: 'YouTube · Noova S.A.C.', acceso: false, activa: false,
    base: { seguidores: 159 },
    datos: ['35 videos', 'Videos de hace 2 a 3 años', 'Vistas por video: de 56 a 1.100']
  }
];

// Estimación propia de crecimiento de seguidores a 30 días de la versión final (porcentaje).
// Supone publicar al ritmo acordado y tener la cuenta conectada. No es una medición.
export const ESTIMACION_30_DIAS = {
  'linkedin-perfil': { conservador: 0.8, esperado: 2, optimista: 4 },
  'linkedin-empresa': { conservador: 0.3, esperado: 1, optimista: 2 },
  facebook: { conservador: 0.3, esperado: 1, optimista: 2 },
  instagram: { conservador: 2, esperado: 5, optimista: 9 },
  tiktok: { conservador: 3, esperado: 8, optimista: 15 },
  youtube: { conservador: 1, esperado: 3, optimista: 6 }
};

export function getCuenta(id) {
  return CUENTAS.find((cuenta) => cuenta.id === id) || null;
}

export function calcularVariacion(actual, base) {
  if (!Number.isFinite(actual) || !Number.isFinite(base)) return { absoluta: 0, porcentaje: 0 };
  const absoluta = actual - base;
  const porcentaje = base > 0 ? Math.round((absoluta / base) * 1000) / 10 : 0;
  return { absoluta, porcentaje };
}

// Serie ordenada por fecha: punto de partida y luego cada captura de la cuenta.
export function serieCuenta(capturas, cuentaId) {
  const cuenta = getCuenta(cuentaId);
  if (!cuenta) return [];
  const propias = capturas
    .filter((captura) => captura.cuenta === cuentaId && Number.isFinite(captura.seguidores))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return [{ fecha: FECHA_BASE, seguidores: cuenta.base.seguidores, base: true }, ...propias.filter((c) => c.fecha > FECHA_BASE)];
}

export function ultimoPunto(capturas, cuentaId) {
  const serie = serieCuenta(capturas, cuentaId);
  return serie[serie.length - 1] || null;
}

// Meta esperada en seguidores a 30 días, para comparar contra el valor actual.
export function metaEsperada(cuentaId) {
  const cuenta = getCuenta(cuentaId);
  const estimacion = ESTIMACION_30_DIAS[cuentaId];
  if (!cuenta || !estimacion) return null;
  return Math.round(cuenta.base.seguidores * (1 + estimacion.esperado / 100));
}

// Cifras de partida y de cada escenario a 30 días, para dibujar la barra de metas.
export function rangoMeta(cuentaId) {
  const cuenta = getCuenta(cuentaId);
  const estimacion = ESTIMACION_30_DIAS[cuentaId];
  if (!cuenta || !estimacion) return null;
  const base = cuenta.base.seguidores;
  const en = (porcentaje) => Math.round(base * (1 + porcentaje / 100));
  return { base, conservador: en(estimacion.conservador), esperado: en(estimacion.esperado), optimista: en(estimacion.optimista) };
}

// Posición (0 a 100) de un valor entre dos extremos.
export function posicionEn(valor, desde, hasta) {
  if (hasta <= desde) return 0;
  return Math.max(0, Math.min(100, ((valor - desde) / (hasta - desde)) * 100));
}

export function totalMetaEsperada(soloConAcceso = false) {
  return CUENTAS.filter((cuenta) => !soloConAcceso || cuenta.acceso).reduce((suma, cuenta) => suma + metaEsperada(cuenta.id), 0);
}

export function totalSeguidores(capturas, soloConAcceso = false) {
  return CUENTAS
    .filter((cuenta) => !soloConAcceso || cuenta.acceso)
    .reduce((suma, cuenta) => suma + (ultimoPunto(capturas, cuenta.id)?.seguidores ?? cuenta.base.seguidores), 0);
}

export function totalBase(soloConAcceso = false) {
  return CUENTAS.filter((cuenta) => !soloConAcceso || cuenta.acceso).reduce((suma, cuenta) => suma + cuenta.base.seguidores, 0);
}

export function formatearNumero(valor) {
  return Number.isFinite(valor) ? valor.toLocaleString('es-PE') : '—';
}

export function formatearVariacion({ absoluta, porcentaje }) {
  if (absoluta === 0) return 'Sin cambio';
  const signo = absoluta > 0 ? '+' : '−';
  return `${signo}${formatearNumero(Math.abs(absoluta))} (${signo}${Math.abs(porcentaje).toLocaleString('es-PE')} %)`;
}

export function validarCaptura({ cuenta, fecha, seguidores }) {
  if (!getCuenta(cuenta)) return 'Elige una cuenta de la lista.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return 'La fecha debe tener el formato AAAA-MM-DD.';
  if (String(fecha) <= FECHA_BASE) return `La fecha debe ser posterior al ${FECHA_BASE}, que es el punto de partida.`;
  if (!Number.isInteger(seguidores) || seguidores < 0) return 'Los seguidores deben ser un número entero, sin decimales.';
  return null;
}
