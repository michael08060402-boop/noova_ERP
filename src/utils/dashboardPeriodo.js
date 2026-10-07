import { parseFechaLocal } from './formatDate.js';

function periodoValido(periodo) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) && Number(periodo.slice(0, 4)) > 0;
}

export function filtrarPorMes(registros, periodo, obtenerFecha) {
  if (!periodoValido(periodo)) return [];
  const [anio, mes] = periodo.split('-').map(Number);
  return registros.filter((registro) => {
    const fecha = parseFechaLocal(obtenerFecha(registro));
    return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1;
  });
}

export const fechaCotizacion = (cotizacion) => cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt;
export const fechaVenta = (cotizacion) => cotizacion.fechaAceptacion || fechaCotizacion(cotizacion);
export const esAceptada = (cotizacion) => ['Aceptada', 'Aprobada'].includes(cotizacion.estado);
