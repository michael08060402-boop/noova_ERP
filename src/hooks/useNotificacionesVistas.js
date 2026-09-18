import { useEffect, useSyncExternalStore } from 'react';

const memoria = new Map();
const evento = 'noova-notificaciones-vistas';

function leer(clave) {
  if (memoria.has(clave)) return memoria.get(clave);
  try { return localStorage.getItem(clave) || '[]'; }
  catch { return '[]'; }
}

function suscribir(callback) {
  const actualizar = (event) => {
    if (event.type === 'storage') memoria.delete(event.key);
    callback();
  };
  window.addEventListener('storage', actualizar);
  window.addEventListener(evento, actualizar);
  return () => {
    window.removeEventListener('storage', actualizar);
    window.removeEventListener(evento, actualizar);
  };
}

export default function useNotificacionesVistas(uid, notificaciones, abiertas) {
  const clave = `noova:notificaciones-vistas:${uid || 'sin-sesion'}`;
  const guardadas = useSyncExternalStore(suscribir, () => leer(clave));
  let vistas;
  try {
    const datos = JSON.parse(guardadas);
    vistas = new Set(Array.isArray(datos) ? datos : []);
  } catch { vistas = new Set(); }

  const nuevas = notificaciones.filter((n) => !vistas.has(n.key)).length;
  const actuales = JSON.stringify(notificaciones.map((n) => n.key));

  useEffect(() => {
    if (!uid || !abiertas || !nuevas) return;
    let anteriores;
    try { anteriores = JSON.parse(guardadas); } catch { anteriores = []; }
    const valor = JSON.stringify([...new Set([
      ...(Array.isArray(anteriores) ? anteriores : []), ...JSON.parse(actuales)
    ])]);
    memoria.set(clave, valor);
    try { localStorage.setItem(clave, valor); } catch { /* Conserva las vistas durante esta sesión. */ }
    window.dispatchEvent(new Event(evento));
  }, [uid, abiertas, nuevas, actuales, guardadas, clave]);

  return abiertas ? 0 : nuevas;
}
