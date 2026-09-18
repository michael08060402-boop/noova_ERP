import { useMemo, useState } from 'react';
import {
  FiTarget,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiMinusCircle,
  FiSearch
} from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useAuth } from '../context/AuthContext';
import { puede } from '../services/userService';
import {
  INTERVALOS_CALIBRACION,
  calcularProximaCalibracion,
  diasHasta,
  esCotizacionAceptada,
  esCotizacionDeEquipos,
  esItemCalibrable
} from '../utils/calibracion';
import { formatDate } from '../utils/formatDate';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import './Calibraciones.css';

const ESTADOS = {
  vigente: 'Al día',
  proxima: 'Por vencer',
  vencida: 'Vencida',
  sin: 'Sin programar'
};

function obtenerEstado(fecha) {
  const dias = diasHasta(fecha);
  if (dias === null) return 'sin';
  if (dias < 0) return 'vencida';
  if (dias <= 30) return 'proxima';
  return 'vigente';
}

export default function Calibraciones() {
  const { userProfile } = useAuth();
  const {
    cotizaciones,
    loading,
    error,
    fetchCotizaciones,
    editCotizacion
  } = useCotizaciones();

  const puedeEditar = puede(userProfile, 'cotizaciones', 'update');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [guardandoKey, setGuardandoKey] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const registros = useMemo(() => (
    cotizaciones
      .filter((cot) => esCotizacionAceptada(cot) && esCotizacionDeEquipos(cot))
      .flatMap((cot) => (cot.items || []).flatMap((item, index) => {
        if (!esItemCalibrable(item)) return [];

        const fechaVenta = cot.fechaAceptacion || null;
        const intervaloDias = Number(item.intervaloCalibracionDias) || null;
        const proxima = calcularProximaCalibracion(fechaVenta, intervaloDias);

        return [{
          key: `${cot.id}-${index}`,
          cotizacionId: cot.id,
          itemIndex: index,
          descripcion: item.descripcion || item.nombre || 'Sin descripción',
          marca: item.marca?.trim() || '',
          codigo: item.codigo || '—',
          cliente: cot.cliente?.razonSocial || '—',
          cotizacion: cot.codigo || '—',
          fechaVenta,
          intervaloDias,
          fecha: proxima,
          estado: obtenerEstado(proxima)
        }];
      }))
      .sort((a, b) => (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity))
  ), [cotizaciones]);

  const termino = busqueda.trim().toLocaleLowerCase();
  const mostrarMarca = registros.some((registro) => registro.marca);

  const filtrados = registros.filter((registro) => {
    const coincideEstado = !estado || registro.estado === estado;
    const coincideBusqueda = !termino || [
      registro.descripcion,
      registro.codigo,
      registro.cliente,
      registro.marca,
      registro.cotizacion
    ].some((valor) => String(valor || '').toLocaleLowerCase().includes(termino));

    return coincideEstado && coincideBusqueda;
  });

  const paginaSegura = Math.min(
    pagina,
    Math.max(1, Math.ceil(filtrados.length / porPagina))
  );

  const tarjetas = [
    { key: '', titulo: 'Total de equipos', icono: FiBox },
    { key: 'vigente', titulo: 'Al día', icono: FiCheckCircle },
    { key: 'proxima', titulo: 'Por vencer', icono: FiClock },
    { key: 'vencida', titulo: 'Vencidas', icono: FiAlertTriangle },
    { key: 'sin', titulo: 'Sin programar', icono: FiMinusCircle }
  ];

  async function cambiarIntervalo(registro, valor) {
    if (!puedeEditar) return;

    const cotizacion = cotizaciones.find((cot) => cot.id === registro.cotizacionId);
    if (!cotizacion) return;

    const key = registro.key;
    setGuardandoKey(key);
    setMensaje(null);

    try {
      const nuevosItems = (cotizacion.items || []).map((item, index) => (
        index === registro.itemIndex
          ? {
              ...item,
              intervaloCalibracionDias: valor ? Number(valor) : null
            }
          : item
      ));

      await editCotizacion(cotizacion.id, { items: nuevosItems });
      setMensaje({ tipo: 'success', texto: 'Programación de calibración actualizada.' });
    } catch (err) {
      console.error('Error actualizando calibración:', err);
      setMensaje({
        tipo: 'error',
        texto: err?.message || 'No se pudo actualizar la calibración.'
      });
    } finally {
      setGuardandoKey(null);
    }
  }

  if (loading) return <Loading message="Cargando calibraciones..." />;

  return (
    <div className="pagina calibraciones-pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">
            <FiTarget aria-hidden="true" /> Calibraciones
          </h1>
          <p className="pagina-subtitulo">
            Seguimiento postventa de equipos vendidos y sus próximas calibraciones.
          </p>
        </div>
      </div>

      {error && (
        <div className="mensaje-flash mensaje-error" role="alert">
          No se pudieron cargar las calibraciones.
          <button type="button" className="btn-secundario" onClick={fetchCotizaciones}>
            Reintentar
          </button>
        </div>
      )}

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`} role="status">
          {mensaje.texto}
        </div>
      )}

      <div className="calibraciones-resumen">
        {tarjetas.map(({ key, titulo, icono: Icono }) => {
          const cantidad = key
            ? registros.filter((registro) => registro.estado === key).length
            : registros.length;

          return (
            <article key={key || 'total'} className={`calibraciones-tarjeta cal-${key || 'total'}`}>
              <div className="calibraciones-tarjeta-cabecera">
                <span className="calibraciones-icono">
                  <Icono aria-hidden="true" />
                </span>
                <div className="calibraciones-tarjeta-detalle">
                  <div className="calibraciones-tarjeta-titulo">
                    <h2 className="calibraciones-etiqueta">{titulo}</h2>
                    <strong>{cantidad}</strong>
                  </div>
                  <small>
                    {cantidad === 0
                      ? 'No hay registros'
                      : `${cantidad} ${cantidad === 1 ? 'registro' : 'registros'}`}
                  </small>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" />
          <input
            aria-label="Buscar calibraciones"
            placeholder={mostrarMarca
              ? 'Buscar equipo, código, marca, cliente o cotización...'
              : 'Buscar equipo, código, cliente o cotización...'}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>

        <select
          className="selector-filtro"
          aria-label="Estado de calibración"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {filtrados.length > 0 && (
        <div className="calibraciones-info-registros">
          Mostrando {(paginaSegura - 1) * porPagina + 1} a{' '}
          {Math.min(paginaSegura * porPagina, filtrados.length)} de{' '}
          {filtrados.length} registros
        </div>
      )}

      <div className="tarjeta-tabla">
        <div className="tabla-contenedor">
          <table className="tabla-datos calibraciones-tabla">
            <thead>
              <tr>
                <th>Equipo / Descripción</th>
                {mostrarMarca && <th>Marca</th>}
                <th>Código</th>
                <th>Cliente</th>
                <th>Cotización</th>
                <th>Fecha aceptación</th>
                <th>Calibrar cada</th>
                <th>Próxima calibración</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados
                .slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina)
                .map((registro) => (
                  <tr key={registro.key}>
                    <td>{registro.descripcion}</td>
                    {mostrarMarca && <td>{registro.marca || '—'}</td>}
                    <td>{registro.codigo}</td>
                    <td>{registro.cliente}</td>
                    <td className="texto-codigo">{registro.cotizacion}</td>
                    <td>{registro.fechaVenta ? formatDate(registro.fechaVenta) : '—'}</td>
                    <td>
                      <select
                        className="calibraciones-intervalo"
                        value={registro.intervaloDias ? String(registro.intervaloDias) : ''}
                        disabled={!puedeEditar || guardandoKey === registro.key}
                        onChange={(e) => cambiarIntervalo(registro, e.target.value)}
                        aria-label={`Intervalo de calibración para ${registro.descripcion}`}
                      >
                        {INTERVALOS_CALIBRACION.map((opcion) => (
                          <option key={opcion.value || 'sin'} value={opcion.value}>
                            {opcion.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{registro.fecha ? formatDate(registro.fecha) : '—'}</td>
                    <td className="texto-centro">
                      <span className={`calibraciones-estado cal-${registro.estado}`}>
                        {ESTADOS[registro.estado]}
                      </span>
                    </td>
                  </tr>
                ))}

              {!filtrados.length && (
                <tr>
                  <td colSpan={mostrarMarca ? 9 : 8} className="estado-vacio">
                    {registros.length
                      ? 'No hay equipos que coincidan con los filtros.'
                      : 'No hay equipos en cotizaciones aceptadas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Paginacion
          mostrarInfo={false}
          total={filtrados.length}
          paginaActual={paginaSegura}
          porPagina={porPagina}
          onCambiarPagina={setPagina}
          onCambiarPorPagina={(valor) => {
            setPorPagina(valor);
            setPagina(1);
          }}
        />
      </div>

      <p className="calibraciones-ayuda">
        La próxima calibración se calcula desde la fecha de aceptación de la cotización y el intervalo configurado para cada equipo. Los registros sin fecha o sin intervalo quedan como “Sin programar”.
      </p>
    </div>
  );
}
