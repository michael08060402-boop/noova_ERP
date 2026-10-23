export const DIAS_POR_VENCER = 7;
const HORAS_RECIENTE = 2;

export const ESTADOS_VISIBLES = [
  { clave: 'vigente', label: 'Vigente' },
  { clave: 'por-vencer', label: 'Por vencer' },
  { clave: 'vencida', label: 'Vencida' },
  { clave: 'aceptada', label: 'Aceptada' },
  { clave: 'cancelada', label: 'Cancelada' },
  { clave: 'error', label: 'Error' },
  { clave: 'generada', label: 'Sin validez' }
];

const DIA_MS = 86400000;

function fechaLocal(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === 'function') valor = valor.toDate();
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diaMes(fecha) {
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}

export function diasValidez(cot) {
  const n = Number.parseInt(String(cot?.validez ?? '').match(/\d+/)?.[0], 10);
  return Number.isFinite(n) ? n : null;
}

export function estadoVisible(cot, hoy = new Date()) {
  if (cot?.estado === 'Aceptada' || cot?.ordenCompraId) return { clave: 'aceptada', label: 'Aceptada' };
  if (cot?.estado === 'Cancelada') return { clave: 'cancelada', label: 'Cancelada' };
  if (cot?.estado === 'Error') return { clave: 'error', label: 'Error' };

  const emision = fechaLocal(cot?.fechaEmision || cot?.fecha || cot?.createdAt);
  const validez = diasValidez(cot);
  if (!emision || validez === null) return { clave: 'generada', label: 'Sin validez' };

  const vence = new Date(emision.getFullYear(), emision.getMonth(), emision.getDate() + validez);
  const dias = Math.round((vence - fechaLocal(hoy)) / DIA_MS);
  const detalle = `Válida hasta el ${diaMes(vence)}`;

  if (dias < 0) return { clave: 'vencida', label: 'Vencida', dias, vence, detalle };
  if (dias <= DIAS_POR_VENCER) {
    return { clave: 'por-vencer', label: dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'}`, dias, vence, detalle };
  }
  return { clave: 'vigente', label: 'Vigente', dias, vence, detalle };
}

export function actualizacionReciente(cot, ahora = new Date()) {
  const marca = cot?.updatedAt || cot?.createdAt;
  const fecha = marca?.toDate?.() || (marca ? new Date(marca) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return null;
  const minutos = Math.floor((ahora - fecha) / 60000);
  if (minutos < 0 || minutos >= HORAS_RECIENTE * 60) return null;
  const hace = minutos < 1 ? 'hace un momento' : minutos < 60 ? `hace ${minutos} min` : `hace ${Math.floor(minutos / 60)} h`;
  return { minutos, hace, nueva: !cot?.updatedAt || cot.updatedAt === cot.createdAt };
}
