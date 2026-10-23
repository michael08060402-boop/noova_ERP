export function aBase64(bytes) {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

export function desdeBase64(texto) {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}
