import { useMemo } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

/**
 * Paginacion reutilizable para todas las tablas CRUD.
 * Muestra controles Anterior/Siguiente + números de página.
 *
 * Props:
 * - total: número total de items
 * - paginaActual: página actual (1-indexed)
 * - porPagina: items por página
 * - onCambiarPagina: callback(paginaNueva)
 * - onCambiarPorPagina: callback(nuevoPorPagina)
 */
export default function Paginacion({
  total = 0,
  paginaActual = 1,
  porPagina = 10,
  onCambiarPagina,
  onCambiarPorPagina,
  mostrarInfo = true,
  compacta = false
}) {
  // Calcula total de páginas y rango visible
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaInicio = (paginaActual - 1) * porPagina + 1;
  const paginaFin = Math.min(paginaActual * porPagina, total);

  // Genera números de página a mostrar (máximo 5 alrededor de la actual)
  const paginasVisibles = useMemo(() => {
    const maxVisibles = 5;
    if (totalPaginas <= maxVisibles) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, inicio + maxVisibles - 1);
    inicio = Math.max(1, fin - maxVisibles + 1);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  }, [paginaActual, totalPaginas]);

  // No mostrar paginación si no hay items
  if (total === 0) return null;

  return (
    <div className={`paginacion${compacta ? ' paginacion-compacta' : ''}`}>
      {mostrarInfo && (
        <div className="paginacion-info">
          Mostrando {paginaInicio} a {paginaFin} de {total} registros
        </div>
      )}

      <div className="paginacion-controles">
        {onCambiarPorPagina && (
          <select
            className="selector-paginas"
            value={porPagina}
            onChange={(e) => onCambiarPorPagina(Number(e.target.value))}
            title="Registros por página"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        )}

        <button
          onClick={() => onCambiarPagina(1)}
          disabled={paginaActual === 1}
          title="Primera página"
        >
          <FiChevronsLeft size={14} />
        </button>
        <button
          onClick={() => onCambiarPagina(paginaActual - 1)}
          disabled={paginaActual === 1}
          title="Página anterior"
        >
          <FiChevronLeft size={14} />
        </button>

        {paginasVisibles.map((p) => (
          <button
            key={p}
            onClick={() => onCambiarPagina(p)}
            className={p === paginaActual ? 'pagina-activa' : ''}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onCambiarPagina(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          title="Página siguiente"
        >
          <FiChevronRight size={14} />
        </button>
        <button
          onClick={() => onCambiarPagina(totalPaginas)}
          disabled={paginaActual === totalPaginas}
          title="Última página"
        >
          <FiChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
