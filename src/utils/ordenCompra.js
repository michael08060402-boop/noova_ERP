const MONEDAS = {
  'US$': { singular: 'DOLAR AMERICANO', plural: 'DOLARES AMERICANOS' },
  'S/': { singular: 'SOL', plural: 'SOLES' }
};

export function formatearCodigoOrden(prefijo, numero, longitud = 6) {
  const limpio = String(prefijo || 'OC').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) || 'OC';
  const secuencia = Math.max(1, Math.trunc(Number(numero) || 1));
  return `${limpio}${String(secuencia).padStart(Math.max(1, Number(longitud) || 6), '0')}`;
}

export function calcularTotalesOrden(items = [], aplicaIgv = true) {
  const subtotal = items.reduce((acum, item) => {
    const cantidad = Math.max(0, Number(item.cantidad) || 0);
    const precio = Math.max(0, Number(item.precioUnitario) || 0);
    return acum + cantidad * precio;
  }, 0);
  const igv = aplicaIgv ? subtotal * 0.18 : 0;
  return {
    subtotal: redondear(subtotal),
    igv: redondear(igv),
    total: redondear(subtotal + igv)
  };
}

function redondear(numero) {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
}

export function validarOrdenCompra(orden) {
  const errores = {};
  if (!orden?.proveedor?.razonSocial?.trim()) errores.proveedor = 'Seleccione un proveedor';
  if (!orden?.fecha) errores.fecha = 'La fecha es requerida';
  if (!orden?.formaPago?.trim()) errores.formaPago = 'La forma de pago es requerida';
  if (!orden?.lugarEntrega?.trim()) errores.lugarEntrega = 'El lugar de entrega es requerido';
  if (!orden?.firmadoPorId?.trim()) errores.firmadoPorId = 'Seleccione quién firma la orden';
  if (!Array.isArray(orden?.items) || orden.items.length === 0) {
    errores.items = 'Agregue al menos un ítem';
  } else {
    const invalido = orden.items.findIndex((item) =>
      !item.descripcion?.trim() || !(Number(item.cantidad) > 0) || Number(item.precioUnitario) < 0
    );
    if (invalido >= 0) errores.items = `Revise la descripción, cantidad y precio del ítem ${invalido + 1}`;
  }
  return errores;
}

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorMil(numero) {
  if (numero === 0) return '';
  if (numero === 100) return 'CIEN';
  const centena = Math.floor(numero / 100);
  const resto = numero % 100;
  const partes = [];
  if (centena) partes.push(CENTENAS[centena]);
  if (resto < 10) {
    if (resto) partes.push(UNIDADES[resto]);
  } else if (resto < 20) {
    partes.push(DIEZ_A_DIECINUEVE[resto - 10]);
  } else if (resto < 30) {
    partes.push(resto === 20 ? 'VEINTE' : `VEINTI${UNIDADES[resto - 20].toLowerCase()}`.toUpperCase());
  } else {
    const decena = Math.floor(resto / 10);
    const unidad = resto % 10;
    partes.push(unidad ? `${DECENAS[decena]} Y ${UNIDADES[unidad]}` : DECENAS[decena]);
  }
  return partes.join(' ');
}

export function numeroALetrasOrden(monto, moneda = 'US$') {
  const valor = Math.max(0, Number(monto) || 0);
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  const partes = [];
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;
  if (millones) partes.push(millones === 1 ? 'UN MILLON' : `${menorMil(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${menorMil(miles)} MIL`);
  if (resto) partes.push(menorMil(resto));
  if (!partes.length) partes.push('CERO');
  const nombres = MONEDAS[moneda] || MONEDAS['US$'];
  const nombreMoneda = entero === 1 ? nombres.singular : nombres.plural;
  return `${partes.join(' ')} CON ${String(centavos).padStart(2, '0')}/100 ${nombreMoneda}`;
}
