import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

export default function BarraBusqueda({ onBuscar, onLimpiar, enBusqueda, termino, deshabilitado = false }) {
  const [valor, setValor] = useState(termino || '');
  const timerRef = useRef(null);

  useEffect(() => {
    setValor(termino || '');
  }, [termino]);

  function manejarCambio(nuevoValor) {
    setValor(nuevoValor);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!nuevoValor.trim()) {
      onLimpiar();
      return;
    }

    timerRef.current = setTimeout(() => {
      onBuscar(nuevoValor.trim());
    }, 400);
  }

  function manejarLimpiar() {
    setValor('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onLimpiar();
  }

  function manejarSubmit(e) {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (valor.trim().length >= 2) {
      onBuscar(valor.trim());
    }
  }

  return (
    <form className="nube-busqueda" onSubmit={manejarSubmit}>
      <div className="barra-busqueda">
        <FiSearch size={16} className="icono-busqueda" />
        <input
          type="text"
          placeholder={deshabilitado ? 'Buscar documentos (Próximamente)' : 'Buscar documentos...'}
          value={valor}
          onChange={(e) => manejarCambio(e.target.value)}
          disabled={deshabilitado}
          className={deshabilitado ? 'input-solo-lectura' : ''}
        />
        {valor && !deshabilitado && (
          <button type="button" className="nube-busqueda-limpiar" onClick={manejarLimpiar}>
            <FiX size={14} />
          </button>
        )}
      </div>
      {enBusqueda && (
        <button type="button" className="btn-secundario btn-pequeno nube-btn-limpiar-busqueda" onClick={manejarLimpiar}>
          <FiX size={14} />
          Limpiar
        </button>
      )}
    </form>
  );
}
