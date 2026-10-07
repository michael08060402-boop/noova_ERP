export function formatCurrency(monto) {
  if (monto === null || monto === undefined) return 'S/ 0.00';
  return `S/ ${Number(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatUSD(monto) {
  if (monto === null || monto === undefined) return 'US$ 0.00';
  return `US$ ${Number(monto).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function calcularSubtotal(items) {
  return items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario || 0), 0);
}

export function calcularIGV(subtotal) {
  return subtotal * 0.18;
}

export function calcularTotal(subtotal) {
  return subtotal * 1.18;
}

const TASA_IGV = 0.18;

function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function calcularTotalesCotizacion(items = [], opciones = {}) {
  const { sinIGV = false } = opciones;
  const bruto = calcularSubtotal(items);

  if (sinIGV) {
    const base = redondear2(bruto);
    return { valorVenta: base, subtotal: base, igv: 0, total: base };
  }

  const valorVenta = redondear2(bruto);
  const igv = redondear2(valorVenta * TASA_IGV);
  const total = redondear2(valorVenta + igv);
  return { valorVenta, subtotal: valorVenta, igv, total };
}
