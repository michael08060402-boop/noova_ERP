// Reglas de la subida de versiones editadas a mano (el servidor las repite).

export const LIMITE_VERSION_BYTES = 25 * 1024 * 1024;
export const EXTENSIONES_VERSION = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
export const ROLES_TALLER = ['gerencia', 'administrador', 'responsable_marketing', 'soporte_ti'];

export function extensionDe(nombre) {
  const extension = String(nombre || '').split('.').pop().toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension;
}

export function puedeUsarTaller(usuario, publicacion) {
  return ROLES_TALLER.includes(usuario?.role) && Boolean(publicacion?.metadatos?.jsonEtag);
}

// Devuelve el mensaje del primer problema, o null si el archivo sirve como versión de la pieza.
export function validarArchivoVersion(archivo, nombreActual) {
  if (!archivo) return 'Elige un archivo.';
  const nueva = extensionDe(archivo.name);
  if (!EXTENSIONES_VERSION.includes(nueva)) return 'Solo se pueden subir imágenes PNG, JPG o WEBP, o PDF.';
  const actual = extensionDe(nombreActual);
  if (nueva !== actual) return `La versión debe ser ${actual.toUpperCase()}, igual que el archivo actual. Expórtala en ese formato.`;
  if (archivo.size <= 0) return 'El archivo está vacío.';
  if (archivo.size > LIMITE_VERSION_BYTES) return 'El archivo pesa más de 25 MB.';
  return null;
}

// Rangos [inicio, fin] (inclusive) para subir el archivo por trozos.
export function trozos(total, tamano) {
  const rangos = [];
  for (let inicio = 0; inicio < total; inicio += tamano) {
    rangos.push({ inicio, fin: Math.min(inicio + tamano, total) - 1 });
  }
  return rangos;
}

export function porcentaje(subidos, total) {
  return total > 0 ? Math.min(100, Math.round((subidos / total) * 100)) : 0;
}
