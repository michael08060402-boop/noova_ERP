// ============================================================
// Conversión de un monto numérico a su representación en letras
// (español). Se usa para el renglón "SON: ... SOLES" de la
// cotización de EPP en formato factura.
//
//   numeroALetras(276)            -> 'DOSCIENTOS SETENTA Y SEIS CON 00/100'
//   montoEnLetras(276, 'S/')      -> 'SON: DOSCIENTOS SETENTA Y SEIS CON 00/100 SOLES'
//   montoEnLetras(1520.5, 'US$')  -> 'SON: MIL QUINIENTOS VEINTE CON 50/100 DÓLARES AMERICANOS'
//
// Soporta importes de 0 hasta 999 999 999 (mil millones exclusivo),
// suficiente para cualquier cotización. Los decimales se expresan
// como fracción sobre 100 (formato estándar de facturación en Perú).
// ============================================================

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE'
];

const DECENAS = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

// Convierte un entero de 0 a 999 a letras.
function convertirCentena(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const centena = Math.floor(n / 100);
  const resto = n % 100;

  let texto = CENTENAS[centena];

  if (resto > 0) {
    const conector = texto ? ' ' : '';
    if (resto <= 20) {
      texto += conector + UNIDADES[resto];
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      // 21-29 se escriben juntos: VEINTIUNO, VEINTIDÓS...
      if (decena === 2 && unidad > 0) {
        const especiales = ['', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
          'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
        texto += conector + especiales[unidad];
      } else {
        texto += conector + DECENAS[decena];
        if (unidad > 0) texto += ' Y ' + UNIDADES[unidad];
      }
    }
  }

  return texto;
}

// Convierte la parte entera (0 .. 999 999 999) a letras.
function convertirEntero(n) {
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const cientos = n % 1000;

  const partes = [];

  if (millones > 0) {
    if (millones === 1) {
      partes.push('UN MILLÓN');
    } else {
      partes.push(convertirCentena(millones) + ' MILLONES');
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      partes.push('MIL');
    } else {
      partes.push(convertirCentena(miles) + ' MIL');
    }
  }

  if (cientos > 0) {
    partes.push(convertirCentena(cientos));
  }

  return partes.join(' ').trim();
}

// Etiqueta de moneda para el sufijo del texto en letras.
function etiquetaMonedaLetras(codigo) {
  const c = String(codigo || '').toUpperCase();
  if (c === 'S/' || c === 'PEN' || c === 'SOLES' || c === 'SOL') return 'SOLES';
  if (c === 'US$' || c === 'USD' || c === '$' || c === 'DÓLARES' || c === 'DOLARES') return 'DÓLARES AMERICANOS';
  return 'SOLES';
}

// Devuelve solo el texto del número (sin "SON:" ni moneda).
export function numeroALetras(monto) {
  const valor = Number(monto) || 0;
  const negativo = valor < 0;
  const absoluto = Math.abs(valor);

  const entero = Math.floor(absoluto);
  const decimales = Math.round((absoluto - entero) * 100);

  // El redondeo de decimales puede empujar a la siguiente unidad (p. ej. 9.999).
  let enteroFinal = entero;
  let decimalesFinal = decimales;
  if (decimalesFinal === 100) {
    enteroFinal += 1;
    decimalesFinal = 0;
  }

  const letras = convertirEntero(enteroFinal);
  const fraccion = String(decimalesFinal).padStart(2, '0');
  const texto = `${letras} CON ${fraccion}/100`;

  return negativo ? `MENOS ${texto}` : texto;
}

// Texto completo listo para el PDF: "SON: ... SOLES".
export function montoEnLetras(monto, codigoMoneda) {
  return `SON: ${numeroALetras(monto)} ${etiquetaMonedaLetras(codigoMoneda)}`;
}
