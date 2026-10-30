// Reglas de la aprobación que se comprueban en la pantalla; el servidor las repite.

export const ROLES_APROBACION = ['gerencia', 'administrador', 'responsable_marketing'];

export function hoyLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

export function estaAprobada(publicacion) {
  return /aprob|program|publicad/i.test(publicacion?.metadatos?.estado || '');
}

// 'borrador' | 'aprobada' | 'publicada': agrupa los estados para colores y filtros.
export function claveEstado(estado) {
  if (/publicad/i.test(estado || '')) return 'publicada';
  if (/aprob|program/i.test(estado || '')) return 'aprobada';
  return 'borrador';
}

export function etiquetaEstado(estado) {
  if (/publicad/i.test(estado || '')) return 'Publicada';
  if (/program/i.test(estado || '')) return 'Programada';
  if (/aprob/i.test(estado || '')) return 'Aprobada';
  return 'Borrador';
}

export function puedeAprobar(usuario, publicacion) {
  return ROLES_APROBACION.includes(usuario?.role) && Boolean(publicacion?.metadatos?.jsonEtag);
}

// Devuelve el mensaje del primer problema, o null si se puede aprobar.
export function validarAprobacion({ red, fecha, hora, revisado }, pendientes = [], hoy = hoyLima()) {
  if (pendientes.length > 0) return 'La publicación tiene pendientes por completar.';
  if (!red) return 'Elige la red donde se publicará.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return 'Elige la fecha de publicación.';
  if (fecha < hoy) return 'La fecha debe ser hoy o posterior.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')) return 'Elige la hora de publicación.';
  if (!revisado) return 'Confirma que revisaste el texto, los datos y las fotos.';
  return null;
}

export function validarMotivo(motivo) {
  const limpio = String(motivo || '').trim();
  if (limpio.length < 3) return 'Escribe el motivo.';
  if (limpio.length > 500) return 'El motivo puede tener hasta 500 caracteres.';
  return null;
}
