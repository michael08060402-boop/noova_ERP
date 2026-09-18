import { parseFechaLocal } from './formatDate.js';

const ESTADOS_ACEPTADOS = new Set(['Aceptada', 'Aprobada']);
const TIPOS_NO_CALIBRABLES = new Set(['servicio', 'epp', 'manga']);

// Los intervalos se guardan en días para mantener compatibilidad con los
// registros existentes del ERP.
export const INTERVALOS_CALIBRACION = [
  { value: '', label: 'No aplica' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '12 meses' }
];

export function esCotizacionAceptada(cotizacion) {
  return ESTADOS_ACEPTADOS.has(cotizacion?.estado);
}

export function esCotizacionDeEquipos(cotizacion) {
  const tipo = String(cotizacion?.tipoItem || '').trim().toLowerCase();
  // Las cotizaciones antiguas no siempre tenían tipoItem; se consideran de
  // equipos salvo que el propio ítem indique otra familia.
  return !tipo || tipo === 'equipo';
}

export function esItemCalibrable(item = {}) {
  const tipo = String(item.tipoItem || item.familia || item.tipo || '')
    .trim()
    .toLowerCase();
  return !TIPOS_NO_CALIBRABLES.has(tipo);
}

// Fecha de aceptación + intervalo de calibración = próxima calibración.
// No se usa updatedAt como respaldo: editar una cotización no debe desplazar
// la programación postventa.
export function calcularProximaCalibracion(fechaAceptacion, intervaloDias) {
  const dias = Number(intervaloDias);
  if (!fechaAceptacion || !dias) return null;

  const base = parseFechaLocal(fechaAceptacion);
  if (Number.isNaN(base.getTime())) return null;

  const resultado = new Date(base);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

// Se conserva para compatibilidad con cualquier llamada antigua, pero la
// pantalla de Calibraciones ya no fuerza un año para todos los equipos.
export function calcularCalibracionAnual(fechaAceptacion) {
  if (!fechaAceptacion) return null;
  const fecha = parseFechaLocal(fechaAceptacion);
  if (Number.isNaN(fecha.getTime())) return null;

  const mes = fecha.getMonth();
  fecha.setFullYear(fecha.getFullYear() + 1);
  if (fecha.getMonth() !== mes) fecha.setDate(0);
  return fecha;
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

// Devuelve únicamente calibraciones próximas o vencidas de equipos vendidos.
// La campana y el módulo Calibraciones comparten exactamente la misma base:
// fechaAceptacion + intervaloCalibracionDias.
export function obtenerCalibracionesProximas(cotizaciones, diasAnticipacion = 30) {
  const resultado = [];

  (cotizaciones || []).forEach((cot) => {
    if (!esCotizacionAceptada(cot) || !esCotizacionDeEquipos(cot)) return;

    const fechaAceptacion = cot.fechaAceptacion;
    if (!fechaAceptacion) return;

    (cot.items || []).forEach((item, index) => {
      if (!esItemCalibrable(item)) return;

      const proxima = calcularProximaCalibracion(
        fechaAceptacion,
        item.intervaloCalibracionDias
      );
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
