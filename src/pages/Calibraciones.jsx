import { useState } from 'react';
import { FiTarget, FiBox, FiCheckCircle, FiClock, FiAlertTriangle, FiSearch, FiEye } from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useOrdenesCompra } from '../hooks/useOrdenesCompra';
import { useAuth } from '../context/AuthContext';
import { puede } from '../services/userService';
import { calcularCalibracionAnual, diasHasta } from '../utils/calibracion';
import { formatDate } from '../utils/formatDate';
import Paginacion from '../components/Paginacion';
import Modal from '../components/Modal';
import './Calibraciones.css';

const ESTADOS = { vigente: 'Al día', proxima: 'Por vencer', vencida: 'Vencida', sin: 'Sin programar' };
const TIPOS_EXCLUIDOS = new Set(['servicio', 'epp', 'manga']);

export default function Calibraciones() {
  const { cotizaciones, loading, error, fetchCotizaciones } = useCotizaciones();
  const { userProfile } = useAuth();
  const puedeVerCompras = puede(userProfile, 'compras', 'read');
  const { ordenes, loading: cargandoOrdenes, error: errorOrdenes, refresh: recargarOrdenes } = useOrdenesCompra(puedeVerCompras);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [detalle, setDetalle] = useState(null);
  const ordenDetalle = detalle && puedeVerCompras ? ordenes.find((orden) =>
    detalle.ordenCompraId ? orden.id === detalle.ordenCompraId : orden.origenCotizacionId === detalle.cotizacionId
  ) : null;
  const registros = cotizaciones
    .filter((cot) => cot.estado === 'Aceptada' && (!cot.tipoItem || cot.tipoItem === 'equipo'))
    .flatMap((cot) => (cot.items || []).flatMap((item, index) => {
      const tipoItem = String(item.tipoItem || item.familia || item.tipo || '').trim().toLocaleLowerCase();
      if (TIPOS_EXCLUIDOS.has(tipoItem)) return [];
      const venta = cot.fechaAceptacion || cot.updatedAt;
      const fecha = calcularCalibracionAnual(venta);
      const dias = diasHasta(fecha);
      return [{ key: `${cot.id}-${index}`, descripcion: item.descripcion || item.nombre || 'Sin descripción',
        marca: item.marca?.trim() || '', codigo: item.codigo || '—', cliente: cot.cliente?.razonSocial || '—',
        cotizacion: cot.codigo, venta, fecha, dias,
        cantidad: item.cantidad, unidad: item.unidadMedida,
        ruc: cot.cliente?.ruc, cotizacionId: cot.id,
        ordenCompraId: cot.ordenCompraId, ordenCompraCodigo: cot.ordenCompraCodigo,
        fechaAceptacionRegistrada: Boolean(cot.fechaAceptacion),
        estado: dias === null ? 'sin' : dias < 0 ? 'vencida' : dias <= 30 ? 'proxima' : 'vigente' }];
    }))
    .sort((a, b) => (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity));
  const termino = busqueda.trim().toLocaleLowerCase();
  const mostrarMarca = registros.some((registro) => registro.marca);
  const filtrados = registros.filter((r) => (!estado || r.estado === estado)
    && [r.descripcion, r.codigo, r.cliente, r.marca, r.cotizacion].some((v) => String(v || '').toLocaleLowerCase().includes(termino)));
  const paginaSegura = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / porPagina)));
  const tarjetas = [
    { key: '', titulo: 'Total de equipos', icono: FiBox },
    { key: 'vigente', titulo: 'Al día', icono: FiCheckCircle },
    { key: 'proxima', titulo: 'Por vencer', icono: FiClock },
    { key: 'vencida', titulo: 'Vencidas', icono: FiAlertTriangle }
  ];

  return <div className="pagina calibraciones-pagina">
    <div className="pagina-header"><div>
      <h1 className="pagina-titulo"><FiTarget aria-hidden="true" /> Calibraciones</h1>
      <p className="pagina-subtitulo">Equipos vendidos y su próximo vencimiento de calibración.</p>
    </div></div>
    {loading ? <p role="status">Cargando calibraciones...</p> : error ?
      <div className="mensaje-flash mensaje-error" role="alert">No se pudieron cargar las calibraciones.
        <button type="button" className="btn-secundario" onClick={fetchCotizaciones}>Reintentar</button>
      </div> : <>
      <div className="calibraciones-resumen">
        {tarjetas.map(({ key, titulo, icono: Icono }) => {
          const cantidad = key ? registros.filter((r) => r.estado === key).length : registros.length;
          const textoRegistros = cantidad === 0
            ? 'No hay registros'
            : `Hay ${cantidad} ${cantidad === 1 ? 'registro' : 'registros'}`;
          return <article key={key} className={`calibraciones-tarjeta cal-${key || 'total'}`}>
            <div className="calibraciones-tarjeta-cabecera">
              <span className="calibraciones-icono"><Icono aria-hidden="true" /></span>
              <div className="calibraciones-tarjeta-detalle">
                <div className="calibraciones-tarjeta-titulo">
                  <h2 className="calibraciones-etiqueta">{titulo}</h2>
                  <strong>{cantidad}</strong>
                </div>
                <small>{textoRegistros}</small>
              </div>
            </div>
          </article>;
        })}
      </div>
      <div className="filtros-barra">
        <div className="barra-busqueda"><FiSearch className="icono-busqueda" />
          <input aria-label="Buscar calibraciones" placeholder={mostrarMarca ? 'Buscar equipo, código, marca o cliente...' : 'Buscar equipo, código o cliente...'} value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
        </div>
        <select className="selector-filtro" aria-label="Estado de calibración" value={estado}
          onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {filtrados.length > 0 && <div className="calibraciones-info-registros">
        Mostrando {(paginaSegura - 1) * porPagina + 1} a {Math.min(paginaSegura * porPagina, filtrados.length)} de {filtrados.length} registros
      </div>}
      <div className="tarjeta-tabla"><div className="tabla-contenedor">
        <table className="tabla-datos"><thead><tr>
          <th>Equipo / Descripción</th>{mostrarMarca && <th>Marca</th>}<th>Código de producto</th><th>Cliente</th>
          <th>Fecha de venta</th><th>Próxima calibración</th><th>Estado</th><th>Detalle</th>
        </tr></thead><tbody>
          {filtrados.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina).map((r) => <tr key={r.key}>
            <td>{r.descripcion}</td>{mostrarMarca && <td>{r.marca || '—'}</td>}<td>{r.codigo}</td><td>{r.cliente}</td>
            <td>{formatDate(r.venta) || '—'}</td><td>{formatDate(r.fecha) || '—'}</td>
            <td className="texto-centro"><span className={`calibraciones-estado cal-${r.estado}`}>{ESTADOS[r.estado]}</span></td>
            <td className="texto-centro"><button type="button" className="btn-accion" title="Ver detalle"
              aria-label={`Ver detalle de ${r.descripcion}`} onClick={() => setDetalle(r)}><FiEye /></button></td>
          </tr>)}
          {!filtrados.length && <tr><td colSpan={mostrarMarca ? 8 : 7} className="estado-vacio">{registros.length ? 'No hay equipos que coincidan con los filtros.' : 'No hay equipos en cotizaciones aceptadas.'}</td></tr>}
        </tbody></table>
      </div><Paginacion mostrarInfo={false} total={filtrados.length} paginaActual={paginaSegura} porPagina={porPagina}
        onCambiarPagina={setPagina} onCambiarPorPagina={(valor) => { setPorPagina(valor); setPagina(1); }} /></div>
      <p className="calibraciones-ayuda">Próxima calibración: un año después de la venta. Por vencer: próximos 30 días. Cada fila corresponde a un ítem vendido.</p>
    </>}
    <Modal isOpen={Boolean(detalle)} onClose={() => setDetalle(null)} title="Detalle de calibración">
      {detalle && <div className="calibracion-detalle">
        <h3>{detalle.descripcion}</h3>
        <span className={`calibraciones-estado cal-${detalle.estado}`}>{ESTADOS[detalle.estado]}</span>
        <h4>Equipo y cliente</h4>
        <dl>
          <div><dt>Código de producto</dt><dd>{detalle.codigo}</dd></div>
          {detalle.marca && <div><dt>Marca</dt><dd>{detalle.marca}</dd></div>}
          <div><dt>Cantidad vendida</dt><dd>{detalle.cantidad ?? 'No registrada'} {detalle.unidad || ''}</dd></div>
          <div><dt>Cliente</dt><dd>{detalle.cliente}</dd></div>
          <div><dt>RUC</dt><dd>{detalle.ruc || 'No registrado'}</dd></div>
        </dl>
        <h4>Origen de la venta</h4>
        <dl>
          <div><dt>Cotización aceptada</dt><dd>{detalle.cotizacion || 'Sin código'}</dd></div>
          <div><dt>Orden de compra vinculada</dt><dd>
            {!puedeVerCompras ? 'Sin permiso para consultar compras' : cargandoOrdenes ? 'Cargando OC...' : errorOrdenes ? <>
              No se pudo consultar la OC. <button type="button" className="btn-enlace" onClick={recargarOrdenes}>Reintentar</button>
            </> : ordenDetalle ? (ordenDetalle.codigo || detalle.ordenCompraCodigo || 'Sin código')
              : detalle.ordenCompraId ? `${detalle.ordenCompraCodigo || detalle.ordenCompraId} · Detalle no disponible` : 'Sin orden de compra vinculada'}
          </dd></div>
          <div><dt>{detalle.fechaAceptacionRegistrada ? 'Fecha de venta / aceptación' : 'Fecha de referencia'}</dt><dd>{formatDate(detalle.venta) || 'No registrada'}</dd></div>
          {ordenDetalle && !errorOrdenes && <>
            <div><dt>Fecha de la OC</dt><dd>{formatDate(ordenDetalle.fecha) || 'No registrada'}</dd></div>
            <div><dt>Proveedor</dt><dd>{ordenDetalle.proveedor?.razonSocial || 'No registrado'}</dd></div>
            <div><dt>Estado de la OC</dt><dd>{ordenDetalle.estado || 'No registrado'}</dd></div>
          </>}
        </dl>
        {!detalle.fechaAceptacionRegistrada && <p className="calibracion-detalle-nota">No hay fecha de aceptación registrada. Se utiliza la última actualización de la cotización como referencia.</p>}
        <h4>Programación de calibración</h4>
        <dl>
          <div><dt>Próxima calibración</dt><dd>{formatDate(detalle.fecha) || 'Sin fecha'}</dd></div>
          <div><dt>Plazo</dt><dd>Un año desde la fecha de venta</dd></div>
          <div><dt>Tiempo restante</dt><dd>{detalle.dias === null ? 'Sin fecha para calcular' : detalle.dias < 0 ? `Vencida hace ${Math.abs(detalle.dias)} días` : detalle.dias === 0 ? 'Vence hoy' : `Faltan ${detalle.dias} días`}</dd></div>
        </dl>
        <p className="calibracion-detalle-nota">Este aviso se genera automáticamente desde la venta. La fecha programada no confirma que se haya realizado una calibración ni que exista un certificado.</p>
        <div className="calibracion-detalle-cierre"><button type="button" className="btn-principal" onClick={() => setDetalle(null)}>Cerrar</button></div>
      </div>}
    </Modal>
  </div>;
}
