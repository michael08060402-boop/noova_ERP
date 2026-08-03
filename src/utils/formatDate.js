// Formatea cualquier entrada de fecha a DD/MM/YYYY en hora local.
// Soporta: Date, ISO string, "YYYY-MM-DD", Firestore Timestamp {_seconds,_nanoseconds}.
// Para fechas tipo "YYYY-MM-DD" (sin hora), se interpreta como fecha local
// para evitar el desfase de un día en zonas horarias negativas (Perú = UTC-5).
export function formatDate(date) {
  if (!date) return '';

  let d;

  if (date?.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date?._seconds !== undefined) {
    d = new Date(date._seconds * 1000);
  } else if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Devuelve la fecha de HOY en formato "YYYY-MM-DD" usando la zona horaria
// local del navegador (evita el bug de toISOString() que devuelve UTC).
export function formatDateISO() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

// Convierte cualquier entrada de fecha en un objeto Date interpretado en
// hora local. Útil para comparar fechas sin sufrir el desfase de zona horaria.
export function parseFechaLocal(date) {
  if (!date) return new Date(NaN);

  if (date?.toDate && typeof date.toDate === 'function') {
    return date.toDate();
  }
  if (date?._seconds !== undefined) {
    return new Date(date._seconds * 1000);
  }
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
  }
  return new Date(date);
}
