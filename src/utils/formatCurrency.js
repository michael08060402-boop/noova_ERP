// Formatea un monto en Soles (S/)
export function formatCurrency(monto) {
  if (monto === null || monto === undefined) return 'S/ 0.00';
  return `S/ ${Number(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Formatea un monto en Dólares (US$)
export function formatUSD(monto) {
  if (monto === null || monto === undefined) return 'US$ 0.00';
  return `US$ ${Number(monto).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Suma de cantidad * precioUnitario de todos los items
export function calcularSubtotal(items) {
  return items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario || 0), 0);
}

// IGV = 18% del subtotal
export function calcularIGV(subtotal) {
  return subtotal * 0.18;
}

// Total = subtotal + IGV
export function calcularTotal(subtotal) {
  return subtotal * 1.18;
}

// IGV vigente en Perú (18%).
export const TASA_IGV = 0.18;

// Redondea a 2 decimales evitando errores de coma flotante.
export function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Calcula los totales de una cotización de forma centralizada para que el
// resumen del formulario y el PDF coincidan SIEMPRE. Devuelve el valor de
// venta (base gravable), el IGV y el importe total.
//
// opciones:
//   - sinIGV: la operación no aplica IGV (base == total).
//   - preciosIncluyenIGV: los precios unitarios ya incluyen el IGV
//     (comportamiento de la factura de EPP: los importes de línea son el
//     total con IGV y la base se obtiene dividiendo entre 1.18). Esto
//     reproduce exactamente los importes de una factura peruana.
export function calcularTotalesCotizacion(items = [], opciones = {}) {
  const { sinIGV = false, preciosIncluyenIGV = false } = opciones;
  const bruto = calcularSubtotal(items);

  if (sinIGV) {
    const base = redondear2(bruto);
    return { valorVenta: base, subtotal: base, igv: 0, total: base };
  }

  if (preciosIncluyenIGV) {
    const total = redondear2(bruto);
    const valorVenta = redondear2(total / (1 + TASA_IGV));
    const igv = redondear2(total - valorVenta);
    return { valorVenta, subtotal: valorVenta, igv, total };
  }

  const valorVenta = redondear2(bruto);
  const igv = redondear2(valorVenta * TASA_IGV);
  const total = redondear2(valorVenta + igv);
  return { valorVenta, subtotal: valorVenta, igv, total };
}
