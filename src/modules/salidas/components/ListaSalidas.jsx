import { useMemo, useState } from 'react';
import { FiDownload, FiEdit2, FiPackage, FiSearch, FiTrash2 } from 'react-icons/fi';
import Paginacion from '../../../components/Paginacion';
import { formatDate } from '../../../utils/formatDate';
import { completarSalida, formatearCorrelativo, formatearGuia } from '../utils/salida';

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function ListaSalidas({ salidas, ocupado, puedeEliminar, onAbrir, onDescargar, onEliminar }) {
  const [termino, setTermino] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const filtradas = useMemo(() => {
    const t = normalizar(termino.trim());
    return salidas
      .map((s) => completarSalida(s))
      .filter((s) => !t || [formatearGuia(s.guia), formatearCorrelativo(s.formato.correlativo), s.formato.destino]
        .some((v) => normalizar(v).includes(t)));
  }, [salidas, termino]);

  const paginadas = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <>
      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input type="text" placeholder="Buscar por guía, N° de formato o destino..." value={termino} onChange={(e) => { setTermino(e.target.value); setPagina(1); }} />
        </div>
      </div>

      <Paginacion total={filtradas.length} paginaActual={pagina} porPagina={porPagina} onCambiarPagina={setPagina} onCambiarPorPagina={setPorPagina} compacta />

      <div className="tarjeta-tabla">
        {filtradas.length === 0 ? (
          <div className="estado-vacio">
            <FiPackage size={28} />
            <p>{termino ? 'Sin resultados' : 'Aún no hay formatos. Sube una guía de remisión en PDF para empezar.'}</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Formato</th>
                  <th>Guía</th>
                  <th>Fecha de salida</th>
                  <th>Destino</th>
                  <th className="texto-centro">Bienes</th>
                  <th className="texto-centro">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginadas.map((s) => (
                  <tr key={s.id}>
                    <td className="texto-negrita">{formatearCorrelativo(s.formato.correlativo) || 'Sin número'}</td>
                    <td className="texto-codigo">{formatearGuia(s.guia) || '—'}</td>
                    <td>{s.formato.fechaSalida ? formatDate(s.formato.fechaSalida) : '—'}</td>
                    <td className="salidas-destino" title={s.formato.destino}>{s.formato.destino || '—'}</td>
                    <td className="texto-centro">{s.items.length}</td>
                    <td className="texto-centro">
                      <div className="acciones-tabla">
                        <button className="btn-accion" onClick={() => onAbrir(s)} title="Abrir y editar"><FiEdit2 size={18} /></button>
                        <button className="btn-accion" onClick={() => onDescargar(s)} disabled={ocupado} title="Descargar el Excel de esta guía"><FiDownload size={18} /></button>
                        {puedeEliminar && <button className="btn-accion btn-eliminar" onClick={() => onEliminar(s.id)} title="Eliminar"><FiTrash2 size={18} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
