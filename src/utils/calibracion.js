import { parseFechaLocal } from './formatDate.js';

export function calcularCalibracionAnual(fechaVenta) {
  const fecha = parseFechaLocal(fechaVenta);
  if (Number.isNaN(fecha.getTime())) return null;
  const mes = fecha.getMonth();
  fecha.setFullYear(fecha.getFullYear() + 1);
  // El aniversario del 29 de febrero cae el 28 en un año no bisiesto.
  if (fecha.getMonth() !== mes) fecha.setDate(0);
  return fecha;
}

// Los intervalos se guardan en días para mantener el formato existente.
export const INTERVALOS_CALIBRACION = [
  { value: '', label: 'No aplica' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '12 meses' }
];

// Fecha de venta + intervalo de calibración (en días) = próxima calibración.
export function calcularProximaCalibracion(fechaVenta, intervaloDias) {
  const dias = Number(intervaloDias);
  if (!fechaVenta || !dias) return null;

  const base = parseFechaLocal(fechaVenta);
  if (Number.isNaN(base.getTime())) return null;

  const resultado = new Date(base);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

// Días entre hoy y una fecha (negativo si ya pasó).
export function diasHasta(fecha) {
  if (!fecha || Number.isNaN(fecha.getTime?.())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha);
  objetivo.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

// Recorre cotizaciones Aceptadas y arma una lista de calibraciones próximas
// o vencidas (dentro de `diasAnticipacion` días), ordenada de más urgente a
// menos urgente.
export function obtenerCalibracionesProximas(cotizaciones, diasAnticipacion = 30) {
  const resultado = [];

  (cotizaciones || []).forEach((cot) => {
    if (cot.estado !== 'Aceptada') return;
    const fechaVenta = cot.fechaAceptacion || cot.updatedAt;
    if (!fechaVenta) return;

    (cot.items || []).forEach((item, index) => {
      const proxima = calcularProximaCalibracion(fechaVenta, item.intervaloCalibracionDias);
      if (!proxima) return;

      const dias = diasHasta(proxima);
      if (dias === null || dias > diasAnticipacion) return;

      resultado.push({
        cotizacionId: cot.id,
        cotizacionCodigo: cot.codigo,
        cliente: cot.cliente?.razonSocial || '',
        itemIndex: index,
        descripcion: item.descripcion || item.codigo || `Ítem ${index + 1}`,
        fecha: proxima,
        dias
      });
    });
  });

  return resultado.sort((a, b) => a.dias - b.dias);
}
