import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getAvatares, guardarAvatar } from '../services/avatarService';
import { normalizarClave } from '../utils/avatar';

let avatares = [];
let carga = null;
let cargado = false;
const oyentes = new Set();

function emitir(lista) {
  avatares = lista;
  cargado = true;
  oyentes.forEach((oyente) => oyente());
}

function cargar(forzar = false) {
  if (!carga || forzar) {
    carga = getAvatares()
      .then(emitir)
      .catch((err) => {
        console.error('Error cargando fotos de usuario:', err);
        carga = null;
      });
  }
  return carga;
}

function suscribir(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function buscarEn(lista, { uid, email, nombre } = {}) {
  const correo = normalizarClave(email);
  const clave = normalizarClave(nombre);
  const porUid = uid && lista.find((a) => a.uid === uid);
  if (porUid) return porUid;
  const porCorreo = correo && lista.find((a) => normalizarClave(a.email) === correo);
  if (porCorreo) return porCorreo;
  if (!clave) return null;
  const porNombre = lista.find((a) => normalizarClave(a.nombre) === clave);
  if (porNombre) return porNombre;
  const parecidos = lista.filter((a) => {
    const otro = normalizarClave(a.nombre);
    return otro && (otro.startsWith(`${clave} `) || clave.startsWith(`${otro} `));
  });
  return parecidos.length === 1 ? parecidos[0] : null;
}

export function useAvatares() {
  const lista = useSyncExternalStore(suscribir, () => avatares);

  useEffect(() => { cargar(); }, []);

  const buscar = useCallback((datos) => buscarEn(lista, datos), [lista]);

  const guardar = useCallback(async (uid, datos) => {
    await guardarAvatar(uid, datos);
    await cargar(true);
  }, []);

  return { avatares: lista, buscar, guardar };
}

export function useRegistrarUsuario(uid, nombre, email) {
  const lista = useSyncExternalStore(suscribir, () => avatares);

  useEffect(() => {
    if (!uid || !nombre || !cargado) return;
    const actual = lista.find((a) => a.uid === uid);
    const correo = String(email || '').trim().toLowerCase();
    if (actual && actual.nombre === nombre && actual.email === correo) return;
    guardarAvatar(uid, { nombre, email: correo })
      .then(() => cargar(true))
      .catch((err) => console.error('Error registrando usuario en el directorio:', err));
  }, [uid, nombre, email, lista]);
}
