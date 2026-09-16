import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiFileText, FiCheckCircle, FiTrendingUp, FiTool, FiBarChart2, FiPieChart, FiShoppingCart, FiUsers } from 'react-icons/fi';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useClientes } from '../hooks/useClientes';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useEquipos } from '../hooks/useEquipos';
import { useOrdenesCompra } from '../hooks/useOrdenesCompra';
import { useAuth } from '../context/AuthContext';
import { tienePermiso } from '../services/userService';
import { formatDate, parseFechaLocal } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import { obtenerCalibracionesProximas } from '../utils/calibracion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORES = {
  azulPrimario: '#064C70',
  azulOscuro: '#079BB5',
  verde: '#00a66c',
  rojo: '#ef5777',
  amarillo: '#C8D91E',
  gris: '#9aadc4'
};

const ESTADOS = ['Generada', 'Aceptada', 'Error', 'Cancelada'];
const COLORES_ESTADO = {
  Generada: COLORES.azulPrimario,
  Aceptada: COLORES.verde,
  Error: COLORES.rojo,
  Cancelada: COLORES.gris
};

const ESTADO_EQUIVALENTE = {
  Borrador: 'Generada',
  Enviada: 'Generada',
  Aprobada: 'Aceptada',
  Rechazada: 'Error'
};

const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORES_CATEGORIAS = [COLORES.azulPrimario, COLORES.azulOscuro, COLORES.amarillo, COLORES.verde, COLORES.rojo, COLORES.gris];

const opcionesGrafico = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#506584', font: { size: 11 } } },
    y: { grid: { color: '#eaf0f7' }, ticks: { color: '#506584', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
  }
};

const opcionesDoughnut = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  cutout: '70%',
  plugins: { legend: { display: false } }
};

