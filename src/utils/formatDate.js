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

export function formatDateISO() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

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
