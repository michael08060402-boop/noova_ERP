// Lo aprobado por publicar: orden por fecha y hora de Lima y marca de lo atrasado.

export function horaLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora);
}

export function fechaLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

export function momentoPrevisto(publicacion) {
  const { fecha, hora } = publicacion.metadatos?.aprobacion || {};
  return fecha && hora ? `${fecha} ${hora}` : null;
}

// Aprobadas con fecha y hora, que todavía no salieron.
export function porPublicar(publicaciones) {
  return publicaciones
    .filter((p) => /aprob/i.test(p.metadatos?.estado || '') && !/publicad/i.test(p.metadatos?.estado || '') && momentoPrevisto(p))
    .sort((a, b) => momentoPrevisto(a).localeCompare(momentoPrevisto(b)));
}

export function publicadasRecientes(publicaciones, cantidad = 6) {
  return publicaciones
    .filter((p) => /publicad/i.test(p.metadatos?.estado || ''))
    .sort((a, b) => String(b.metadatos?.publicadoEn || '').localeCompare(String(a.metadatos?.publicadoEn || '')))
    .slice(0, cantidad);
}

export function estaAtrasada(publicacion, ahora = new Date()) {
  const previsto = momentoPrevisto(publicacion);
  return Boolean(previsto) && previsto < `${fechaLima(ahora)} ${horaLima(ahora)}`;
}

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function etiquetaDia(fecha, hoy) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