const opcionesLine = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#506584', font: { size: 10 } } },
    y: { grid: { color: '#eaf0f7' }, ticks: { color: '#506584', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
  }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const puedeVerClientes = tienePermiso(userProfile, 'clientes');
  const puedeVerCotizaciones = tienePermiso(userProfile, 'cotizaciones');
  const puedeVerEquipos = tienePermiso(userProfile, 'equipos');
  const puedeVerCompras = tienePermiso(userProfile, 'compras');
  const { clientes, loading: cargandoClientes } = useClientes(puedeVerClientes);
  const { cotizaciones, loading: cargandoCotizaciones } = useCotizaciones(puedeVerCotizaciones);
  const { equipos, loading: cargandoEquipos } = useEquipos(puedeVerEquipos);
  const { ordenes, loading: cargandoOrdenes } = useOrdenesCompra(puedeVerCompras);
  const [rankingClientes, setRankingClientes] = useState('cotizaciones');

  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  // --- Datos memoizados ---
  const cotizacionesMes = useMemo(() => {
    return cotizaciones.filter((c) => {
      const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });
  }, [cotizaciones, mesActual, anioActual]);

  const ventasAprobadas = useMemo(
    () => cotizaciones.filter((cotizacion) => ['Aceptada', 'Aprobada'].includes(cotizacion.estado)),
    [cotizaciones]
  );

  const ventasMes = useMemo(
    () => ventasAprobadas.filter((cotizacion) => {
      const fecha = parseFechaLocal(cotizacion.fechaAceptacion || cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt);
      return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
    }),
    [ventasAprobadas, mesActual, anioActual]
  );

  const calibracionesProximas = useMemo(
    () => obtenerCalibracionesProximas(cotizaciones),
    [cotizaciones]
  );

  const tasaAceptacion = useMemo(() => {
    if (!cotizaciones.length) return 0;
    const aceptadas = cotizaciones.filter((item) => ['Aceptada', 'Aprobada'].includes(item.estado)).length;
    return Math.round((aceptadas / cotizaciones.length) * 100);
  }, [cotizaciones]);

  const cotizacionesRecientes = useMemo(() => {
    return [...cotizaciones]
      .sort((a, b) => parseFechaLocal(b.fechaEmision || b.fecha || b.createdAt) - parseFechaLocal(a.fechaEmision || a.fecha || a.createdAt))
      .slice(0, 8);
  }, [cotizaciones]);

  const conteoEstados = useMemo(() => {
    return ESTADOS.reduce((acc, estado) => {
      acc[estado] = cotizaciones.filter((cotizacion) => (
        (ESTADO_EQUIVALENTE[cotizacion.estado] || cotizacion.estado) === estado
      )).length;
      return acc;
    }, {});
  }, [cotizaciones]);

  const datosEstados = useMemo(() => ({
    labels: ESTADOS,
    datasets: [{
      data: ESTADOS.map(e => conteoEstados[e] || 0),
      backgroundColor: ESTADOS.map(e => COLORES_ESTADO[e]),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [conteoEstados]);

  const resumenEstados = useMemo(() => {
    const total = ESTADOS.reduce((suma, estado) => suma + conteoEstados[estado], 0);
    return ESTADOS.map((estado) => ({
      nombre: {
        Generada: 'Pendientes',
        Aceptada: 'Aprobadas',
        Error: 'Rechazadas',
        Cancelada: 'Canceladas'
      }[estado],
      cantidad: conteoEstados[estado],
      porcentaje: total ? Math.round((conteoEstados[estado] / total) * 100) : 0,
      color: COLORES_ESTADO[estado]
    }));
  }, [conteoEstados]);

  const ultimos12Meses = useMemo(() => {
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1);
      meses.push({
        label: NOMBRES_MESES[d.getMonth()],
        month: d.getMonth(),
        year: d.getFullYear()
      });
    }
    return meses;
  }, [anioActual, mesActual]);

  const datosMensuales = useMemo(() => ({
    labels: ultimos12Meses.map(m => m.label),
    datasets: [
      {
        label: 'Cotizaciones',
        data: ultimos12Meses.map(m => cotizaciones.filter(c => {
          const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        }).length),
        backgroundColor: '#064770',
        borderRadius: 4,
        maxBarThickness: 17
      },
      {
        label: 'Aprobadas',
        data: ultimos12Meses.map(m => cotizaciones.filter(c => {
          const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
          return ['Aceptada', 'Aprobada'].includes(c.estado)
            && d.getMonth() === m.month
            && d.getFullYear() === m.year;
        }).length),
        backgroundColor: '#00a66c',
        borderRadius: 4,
        maxBarThickness: 17
      }
    ]
  }), [ultimos12Meses, cotizaciones]);

  const conteoCategorias = useMemo(() => {
    return equipos.reduce((acc, equipo) => {
      const categoria = equipo.categoria || 'Sin categoría';
      acc[categoria] = (acc[categoria] || 0) + 1;
      return acc;
    }, {});
  }, [equipos]);

  const categoriasVisibles = useMemo(() => {
    const ordenadas = Object.entries(conteoCategorias)
      .sort(([, totalA], [, totalB]) => totalB - totalA);
    const principales = ordenadas.slice(0, 5);
    const totalOtros = ordenadas
      .slice(5)
      .reduce((total, [, cantidad]) => total + cantidad, 0);

    return totalOtros > 0
      ? [...principales, ['Otros', totalOtros]]
      : principales;
  }, [conteoCategorias]);

  const datosCategorias = useMemo(() => ({
    labels: categoriasVisibles.map(([nombre]) => nombre),
    datasets: [{
      data: categoriasVisibles.map(([, cantidad]) => cantidad),
      backgroundColor: categoriasVisibles.map((_, i) => COLORES_CATEGORIAS[i % COLORES_CATEGORIAS.length]),
      borderWidth: 0
    }]
  }), [categoriasVisibles]);

  const totalEquipos = useMemo(
    () => Object.values(conteoCategorias).reduce((total, cantidad) => total + cantidad, 0),
    [conteoCategorias]
  );

  const datosVentasMensuales = useMemo(() => ({
    labels: ultimos12Meses.map((m) => m.label),
    datasets: [{
      label: 'Ventas confirmadas',
      data: ultimos12Meses.map((m) => cotizaciones.filter((cot) => {
        const fecha = parseFechaLocal(cot.fechaAceptacion || cot.fechaEmision || cot.fecha || cot.createdAt);
        return ['Aceptada', 'Aprobada'].includes(cot.estado)
          && fecha.getMonth() === m.month
          && fecha.getFullYear() === m.year;
      }).length),
      borderColor: '#16b67a',
      backgroundColor: 'rgba(22, 182, 122, 0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      borderWidth: 2
    }]
  }), [ultimos12Meses, cotizaciones]);

  const datosComprasMensuales = useMemo(() => ({
    labels: ultimos12Meses.map((m) => m.label),
    datasets: [{
      label: 'Órdenes de compra',
      data: ultimos12Meses.map((m) => ordenes.filter((orden) => {
        const fecha = parseFechaLocal(orden.fecha || orden.createdAt);
        return fecha.getMonth() === m.month && fecha.getFullYear() === m.year;
      }).length),
      backgroundColor: '#f58b14',
      borderRadius: 4,
      maxBarThickness: 28
    }]
  }), [ultimos12Meses, ordenes]);

  const clientesDestacados = useMemo(() => {
    const conteo = cotizaciones.reduce((acumulado, cotizacion) => {
      const nombre = cotizacion.cliente?.razonSocial || 'Cliente sin nombre';
      if (!acumulado[nombre]) acumulado[nombre] = { cotizaciones: 0, ventas: 0 };
      acumulado[nombre].cotizaciones += 1;
      if (['Aceptada', 'Aprobada'].includes(cotizacion.estado)) {
        acumulado[nombre].ventas += Number(cotizacion.total) || 0;
      }
      return acumulado;
    }, {});
    return Object.entries(conteo)
      .map(([nombre, valores]) => ({
        nombre,
        valor: valores[rankingClientes]
      }))
      .filter((cliente) => cliente.valor > 0)
      .sort((clienteA, clienteB) => clienteB.valor - clienteA.valor)
      .slice(0, 5);
  }, [cotizaciones, rankingClientes]);

  const cotizacionesMesAnterior = useMemo(() => {
    const anterior = new Date(anioActual, mesActual - 1, 1);
    return cotizaciones.filter((cotizacion) => {
      const fecha = parseFechaLocal(cotizacion.fechaEmision || cotizacion.fecha || cotizacion.createdAt);
      return fecha.getMonth() === anterior.getMonth() && fecha.getFullYear() === anterior.getFullYear();
    }).length;
  }, [cotizaciones, mesActual, anioActual]);
  const variacionCotizaciones = cotizacionesMesAnterior
    ? Math.round(((cotizacionesMes.length - cotizacionesMesAnterior) / cotizacionesMesAnterior) * 100)
    : null;
  const totalCotizacionesMes = cotizacionesMes.reduce((total, cotizacion) => total + (Number(cotizacion.total) || 0), 0);
  const totalVentasMes = ventasMes.reduce((total, cotizacion) => total + (Number(cotizacion.total) || 0), 0);
  const rangoGraficos = `${NOMBRES_MESES[ultimos12Meses[0].month]} ${ultimos12Meses[0].year} – ${NOMBRES_MESES[mesActual]} ${anioActual}`;

  // --- Render ---
  if (cargandoClientes || cargandoCotizaciones || cargandoEquipos || cargandoOrdenes) {
    return <Loading message="Cargando dashboard..." />;
  }

  const badgeEstado = (estado) => (
    <span className={`badge-estado ${(estado || 'borrador').toLowerCase()}`}>
      {estado}
    </span>
  );

  return (
    <div className="pagina dashboard">
      <header className="dashboard-heading">
        <div>
          <h1>Dashboard Principal</h1>
        </div>
      </header>

      <div className="dashboard-kpis" aria-label="Indicadores principales">
        {puedeVerCotizaciones ? (
          <>
            <article className="dashboard-kpi dashboard-kpi-featured">
              <div className="dashboard-kpi-heading">
                <div className="dashboard-kpi-icon dashboard-kpi-icon-blue"><FiFileText /></div>
                <h2>Cotizaciones del mes</h2>
              </div>
              <div className="dashboard-kpi-value">
                <strong>{cotizacionesMes.length}</strong>
                {variacionCotizaciones !== null && <span className="dashboard-trend" title="Variación frente al mes anterior" aria-label={`${variacionCotizaciones}% frente al mes anterior`}>{variacionCotizaciones > 0 ? '+' : ''}{variacionCotizaciones}%</span>}
              </div>
              <p className="dashboard-kpi-description"><b>{formatCurrency(totalCotizacionesMes)}</b> en total</p>
              <div className="dashboard-kpi-footnote">
                <span>Mes anterior</span>
                <b>{cotizacionesMesAnterior} cotizaciones</b>
              </div>
            </article>
            <article className="dashboard-kpi">
              <div className="dashboard-kpi-heading">
                <div className="dashboard-kpi-icon dashboard-kpi-icon-green"><FiUsers /></div>
                <h2>Tasa de aceptación</h2>
              </div>
              <div className="dashboard-kpi-value"><strong>{tasaAceptacion}%</strong><span className="dashboard-value-caption">de conversión</span></div>
              <p className="dashboard-kpi-description"><b className="dashboard-positive">{ventasAprobadas.length} aprobadas</b> de {cotizaciones.length} en total</p>
              <div className="dashboard-acceptance">
                <div><span>Conversión histórica</span><b>{tasaAceptacion}%</b></div>
                <meter min="0" max="100" value={tasaAceptacion} aria-label="Tasa de aceptación" />
              </div>
            </article>
            <article className="dashboard-kpi">
              <div className="dashboard-kpi-heading">
                <div className="dashboard-kpi-icon dashboard-kpi-icon-sales"><FiShoppingCart /></div>
                <h2>Ventas del mes</h2>
              </div>
              <div className="dashboard-kpi-value"><strong>{ventasMes.length}</strong><FiTrendingUp className="dashboard-sales-icon" aria-hidden="true" /></div>
              <p className="dashboard-kpi-description"><b>{formatCurrency(totalVentasMes)}</b> en aprobadas</p>
              <div className="dashboard-kpi-footnote">
                <span>Importe promedio</span><b>{formatCurrency(ventasMes.length ? totalVentasMes / ventasMes.length : 0)}</b>
              </div>
            </article>
            <article className="dashboard-kpi">
              <div className="dashboard-kpi-heading">
                <div className="dashboard-kpi-icon dashboard-kpi-icon-amber"><FiTool /></div>
                <h2>Calibraciones próximas</h2>
              </div>
              <div className="dashboard-kpi-value"><strong>{calibracionesProximas.length}</strong><span className="dashboard-status-chip">{calibracionesProximas.length ? 'Por revisar' : 'Sin alertas'}</span></div>
              <p className="dashboard-kpi-description">Hasta 30 días, incluidas vencidas</p>
              <div className="dashboard-calibration-note"><FiCheckCircle aria-hidden="true" /><span>Seguimiento de calibraciones registradas</span></div>
            </article>
          </>
        ) : puedeVerClientes && (
          <article className="dashboard-kpi dashboard-kpi-featured">
            <div className="dashboard-kpi-heading"><div className="dashboard-kpi-icon dashboard-kpi-icon-blue"><FiUsers /></div><h2>Clientes registrados</h2></div>
            <div className="dashboard-kpi-value"><strong>{clientes.length}</strong></div>
            <p className="dashboard-kpi-description">Directorio comercial</p>
            <button className="dashboard-client-link" onClick={() => navigate('/clientes')}>Consultar clientes <FiArrowRight /></button>
          </article>
        )}
      </div>

      {puedeVerCotizaciones && <>
      <div className="dashboard-chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="dashboard-chart-title"><FiBarChart2 /><div><h2>Cotizaciones mensuales</h2><p>Emitidas y aprobadas · {rangoGraficos}</p></div></div>
            <div className="chart-legend"><span><i className="legend-blue" />Cotizaciones</span><span><i className="legend-green" />Aprobadas</span></div>
          </div>
          <div className="chart-container">
            <Bar data={datosMensuales} options={opcionesGrafico} role="img" aria-label={`Cotizaciones y aprobadas por mes. ${rangoGraficos}`} />
          </div>
        </div>

        <div className="chart-card status-chart-card">
          <div className="chart-card-header">
            <div className="dashboard-chart-title"><FiPieChart /><div><h2>Cotizaciones por estado</h2><p>Distribución de cotizaciones registradas</p></div></div>
          </div>
          <div className="chart-container chart-container-sm">
            {cotizaciones.length > 0
              ? <Doughnut data={datosEstados} options={opcionesDoughnut} role="img" aria-label={resumenEstados.map((estado) => `${estado.nombre}: ${estado.cantidad}`).join(', ')} />
              : <div className="dashboard-empty-ring" />}
            <div className="doughnut-total status-doughnut-total">
              <strong>{cotizaciones.length}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="status-summary">
            {resumenEstados.map((estado) => (
              <div className="status-summary-row" key={estado.nombre}>
                <span className="status-summary-name">
                  <i style={{ backgroundColor: estado.color }} />
                  {estado.nombre}
                </span>
                <strong>{estado.cantidad}</strong>
                <small>({estado.porcentaje}%)</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      </>}

      {(puedeVerCotizaciones || puedeVerCompras) && <div className="dashboard-chart-grid dashboard-secondary-grid">
        {puedeVerCotizaciones && <div className="chart-card">
          <div className="chart-card-header"><div className="dashboard-chart-title dashboard-chart-title-green"><FiTrendingUp /><div><h2>Ventas mensuales</h2><p>Cotizaciones aprobadas · {rangoGraficos}</p></div></div><span className="dashboard-chart-badge dashboard-chart-badge-green">{ventasMes.length} este mes</span></div>
          <div className="chart-container"><Line data={datosVentasMensuales} options={opcionesLine} role="img" aria-label={`Ventas confirmadas por mes. ${rangoGraficos}`} /></div>
        </div>}
        {puedeVerCompras && <div className="chart-card">
          <div className="chart-card-header"><div className="dashboard-chart-title dashboard-chart-title-orange"><FiShoppingCart /><div><h2>Compras mensuales</h2><p>Órdenes de compra · {rangoGraficos}</p></div></div><span className="dashboard-chart-badge dashboard-chart-badge-orange">{datosComprasMensuales.datasets[0].data.at(-1)} este mes</span></div>
          <div className="chart-container"><Bar data={datosComprasMensuales} options={opcionesGrafico} role="img" aria-label={`Órdenes de compra por mes. ${rangoGraficos}`} /></div>
        </div>}
      </div>}

      {(puedeVerEquipos || puedeVerCotizaciones) && <div className="dashboard-chart-grid dashboard-feature-grid">
        {puedeVerEquipos && <div className="chart-card category-chart-card">
          <div className="chart-card-header">
            <h2>Equipos por categoría</h2>
            <button
              className="chart-detail-button"
              onClick={() => navigate('/equipos')}
              title="Ver detalle de equipos"
            >
              <FiTool className="chart-header-icon" />
            </button>
          </div>
          <div className="chart-container chart-container-sm chart-doughnut-summary">
            {totalEquipos > 0
              ? <Doughnut data={datosCategorias} options={opcionesDoughnut} role="img" aria-label={categoriasVisibles.map(([nombre, cantidad]) => `${nombre}: ${cantidad}`).join(', ')} />
              : <div className="dashboard-empty-ring" />}
            <div className="doughnut-total" aria-label={`${totalEquipos} equipos`}>
              <strong>{totalEquipos}</strong>
              <span>Equipos</span>
            </div>
          </div>
          <div className="category-legend">
            {categoriasVisibles.map(([nombre, cantidad], index) => (
              <span key={nombre}>
                <i style={{ backgroundColor: COLORES_CATEGORIAS[index % COLORES_CATEGORIAS.length] }} />
                {nombre}<b>{cantidad}</b>
              </span>
            ))}
          </div>
        </div>}
        {puedeVerCotizaciones && <div className="chart-card top-clientes-card">
          <div className="chart-card-header">
            <h2>Top 5 clientes</h2>
            <div className="dashboard-toggle-group">
              <button
                className={`dashboard-toggle ${rankingClientes === 'cotizaciones' ? 'active' : ''}`}
                onClick={() => setRankingClientes('cotizaciones')}
                aria-pressed={rankingClientes === 'cotizaciones'}
              >
                Por cotizaciones
              </button>
              <button
                className={`dashboard-toggle ${rankingClientes === 'ventas' ? 'active' : ''}`}
                onClick={() => setRankingClientes('ventas')}
                aria-pressed={rankingClientes === 'ventas'}
              >
                Por ventas
              </button>
            </div>
          </div>
          <div className="top-clientes-list">
            {clientesDestacados.map(({ nombre, valor }) => (
              <div className="top-cliente" key={nombre}>
                <span title={nombre}>{nombre}</span>
                <div className="top-cliente-bar"><i style={{ width: `${(valor / (clientesDestacados[0]?.valor || 1)) * 100}%` }} /></div>
                <strong>{rankingClientes === 'ventas' ? formatCurrency(valor) : valor}</strong>
              </div>
            ))}
            {!clientesDestacados.length && (
              <div className="dashboard-empty">
                {rankingClientes === 'ventas'
                  ? 'No hay ventas aprobadas'
                  : 'No hay clientes con cotizaciones'}
              </div>
            )}
          </div>
        </div>}
      </div>}

      {puedeVerCotizaciones && <div className="tarjeta-tabla actividad-reciente">
        <div className="actividad-header">
          <h2 className="seccion-titulo">Actividad Reciente</h2>
          <button className="btn-enlace" onClick={() => navigate('/cotizaciones')}>
            Ver todas <FiArrowRight size={14} />
          </button>
        </div>
        {cotizacionesRecientes.length === 0 ? (
          <div className="estado-vacio">
            <p>No hay cotizaciones registradas</p>
            <button className="btn-principal" onClick={() => navigate('/cotizaciones')} style={{ marginTop: '0.75rem' }}>
              Ver cotizaciones
            </button>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Responsable</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {cotizacionesRecientes.map((cot) => (
                  <tr key={cot.id}>
                    <td className="texto-codigo">{cot.codigo}</td>
                    <td>{formatDate(cot.fechaEmision || cot.fecha || cot.createdAt)}</td>
                    <td>{cot.cliente?.razonSocial || '-'}</td>
                    <td>{cot.responsable || '-'}</td>
                    <td className="texto-derecha">{formatCurrency(cot.total || 0)}</td>
                    <td>{badgeEstado(cot.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  );
}
