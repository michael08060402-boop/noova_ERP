export function separarHashtags(texto = '') {
  const partes = texto.trim().split(/\n\s*\n/u);
  const ultima = partes.at(-1) || '';
  const tags = ultima.trim().split(/\s+/u);
  if (tags.length && tags.every((tag) => /^#[\p{L}\p{N}_]+$/u.test(tag))) {
    partes.pop();
    return { texto: partes.join('\n\n'), hashtags: ultima.trim() };
  }
  return { texto, hashtags: '' };
}

export function combinarTextoPost(texto, hashtags) {
  const etiquetas = hashtags.trim().split(/[\s,]+/u).filter(Boolean).map((tag) => `#${tag.replace(/^#+/u, '')}`);
  if (etiquetas.some((tag) => !/^#[\p{L}\p{N}_]+$/u.test(tag))) {
    throw new Error('Los hashtags pueden tener letras, números y guion bajo. Sepáralos con espacios.');
  }
  const unicas = [...new Set(etiquetas)];
  const completo = [texto.trim(), unicas.join(' ')].filter(Boolean).join('\n\n');
  if (!completo || completo.length > 32000) throw new Error('El texto completo debe tener entre 1 y 32000 caracteres.');
  return completo;
}
