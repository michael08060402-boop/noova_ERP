const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;
const LADO_FOTO = 160;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

export function normalizarClave(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function colorAvatar(clave) {
  const texto = normalizarClave(clave) || '?';
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  const tono = hash % 360;
  return `hsl(${tono} 58% 38%)`;
}

export async function prepararFoto(file) {
  if (!file) throw new Error('Selecciona una imagen.');
  if (!TIPOS_FOTO.includes(file.type)) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  if (file.size > TAMANO_MAXIMO_FOTO) throw new Error('La foto supera 5 MB.');

  const url = URL.createObjectURL(file);
  try {
    const imagen = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = url;
    });
    const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = LADO_FOTO;
    canvas.height = LADO_FOTO;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
    ctx.drawImage(
      imagen,
      (imagen.naturalWidth - lado) / 2,
      (imagen.naturalHeight - lado) / 2,
      lado,
      lado,
      0,
      0,
      LADO_FOTO,
      LADO_FOTO
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
