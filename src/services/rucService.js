import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

// Wrapper directo a la Cloud Function consultarRuc.
// Para autollenado reactivo en inputs, preferir el hook useRucLookup.

let _consultarRucFn = null;

function getFn() {
  if (!_consultarRucFn) {
    _consultarRucFn = httpsCallable(functions, 'consultarRuc', { timeout: 30000 });
  }
  return _consultarRucFn;
}

// Consulta un RUC ante SUNAT a través de la Cloud Function.
// Retorna { ruc, razonSocial, direccion, estado, fuente, consultadoEn }.
export async function consultarRuc(ruc) {
  if (!/^\d{11}$/.test(String(ruc || ''))) {
    throw new Error('El RUC debe tener 11 dígitos numéricos');
  }
  const fn = getFn();
  const result = await fn({ ruc });
  return result.data;
}

// Valida localmente el formato del RUC sin llamar al backend.
export function esRucValido(ruc) {
  const rucStr = String(ruc || '').trim();
  if (!/^\d{11}$/.test(rucStr)) return false;
  const prefijo = rucStr.substring(0, 2);
  return ['10', '15', '17', '20'].includes(prefijo);
}

export default { consultarRuc, esRucValido };
