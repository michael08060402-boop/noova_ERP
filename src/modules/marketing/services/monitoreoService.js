import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../firebase/config';

function mensajeDeEscucha(error) {
  const denegado = String(error?.code || '').includes('permission-denied');
  return new Error(denegado
    ? 'Tu cuenta no tiene permiso para ver el monitoreo de redes.'
    : 'No se pudo conectar con el monitoreo en tiempo real.');
}

// Escucha las lecturas automáticas en tiempo real. Devuelve la función para dejar de escuchar.
export function escucharCapturas(alCambiar, alFallar) {
  const consulta = query(collection(db, 'marketingRedes'), orderBy('fecha', 'desc'), limit(500));
  return onSnapshot(
    consulta,
    (instantanea) => alCambiar(instantanea.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (error) => alFallar(mensajeDeEscucha(error))
  );
}

// Estado de la conexión de cada cuenta (ok, pendiente, sin_api o error), escrito por el monitoreo.
export function escucharEstadoRedes(alCambiar, alFallar) {
  return onSnapshot(
    doc(db, 'marketingEstadoRedes', 'actual'),
    (instantanea) => alCambiar(instantanea.exists() ? instantanea.data() : null),
    (error) => alFallar(mensajeDeEscucha(error))
  );
}

// «Actualizar ahora»: pide la misma lectura que corre cada día a las 7:00. No recibe números.
export async function actualizarRedesAhora() {
  try {
    const actualizar = httpsCallable(functions, 'marketingActualizarRedes', { timeout: 130000 });
    return (await actualizar()).data;
  } catch (error) {
    const codigo = String(error?.code || '');
    if (codigo.includes('permission-denied')) throw new Error('Tu rol no puede actualizar las redes.');
    if (codigo.includes('resource-exhausted')) throw new Error(error.message || 'Se actualizó hace pocos minutos. Espera un momento.');
    if (codigo.includes('not-found')) throw new Error('El monitoreo automático todavía no está desplegado.');
    throw new Error('No se pudieron leer las redes. Inténtalo de nuevo en unos minutos.');
  }
}
