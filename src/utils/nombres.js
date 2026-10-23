function palabras(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function mismaPersona(a, b) {
  const corto = palabras(a);
  const largo = palabras(b);
  if (!corto.length || !largo.length) return false;
  const [menor, mayor] = corto.length <= largo.length ? [corto, largo] : [largo, corto];
  const coinciden = menor.every((p) => mayor.includes(p));
  return coinciden && (menor.length >= 2 || menor.length === mayor.length);
}
