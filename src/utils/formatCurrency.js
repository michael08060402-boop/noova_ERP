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
