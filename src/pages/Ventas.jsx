import { useState, useMemo } from 'react';
import { FiDollarSign, FiSearch } from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { formatDate } from '../utils/formatDate';
import { formatUSD, formatCurrency } from '../utils/formatCurrency';
import { INTERVALOS_CALIBRACION, calcularProximaCalibracion, diasHasta } from '../utils/calibracion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Ventas.css';

const MONEDAS_FORMATO = { 'US$': formatUSD, 'S/': formatCurrency };

function estadoCalibracion(cot, item) {
  if (!Number(item.intervaloCalibracionDias)) return 'sin-calibracion';
  const dias = diasHasta(calcularProximaCalibracion(cot.fechaAceptacion || cot.updatedAt, item.intervaloCalibracionDias));
  if (dias === null) return 'sin-fecha';
  if (dias < 0) return 'vencidas';
  return dias <= 30 ? 'proximas' : 'vigentes';
}

export default function Ventas() {
  const { cotizaciones, loading, editCotizacion } = useCotizaciones();
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [guardandoKey, setGuardandoKey] = useState(null);
  const [filtroCalibracion, setFiltroCalibracion] = useState('todas');
  const ventasAceptadas = useMemo(() => cotizaciones.filter((c) => c.estado === 'Aceptada'), [cotizaciones]);
  const filtros = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'proximas', etiqueta: 'Próximas', detalle: 'Ventas con ítems que vencen en los próximos 30 días' },
    { valor: 'sin-calibracion', etiqueta: 'Sin calibración', detalle: 'Ventas con al menos un ítem marcado como No aplica' },
    { valor: 'vencidas', etiqueta: 'Vencidas', detalle: 'Ventas con al menos un ítem vencido' }
  ].map((filtro) => ({ ...filtro, cantidad: filtro.valor === 'todas' ? ventasAceptadas.length
    : ventasAceptadas.filter((cot) => (cot.items || []).some((item) => estadoCalibracion(cot, item) === filtro.valor)).length }));

  const ventas = (() => {
    const term = terminoBusqueda.trim().toLowerCase();
    return ventasAceptadas
      .filter((c) => filtroCalibracion === 'todas'
        || (c.items || []).some((item) => estadoCalibracion(c, item) === filtroCalibracion))
      .filter((c) => {
        if (!term) return true;
        return (c.codigo || '').toLowerCase().includes(term)
          || (c.cliente?.razonSocial || '').toLowerCase().includes(term);
      })
      .sort((a, b) => String(b.fechaAceptacion || b.updatedAt || '').localeCompare(String(a.fechaAceptacion || a.updatedAt || '')));
  })();

  async function cambiarIntervalo(cot, itemIndex, valor) {
    const key = `${cot.id}-${itemIndex}`;
    setGuardandoKey(key);
    try {
      const nuevosItems = (cot.items || []).map((item, i) => (
        i === itemIndex
          ? { ...item, intervaloCalibracionDias: valor ? Number(valor) : null }
          : item
      ));
      await editCotizacion(cot.id, { items: nuevosItems });
    } catch (err) {
      console.error('Error guardando intervalo de calibración:', err);
    } finally {
      setGuardandoKey(null);
    }
  }

  if (loading) return <Loading message="Cargando ventas..." />;

  return (
    <div className="pagina ventas-pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Ventas</h1>
          <p className="pagina-subtitulo">Seguimiento de ventas y calibraciones</p>
        </div>
      </div>

      <div className="filtros-barra ventas-filtros">
        <div className="ventas-pestanas" role="group" aria-label="Filtrar ventas por calibración">
          {filtros.map((filtro) => (
            <button type="button" key={filtro.valor}
              className={`ventas-pestana${filtroCalibracion === filtro.valor ? ' activa' : ''}`}
              aria-pressed={filtroCalibracion === filtro.valor}
              title={filtro.detalle}
              onClick={() => setFiltroCalibracion(filtro.valor)}>
              {filtro.etiqueta} <span>{filtro.cantidad}</span>
            </button>
          ))}
        </div>
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            aria-label="Buscar ventas por código o cliente"
            placeholder="Buscar por código o cliente..."
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
          />
        </div>
      </div>
      <p className="ventas-resultados">Mostrando {ventas.length} de {ventasAceptadas.length} ventas</p>

      {ventas.length === 0 ? (
        <div className="tarjeta-tabla">
          <div className="estado-vacio">
            <p>{ventasAceptadas.length ? 'No hay ventas que coincidan con los filtros' : 'Todavía no hay cotizaciones aceptadas'}</p>
            <p className="pista">{ventasAceptadas.length ? 'Prueba otro código, cliente o estado de calibración.' : 'En cuanto una cotización pase a "Aceptada" (al generar una orden de compra o emitir el comprobante), va a aparecer acá.'}</p>
          </div>
        </div>
      ) : (
        <div className="ventas-lista">
          {ventas.map((cot) => {
            const formatMoneda = MONEDAS_FORMATO[cot.moneda] || formatUSD;
            const fechaVenta = cot.fechaAceptacion || cot.updatedAt;
            return (
              <div key={cot.id} className="form-card venta-card">
                <div className="form-card-header venta-card-header">
                  <span className="form-card-icon"><FiDollarSign size={16} /></span>
                  <h3>{cot.codigo} · {cot.cliente?.razonSocial || 'Cliente sin nombre'}</h3>
                  <span className="venta-fecha">Vendido: {formatDate(fechaVenta)}</span>
                </div>
                <div className="form-card-body">
                  <div className="tabla-contenedor">
                    <table className="tabla-datos">
                      <thead>
                        <tr>
                          <th>Ítem</th>
                          <th className="texto-derecha">Cant.</th>
                          <th>Calibrar cada</th>
                          <th>Próxima calibración</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cot.items || []).map((item, index) => {
                          const proxima = calcularProximaCalibracion(fechaVenta, item.intervaloCalibracionDias);
                          const dias = diasHasta(proxima);
                          const key = `${cot.id}-${index}`;
                          return (
                            <tr key={index}>
                              <td>{item.descripcion || item.codigo || '-'}</td>
                              <td className="texto-derecha">{item.cantidad}</td>
                              <td>
                                <select
                                  value={!item.intervaloCalibracionDias ? '' : INTERVALOS_CALIBRACION.some((op) => op.value === String(item.intervaloCalibracionDias)) ? String(item.intervaloCalibracionDias) : 'sin-seleccionar'}
                                  onChange={(e) => cambiarIntervalo(cot, index, e.target.value)}
                                  disabled={guardandoKey === key}
                                >
                                  <option value="sin-seleccionar" disabled hidden>Seleccionar intervalo</option>
                                  {INTERVALOS_CALIBRACION.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {proxima ? (
                                  <span className={dias !== null && dias <= 30 ? 'venta-calibracion-proxima' : ''}>
                                    {formatDate(proxima)}
                                    {dias !== null && dias < 0 && ' · vencida'}
                                    {dias !== null && dias >= 0 && dias <= 30 && ` · en ${dias} días`}
                                  </span>
                                ) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="venta-total">Total: <strong>{formatMoneda(cot.total || 0)}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
