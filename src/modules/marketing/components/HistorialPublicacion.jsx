import { useEffect, useState } from 'react';
import { listarHistorial } from '../services/marketingService';

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function detalle(item) {
  const partes = [];
  if (item.red) partes.push(`para ${item.red}`);
  if (item.fecha) partes.push(`${item.fecha}${item.hora ? ` ${item.hora}` : ''}`);
  if (item.motivo) partes.push(`motivo: ${item.motivo}`);
  return partes.join(' · ');
}

// Se carga al abrirlo y se vuelve a cargar cuando cambia la versión de la publicación.
export default function HistorialPublicacion({ publicacionId, version }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return undefined;
    let activo = true;
    listarHistorial(publicacionId)
      .then((lista) => { if (activo) { setItems(lista); setError(''); } })
      .catch((fallo) => { if (activo) setError(fallo.message); });
    return () => { activo = false; };
  }, [abierto, publicacionId, version]);

  return (
    <details className="post-social-historial" onToggle={(event) => setAbierto(event.currentTarget.open)}>
      <summary>Historial de cambios</summary>
      {error && <p role="alert">{error}</p>}
      {!error && items === null && <p>Cargando…</p>}
      {items?.length === 0 && <p>Todavía no hay cambios registrados.</p>}
      <ul>
        {items?.map((item) => (
          <li key={item.id}>
            <strong>{item.usuarioNombre}</strong> {item.accion}
            <time dateTime={item.en}> · {formatoFecha.format(new Date(item.en))}</time>
            {detalle(item) && <span> · {detalle(item)}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
