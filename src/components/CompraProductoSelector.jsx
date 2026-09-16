import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LISTA_PRECIOS_PARTNER_2026 } from '../data/preciosPartner2026';

const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CompraProductoSelector({ value, onChange }) {
  const id = useId();
  const input = useRef(null);
  const lista = useRef(null);
  const [posicion, setPosicion] = useState(null);
  const [activo, setActivo] = useState(0);
  const termino = normalizar(value.trim());
  const productos = LISTA_PRECIOS_PARTNER_2026.filter((producto) =>
    normalizar(producto.descripcion).includes(termino)
    || producto.codigo.replace(/\s/g, '').includes(termino.replace(/\s/g, ''))
  );

  function abrir() {
    const rect = input.current.getBoundingClientRect();
    const arriba = rect.top > 180;
    const ancho = Math.min(380, window.innerWidth - 16);
    setPosicion({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - ancho - 8)),
      width: ancho,
      maxHeight: Math.min(300, arriba ? rect.top - 12 : window.innerHeight - rect.bottom - 12),
      ...(arriba ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
    });
  }

  useEffect(() => {
    if (!posicion) return;
    const cerrar = (event) => {
      if (!lista.current?.contains(event.target)) setPosicion(null);
    };
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [posicion]);

  useEffect(() => {
    lista.current?.children[activo]?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  function seleccionar(producto) {
    onChange(producto.codigo);
    setPosicion(null);
  }

  return <>
    <input
      ref={input}
      value={value}
      role="combobox"
      aria-label="Buscar producto por código o nombre"
      aria-autocomplete="list"
      aria-expanded={Boolean(posicion)}
      aria-controls={posicion ? id : undefined}
      aria-activedescendant={posicion && productos[activo] ? `${id}-${activo}` : undefined}
      autoComplete="off"
      placeholder="Buscar por código o nombre..."
      onFocus={() => { setActivo(0); abrir(); }}
      onClick={abrir}
      onBlur={() => setPosicion(null)}
      onChange={(event) => { onChange(event.target.value); setActivo(0); abrir(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { setPosicion(null); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!posicion) { abrir(); setActivo(0); }
          else setActivo((prev) => Math.max(0, Math.min(productos.length - 1, prev + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && posicion) {
          event.preventDefault();
          if (productos[activo]) seleccionar(productos[activo]);
        }
      }}
    />
    {posicion && createPortal(
      <div ref={lista} id={id} role="listbox" aria-label="Productos Partner" className="compra-productos-lista" style={posicion}>
        {productos.map((producto, index) => <div
          key={producto.codigo}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === activo}
          className="compra-producto-opcion"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => seleccionar(producto)}
          title={`${producto.codigo} · ${producto.descripcion}`}
        >
          <span className="compra-producto-codigo">{producto.codigo}</span>
          <span className="compra-producto-descripcion">{producto.descripcion}</span>
        </div>)}
        {!productos.length && <div className="compra-productos-vacio">Sin coincidencias. Puedes ingresar un código manual.</div>}
      </div>, document.body
    )}
  </>;
}
