// Cálculos del tablero de Marketing: series, filtros y totales a partir de las capturas automáticas.
import { CUENTAS, FECHA_BASE, FECHA_META, getCuenta, metaEsperada } from './metricasRedes.js';
import { claveEstado } from './aprobacion.js';
import { estaAtrasada, momentoPrevisto, porPublicar, sumarDias } from './calendario.js';

export const PERIODOS = [
  { key: '7', dias: 7, label: '7 días' },
  { key: '30', dias: 30, label: '30 días' },
  { key: 'todo', dias: null, label: 'Todo' }
];

export function cuentasDeRed(red) {
  return red === 'todas' ? CUENTAS : CUENTAS.filter((c) => c.red === red);
}

// Último valor conocido de una cuenta en o antes de una fecha (arrastra el anterior si ese día no hubo lectura).
// Una lectura automática del mismo día de partida reemplaza la cifra de partida.
export function valorEn(capturas, cuentaId, fecha) {
  const cuenta = getCuenta(cuentaId);
  const previas = capturas
    .filter((c) => c.cuenta === cuentaId && Number.isFinite(c.seguidores) && c.fecha <= fecha && c.fecha >= FECHA_BASE)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return previas.length ? previas[0].seguidores : cuenta.base.seguidores;
}

export function valorActual(capturas, cuentaId) {
  return valorEn(capturas, cuentaId, '9999-12-31');
}

// Fechas del eje: la de partida, las lecturas del periodo y la meta a 30 días.
export function fechasDelEje(capturas, cuentas, periodo, hoy) {
  const ids = new Set(cuentas.map((c) => c.id));
  const dias = PERIODOS.find((p) => p.key === periodo)?.dias ?? null;
  const corte = dias ? sumarDias(hoy, -dias) : null;
  const lecturas = capturas
    .filter((c) => ids.has(c.cuenta) && c.fecha > FECHA_BASE && (!corte || c.fecha >= corte))
    .map((c) => c.fecha);
  const fechas = new Set([FECHA_BASE, ...lecturas, FECHA_META]);
  return [...fechas].sort();
}

const redondear = (n) => Math.round(n * 10) / 10;

// Índice base 100: 100 es el punto de partida; las fechas futuras no tienen dato.
export function serieIndice(capturas, cuentas, fechas, hoy) {
  const base = cuentas.reduce((suma, c) => suma + c.base.seguidores, 0);
  return fechas.map((fecha) => {
    if (fecha > hoy && fecha !== FECHA_BASE) return null;
    const total = cuentas.reduce((suma, c) => suma + valorEn(capturas, c.id, fecha), 0);
    return redondear((total / base) * 100);
  });
}

// Recta del punto de partida (100) a la meta esperada, repartida por días.
export function trayectoriaEsperada(cuentas, fechas) {
  const base = cuentas.reduce((suma, c) => suma + c.base.seguidores, 0);
  const meta = cuentas.reduce((suma, c) => suma + metaEsperada(c.id), 0);
  const final = (meta / base) * 100;
  const dia = (fecha) => Date.parse(`${fecha}T12:00:00Z`) / 86400000;
  const total = dia(FECHA_META) - dia(FECHA_BASE);
  return fechas.map((fecha) => redondear(100 + (final - 100) * Math.max(0, Math.min(1, (dia(fecha) - dia(FECHA_BASE)) / total))));
}

export function avanceHaciaMeta(actual, base, meta) {
  if (meta <= base) return 0;
  return Math.max(0, Math.min(100, Math.round(((actual - base) / (meta - base)) * 100)));
}

export function totales(capturas, cuentas) {
  const base = cuentas.reduce((suma, c) => suma + c.base.seguidores, 0);
  const actual = cuentas.reduce((suma, c) => suma + valorActual(capturas, c.id), 0);
  const meta = cuentas.reduce((suma, c) => suma + metaEsperada(c.id), 0);
  return {
    base, actual, meta,
    cambio: actual - base,
    porcentaje: base > 0 ? Math.round(((actual - base) / base) * 1000) / 10 : 0,
    avance: avanceHaciaMeta(actual, base, meta)
  };
}

// Seguidores por red (las dos cuentas de LinkedIn se juntan).
export function audienciaPorRed(capturas, cuentas, nombres) {
  const por = new Map();
  for (const cuenta of cuentas) por.set(cuenta.red, (por.get(cuenta.red) || 0) + valorActual(capturas, cuenta.id));
  return [...por.entries()].map(([red, valor]) => ({ red, label: nombres[red]?.label || red, color: nombres[red]?.color || '#8a97a3', valor })).sort((a, b) => b.valor - a.valor);
}

export function resumenPiezas(publicaciones) {
  const cuenta = { borradores: 0, aprobadas: 0, publicadas: 0 };
  for (const p of publicaciones) {
    const clave = claveEstado(p.metadatos?.estado);
    if (clave === 'borrador') cuenta.borradores += 1;
    else if (clave === 'aprobada') cuenta.aprobadas += 1;
    else cuenta.publicadas += 1;
  }
  return cuenta;
}

export function borradoresParaRevisar(publicaciones, cantidad = 6) {
  return publicaciones
    .filter((p) => claveEstado(p.metadatos?.estado) === 'borrador')
    .sort((a, b) => String(b.fechaModificacion).localeCompare(String(a.fechaModificacion)))
    .slice(0, cantidad);
}

export function proximasPublicaciones(publicaciones, ahora = new Date(), cantidad = 5) {
  return porPublicar(publicaciones)
    .map((p) => ({ publicacion: p, atrasada: estaAtrasada(p, ahora), momento: momentoPrevisto(p) }))
    .slice(0, cantidad);
}

// «hace 3 h», «hace 2 días»
export function haceCuanto(iso, ahora = new Date()) {
  const minutos = Math.max(0, Math.round((ahora - new Date(iso)) / 60000));
  if (!Number.isFinite(minutos)) return '';
  if (minutos < 2) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 1440) return `hace ${Math.round(minutos / 60)} h`;
  return `hace ${Math.round(minutos / 1440)} días`;
}
