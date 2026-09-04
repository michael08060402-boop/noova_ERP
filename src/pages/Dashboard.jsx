import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi';
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
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORES = {
  azulPrimario: '#1d4ed8',
  azulOscuro: '#1e40af',
  verde: '#059669',
  rojo: '#dc2626',
  amarillo: '#d97706',
  gris: '#6b7280'
};

const ESTADOS = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada'];
const COLORES_ESTADO = {
  Borrador: COLORES.gris,
  Enviada: COLORES.azulPrimario,
  Aprobada: COLORES.verde,
  Rechazada: COLORES.rojo
};

const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORES_CATEGORIAS = [COLORES.azulPrimario, COLORES.azulOscuro, COLORES.amarillo, COLORES.verde, COLORES.rojo, COLORES.gris];

const opcionesGrafico = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
  }
};

const opcionesDoughnut = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } }
  }
};

const opcionesLine = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11 }, padding: 16 } }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
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

  const [anioTendencia, setAnioTendencia] = useState(new Date().getFullYear());
  const [actualizarTendencia, setActualizarTendencia] = useState(0);

  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  // --- Datos memoizados ---
  const mesesAnio = useMemo(() => {
    void actualizarTendencia;
    return NOMBRES_MESES.map((nombre, idx) => ({
      label: nombre,
      month: idx,
      year: anioTendencia
    }));
  }, [anioTendencia, actualizarTendencia]);

  const cotizacionesMes = useMemo(() => {
    return cotizaciones.filter((c) => {
      const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });
  }, [cotizaciones, mesActual, anioActual]);

  const totalMesSoles = useMemo(() => {
    return cotizacionesMes.reduce((sum, c) => sum + (c.total || 0), 0);
  }, [cotizacionesMes]);

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
      acc[estado] = cotizaciones.filter((c) => c.estado === estado).length;
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

  const ultimos6Meses = useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
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
    labels: ultimos6Meses.map(m => m.label),
    datasets: [{
      label: 'Cotizaciones',
      data: ultimos6Meses.map(m => {
        return cotizaciones.filter(c => {
          const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        }).length;
      }),
      backgroundColor: COLORES.azulPrimario,
      borderRadius: 6,
      barThickness: 28
    }]
  }), [ultimos6Meses, cotizaciones]);

  const datosTendencia = useMemo(() => ({
    labels: mesesAnio.map(m => m.label),
    datasets: [
      {
        label: 'Cotizaciones',
        data: mesesAnio.map(m => {
          return cotizaciones.filter(c => {
            const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
            return d.getMonth() === m.month && d.getFullYear() === m.year;
          }).length;
        }),
        borderColor: COLORES.azulPrimario,
        backgroundColor: 'rgba(29, 78, 216, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2
      },
      {
        label: 'Aprobadas',
        data: mesesAnio.map(m => {
          return cotizaciones.filter(c => {
            const d = parseFechaLocal(c.fechaEmision || c.fecha || c.createdAt);
            return d.getMonth() === m.month && d.getFullYear() === m.year && c.estado === 'Aprobada';
          }).length;
        }),
        borderColor: COLORES.verde,
        backgroundColor: 'rgba(5, 150, 105, 0.05)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2
      }
    ]
  }), [mesesAnio, cotizaciones]);

  const conteoCategorias = useMemo(() => {
    return equipos.reduce((acc, equipo) => {
      const categoria = equipo.categoria || 'Sin categoría';
      acc[categoria] = (acc[categoria] || 0) + 1;
      return acc;
    }, {});
  }, [equipos]);

  const datosCategorias = useMemo(() => ({
    labels: Object.keys(conteoCategorias),
    datasets: [{
      data: Object.values(conteoCategorias),
      backgroundColor: Object.keys(conteoCategorias).map((_, i) => COLORES_CATEGORIAS[i % COLORES_CATEGORIAS.length]),
      borderWidth: 0
    }]
  }), [conteoCategorias]);

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
      <div className="dashboard-header">
        <div>
          <h1 className="pagina-titulo">Dashboard</h1>
          <p className="pagina-subtitle">
            Bienvenido, {userProfile?.nombre || userProfile?.email || 'Usuario'}
          </p>
        </div>
      </div>

      <div className="dashboard-kpis" aria-label="Indicadores principales">
        {puedeVerCotizaciones && <div className="dashboard-kpi"><span>Cotizaciones del mes</span><strong>{cotizacionesMes.length}</strong><small>{formatCurrency(totalMesSoles)}</small></div>}
        {puedeVerCotizaciones && <div className="dashboard-kpi"><span>Tasa de aceptación</span><strong>{tasaAceptacion}%</strong><small>{cotizaciones.length} cotizaciones acumuladas</small></div>}
        {puedeVerCompras && <div className="dashboard-kpi"><span>Órdenes pendientes</span><strong>{ordenes.filter((orden) => orden.estado === 'Borrador').length}</strong><small>{ordenes.length} órdenes registradas</small></div>}
        {puedeVerClientes && <div className="dashboard-kpi"><span>Clientes</span><strong>{clientes.length}</strong><small>registros disponibles</small></div>}
      </div>

      <div className="dashboard-chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h2>Cotizaciones Mensuales</h2>
            <span className="chart-subtitle">Últimos 6 meses</span>
          </div>
          <div className="chart-container">
            <Bar data={datosMensuales} options={opcionesGrafico} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h2>Por Estado</h2>
            <span className="chart-subtitle">Distribución de cotizaciones</span>
          </div>
          <div className="chart-container chart-container-sm">
            <Doughnut data={datosEstados} options={opcionesDoughnut} />
          </div>
        </div>
      </div>

      <div className="dashboard-chart-grid">
        <div className="chart-card chart-card-wide">
          <div className="chart-card-header">
            <div>
              <h2>Tendencia Anual</h2>
              <span className="chart-subtitle">
                Cotizaciones vs Aprobadas - Año {anioTendencia}
              </span>
            </div>
            <div className="tendencia-controles">
              <button
                className="btn-secundario btn-pequeno"
                onClick={() => setAnioTendencia(a => a - 1)}
                title="Año anterior"
              >
                <FiChevronLeft size={14} />
              </button>
              <span className="anio-actual">{anioTendencia}</span>
              <button
                className="btn-secundario btn-pequeno"
                onClick={() => setAnioTendencia(a => Math.min(a + 1, anioActual))}
                disabled={anioTendencia >= anioActual}
                title="Año siguiente"
              >
                <FiChevronRight size={14} />
              </button>
              <button
                className="btn-secundario btn-pequeno"
                onClick={() => setActualizarTendencia(n => n + 1)}
                title="Refrescar datos"
              >
                <FiRefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="chart-container">
            <Line data={datosTendencia} options={opcionesLine} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h2>Equipos por Categoría</h2>
            <span className="chart-subtitle">Distribución del catálogo</span>
          </div>
          <div className="chart-container chart-container-sm">
            <Doughnut data={datosCategorias} options={opcionesDoughnut} />
          </div>
        </div>
      </div>

      <div className="tarjeta-tabla actividad-reciente">
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
              Crear Primera Cotización
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
                    <td>{formatDate(cot.fecha || cot.createdAt)}</td>
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
      </div>
    </div>
  );
}
