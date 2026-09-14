import { useState, useMemo, useEffect } from 'react';
import {
  FiFileText, FiDownload, FiTrash2, FiPlus, FiSearch,
  FiAlertCircle, FiCheckCircle, FiClock, FiEye, FiRefreshCw, FiCheck
} from 'react-icons/fi';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useFacturacion } from '../hooks/useFacturacion';
import { formatDate, formatDateISO } from '../utils/formatDate';
import { formatUSD } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import { TIPOS_COMPROBANTE } from '../services/facturacionService';
import '../styles/shared.css';
import './Facturacion.css';

const ICONO_ESTADO = {
  ACEPTADA: <FiCheckCircle />,
  PENDIENTE: <FiClock />,
  RECHAZADA: <FiAlertCircle />,
  ERROR: <FiAlertCircle />
};

// Unidades de medida permitidas por SUNAT, mostradas como dropdown
// tanto en el formulario de generación de comprobantes como en
// cualquier lugar donde se edite un item.
export const UNIDADES_MEDIDA = [
  'UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'
];

// Porcentaje de detracción por defecto (servicios gravados con IGV, ítem 037).
const PORCENTAJE_DETRACCION_DEFAULT = 12;

// Estado inicial del formulario complementario que se llena al generar
// el comprobante. Solo los datos operativos que se ingresan manualmente:
// guía de remisión, orden de compra, contenido y detracción.
const FORM_COMPROBANTE_VACIO = {
  guiaRemision: '',
  ordenCompra: '',
  observaciones: '',
  // Detracción
  aplicarDetraccion: true,
  porcentajeDetraccion: PORCENTAJE_DETRACCION_DEFAULT,
  montoDetraccion: 0,
  cuentaDetraccion: '00076048290',
};

// Normaliza la forma de pago a los únicos dos valores que acepta SUNAT:
// "Contado" o "Credito" (sin tilde). Cualquier condición de pago que
// contenga "credito" (con o sin tilde) se mapea a "Credito"; el resto
// a "Contado". Esto evita el error 3246 de SUNAT cuando la cotización
// trae condiciones como "Crédito 7 días" o "15 días".
function normalizarFormaPagoSUNAT(valor) {
  if (!valor) return 'Contado';
  const v = String(valor).toLowerCase().trim();
  if (v.includes('credito') || v.includes('crédito')) return 'Credito';
  return 'Contado';
}

// Recibe empresaData como prop desde App.jsx (vía ConfigContext).
export default function Facturacion({ empresaData }) {
  const { cotizaciones, loading: cargandoCotizaciones } = useCotizaciones();
  const {
    facturas,
    loading: cargandoFacturas,
    addFacturaDesdeCotizacion,
    removeFactura,
    refrescar
  } = useFacturacion();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [eliminarId, setEliminarId] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState(TIPOS_COMPROBANTE.FACTURA);

  // Formulario complementario para datos que se ingresan al momento de
  // generar el comprobante: guía de remisión, orden de compra, detracción,
  // anticipos, descuentos, observaciones, etc.
  const [formComprobante, setFormComprobante] = useState({ ...FORM_COMPROBANTE_VACIO });

  // Items editables de la cotización seleccionada. Se clonan para poder
  // ajustar cantidad, precio, unidad de medida y códigos antes de emitir
  // el comprobante sin alterar la cotización original.
  const [itemsEditables, setItemsEditables] = useState([]);

  function cambiarCampoComprobante(campo, valor) {
    setFormComprobante((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarItemEditable(index, campo, valor) {
    setItemsEditables((prev) => {
      const copia = [...prev];
      let valorFinal = valor;
      if (campo === 'precioUnitario' && valor !== '') {
        // Redondeo a 2 decimales para evitar desvíos de punto flotante.
        const num = Number(valor);
        valorFinal = Number.isFinite(num) ? Math.round(num * 100) / 100 : valor;
      }
      copia[index] = { ...copia[index], [campo]: valorFinal };
      return copia;
    });
  }

  // Calcula el monto de detracción automáticamente cuando cambia el total
  // o el porcentaje, salvo que el usuario lo haya editado manualmente.
  useEffect(() => {
    if (!formComprobante.aplicarDetraccion) {
      if (formComprobante.montoDetraccion !== 0) {
        setFormComprobante((prev) => ({ ...prev, montoDetraccion: 0 }));
      }
      return;
    }
    const total = cotizacionSeleccionada?.total || 0;
    const calculado = Number(
      (total * (Number(formComprobante.porcentajeDetraccion) || 0)) / 100
    ).toFixed(2);
    setFormComprobante((prev) => ({ ...prev, montoDetraccion: Number(calculado) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cotizacionSeleccionada?.total,
    formComprobante.porcentajeDetraccion,
    formComprobante.aplicarDetraccion
  ]);

  // Cotizaciones listas para facturar: solo las que están en estado "Generada"
  // (o estados legacy Borrador/Enviada) y no tienen factura asociada.
  const cotizacionesAprobadas = useMemo(() => {
    const cotConFactura = new Set(facturas.map(f => f.cotizacionId).filter(Boolean));
    const estadosFacturables = ['Generada', 'Borrador', 'Enviada'];
    return cotizaciones.filter(c =>
      estadosFacturables.includes(c.estado) && !cotConFactura.has(c.id)
    );
  }, [cotizaciones, facturas]);

  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      const term = terminoBusqueda.toLowerCase();
      const coincideBusqueda =
        f.numero?.toLowerCase().includes(term) ||
        f.cliente?.razonSocial?.toLowerCase().includes(term) ||
        f.cliente?.ruc?.toLowerCase().includes(term) ||
        f.cotizacionCodigo?.toLowerCase().includes(term);
      const coincideTipo = !filtroTipo || f.tipo === filtroTipo;
      const coincideEstado = !filtroEstado || f.estadoSunat === filtroEstado;
      return coincideBusqueda && coincideTipo && coincideEstado;
    });
  }, [facturas, terminoBusqueda, filtroTipo, filtroEstado]);

  const facturasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return facturasFiltradas.slice(inicio, inicio + porPagina);
  }, [facturasFiltradas, paginaActual, porPagina]);

  const stats = useMemo(() => ({
    total: facturas.length,
    aceptadas: facturas.filter(f => f.estadoSunat === 'ACEPTADA').length,
    pendientes: facturas.filter(f => f.estadoSunat === 'PENDIENTE').length,
    rechazadas: facturas.filter(f => f.estadoSunat === 'RECHAZADA').length,
    errores: facturas.filter(f => f.estadoSunat === 'ERROR').length,
    montoTotal: facturas.filter(f => f.estadoSunat === 'ACEPTADA').reduce((sum, f) => sum + (f.total || 0), 0)
  }), [facturas]);

  const generarNumeroComprobante = (tipo) => {
    const serie = tipo === TIPOS_COMPROBANTE.BOLETA ? 'B001' : 'F001';
    const existentes = facturas.filter(f => f.tipo === tipo && f.serie === serie);
    const numero = (existentes.length + 1).toString().padStart(4, '0');
    return { serie, numero };
  };

  const seleccionarCotizacion = (cot) => {
    setCotizacionSeleccionada(cot);
    const ruc = cot.cliente?.ruc || '';
    const esPersonaNatural = ruc.length === 8 && !ruc.startsWith('10') && !ruc.startsWith('20');
    setTipoComprobante(esPersonaNatural ? TIPOS_COMPROBANTE.BOLETA : TIPOS_COMPROBANTE.FACTURA);

    // Clonar los items para edición inline sin mutar la cotización original.
    // Se normalizan los campos clave (codigo, unidadMedida)
    // para garantizar que el PDF siempre reciba datos válidos.
    setItemsEditables(
      (cot.items || []).map((it) => ({
        descripcion: it.descripcion || '',
        cantidad: Number(it.cantidad) || 0,
        unidadMedida: it.unidadMedida || 'UNIDAD',
        codigo: it.codigo || '',
        precioUnitario: Number(it.precioUnitario) || 0,
        icbper: Number(it.icbper) || 0,
        importe: (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0),
      }))
    );

    // Resetear el formulario complementario con los valores por defecto,
    // preservando observaciones si la cotización las trae.
    setFormComprobante({
      ...FORM_COMPROBANTE_VACIO,
      observaciones: cot.observaciones || '',
    });
  };

  // Recalcula importes de items editables cuando cambian cantidad o precio.
  const itemsConImporte = useMemo(() => {
    return itemsEditables.map((it) => ({
      ...it,
      importe: (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0),
    }));
  }, [itemsEditables]);

  // Subtotal / IGV / total recalculados a partir de los items editables,
  // de modo que los ajustes al vuelo se reflejen en el comprobante.
  const subtotalEditable = useMemo(
    () => itemsConImporte.reduce((acc, it) => acc + (Number(it.importe) || 0), 0),
    [itemsConImporte]
  );
  const igvEditable = useMemo(() => Number((subtotalEditable * 0.18).toFixed(2)), [subtotalEditable]);
  const totalEditable = useMemo(
    () => Number((subtotalEditable + igvEditable).toFixed(2)),
    [subtotalEditable, igvEditable]
  );

  async function generarComprobante() {
    if (!cotizacionSeleccionada) return;
    setProcesando(true);
    setMensaje(null);
    try {
      const { serie, numero } = generarNumeroComprobante(tipoComprobante);
      const moneda = cotizacionSeleccionada.moneda || 'US$';

      // Items finales: se filtran filas vacías y se normalizan los campos.
      // Se preserva codigo para que llegue al PDF y al XML.
      const itemsFinal = itemsConImporte
        .filter((it) => it.descripcion && Number(it.cantidad) > 0)
        .map((item) => ({
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidadMedida: item.unidadMedida || 'UNIDAD',
          codigo: item.codigo || '',
          precioUnitario: Number(item.precioUnitario) || 0,
          icbper: Number(item.icbper) || 0,
          importe: Number(item.importe) || 0,
        }));

      if (itemsFinal.length === 0) {
        throw new Error('El comprobante debe tener al menos un item con cantidad mayor a 0.');
      }

      // Totales recalculados a partir de los items finales.
      const subtotal = Number(itemsFinal.reduce((a, i) => a + i.importe, 0).toFixed(2));
      const igv = Number((subtotal * 0.18).toFixed(2));
      const total = Number((subtotal + igv).toFixed(2));

      // ===== FIX ERROR 3246 SUNAT =====
      // SUNAT solo acepta "Contado" o "Credito" en cac:PaymentTerms/cbc:PaymentMeansID.
      // La cotización trae la condición de pago ("Crédito 7 días", "15 días", etc.)
      // que NO es válida para SUNAT. Se normaliza aquí antes de enviar.
      const formaPagoNormalizada = normalizarFormaPagoSUNAT(
        cotizacionSeleccionada.condicionPago || 'Contado'
      );

      const facturaData = {
        serie,
        numero,
        tipo: tipoComprobante,
        fechaEmision: formatDateISO(),
        cliente: {
          razonSocial: cotizacionSeleccionada.cliente?.razonSocial || '',
          ruc: cotizacionSeleccionada.cliente?.ruc || '',
          direccion: cotizacionSeleccionada.cliente?.direccion || '',
          telefono: cotizacionSeleccionada.cliente?.telefono || '',
          email: cotizacionSeleccionada.cliente?.email || '',
        },
        items: itemsFinal,
        subtotal,
        igv,
        total,
        moneda,
        // Forma de pago normalizada para SUNAT (Contado/Credito únicamente).
        // La condición original ("Crédito 7 días", etc.) se conserva en
        // condicionPago para mostrarla en el PDF si se necesita.
        formaPago: formaPagoNormalizada,
        condicionPago: cotizacionSeleccionada.condicionPago || 'Contado',
        // Datos operativos ingresados manualmente en el modal
        guiaRemision: formComprobante.guiaRemision?.trim() || '',
        ordenCompra: formComprobante.ordenCompra?.trim() || '',
        observaciones: formComprobante.observaciones?.trim() || '',
        // Detracción
        detraccion: {
          aplicar: !!formComprobante.aplicarDetraccion,
          cuenta: formComprobante.cuentaDetraccion || '00076048290',
          porcentaje: Number(formComprobante.porcentajeDetraccion) || 0,
          monto: formComprobante.aplicarDetraccion
            ? Number(formComprobante.montoDetraccion) || 0
            : 0,
        },
        montoDetraccion: formComprobante.aplicarDetraccion
          ? Number(formComprobante.montoDetraccion) || 0
          : 0,
        tipoOperacion: '0101',
        estadoSunat: 'PENDIENTE',
        cotizacionId: cotizacionSeleccionada.id,
        cotizacionCodigo: cotizacionSeleccionada.codigo,
      };

      const resultado = await addFacturaDesdeCotizacion(cotizacionSeleccionada, facturaData, empresaData);

      // Propagar el resultado de SUNAT al estado de la cotización:
      // ACEPTADA -> cotización en "Aceptada"; RECHAZADA/ERROR -> "Error" con motivo.
      let nuevoEstadoCotizacion = null;
      if (resultado.estadoSunat === 'ACEPTADA') {
        nuevoEstadoCotizacion = 'Aceptada';
      } else if (resultado.estadoSunat === 'RECHAZADA' || resultado.estadoSunat === 'ERROR') {
        nuevoEstadoCotizacion = 'Error';
      }

      if (nuevoEstadoCotizacion) {
        try {
          const cotRef = doc(db, 'cotizaciones', cotizacionSeleccionada.id);
          await updateDoc(cotRef, {
            estado: nuevoEstadoCotizacion,
            ...(nuevoEstadoCotizacion === 'Aceptada' ? { fechaAceptacion: new Date().toISOString() } : {}),
            motivoRechazoSunat: resultado.mensajeSunat || '',
            codigoRechazoSunat: resultado.codigo || '',
            facturaIdAsociada: resultado.id || '',
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn(`No se pudo actualizar el estado de la cotización a ${nuevoEstadoCotizacion}:`, err.message);
        }
      }

      const tipoMensaje = (resultado.estadoSunat === 'ACEPTADA') ? 'success' : 'error';
      setMensaje({
        tipo: tipoMensaje,
        texto: `${resultado.tipo} ${resultado.serie}-${resultado.numero} generada y enviada a SUNAT. Estado: ${resultado.estadoSunat}${resultado.mensajeSunat ? ' — ' + resultado.mensajeSunat : ''}`
      });
      setMostrarModal(false);
      setCotizacionSeleccionada(null);
      setItemsEditables([]);
      setFormComprobante({ ...FORM_COMPROBANTE_VACIO });
      setTimeout(() => setMensaje(null), 8000);
    } catch (err) {
      console.error('Error generando comprobante:', err);
      setMensaje({ tipo: 'error', texto: 'Error al generar comprobante: ' + err.message });
    } finally {
      setProcesando(false);
    }
  }

  // Solo se permite eliminar comprobantes que NO estén ACEPTADOS por SUNAT
  // (eliminar un comprobante aceptado es ilegal según la normativa SUNAT).
  function solicitarEliminar(factura) {
    if (factura.estadoSunat === 'ACEPTADA') {
      setMensaje({
        tipo: 'error',
        texto: 'No se puede eliminar un comprobante ACEPTADO por SUNAT. Emita una nota de crédito en su lugar.'
      });
      setTimeout(() => setMensaje(null), 5000);
      return;
    }
    setEliminarId(factura.id);
    setMostrarConfirm(true);
  }

  async function confirmarEliminar() {
    try {
      await removeFactura(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
      setMensaje({ tipo: 'success', texto: 'Comprobante eliminado correctamente' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      console.error('Error eliminando factura:', err);
      setMensaje({ tipo: 'error', texto: 'Error al eliminar: ' + err.message });
    }
  }

  function descargarXML(factura) {
    if (!factura.xmlFirmado) {
      setMensaje({ tipo: 'error', texto: 'Este comprobante no cuenta con un XML firmado disponible.' });
      setTimeout(() => setMensaje(null), 4000);
      return;
    }
    const blob = new Blob([factura.xmlFirmado], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${factura.serie}-${factura.numero}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Reintenta el envío a SUNAT para comprobantes en ERROR o RECHAZADA.
  async function reintentarEnvioSunat(factura) {
    setProcesando(true);
    try {
      const docRef = doc(db, 'facturacion', factura.id);
      await updateDoc(docRef, {
        estadoSunat: 'PENDIENTE',
        mensajeSunat: 'Reintentando envío...'
      });

      const emitirComprobante = httpsCallable(functions, 'emitirComprobante');

      const resultado = await emitirComprobante({
        facturaId: factura.id,
        facturaData: factura,
        empresaData: empresaData
      });

      const estado = resultado?.data?.estado || factura.estadoSunat;
      const mensajeSunat = resultado?.data?.mensaje || '';
      let nuevoEstadoCot = null;
      if (estado === 'ACEPTADA') {
        nuevoEstadoCot = 'Aceptada';
      } else if (estado === 'RECHAZADA' || estado === 'ERROR') {
        nuevoEstadoCot = 'Error';
      }
      if (nuevoEstadoCot && factura.cotizacionId) {
        try {
          const cotRef = doc(db, 'cotizaciones', factura.cotizacionId);
          await updateDoc(cotRef, {
            estado: nuevoEstadoCot,
            ...(nuevoEstadoCot === 'Aceptada' ? { fechaAceptacion: new Date().toISOString() } : {}),
            motivoRechazoSunat: mensajeSunat || '',
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('No se pudo propagar el estado a la cotización:', err.message);
        }
      }

      if (estado === 'RECHAZADA' || estado === 'ERROR') {
        setMensaje({ tipo: 'error', texto: `SUNAT rechazó el comprobante nuevamente: ${mensajeSunat}` });
      } else if (estado === 'ACEPTADA') {
        setMensaje({ tipo: 'success', texto: 'Comprobante reprocesado con éxito.' });
      }
      setTimeout(() => setMensaje(null), 6000);

      await refrescar();
    } catch (err) {
      console.error('Error al reintentar envío:', err);
      setMensaje({ tipo: 'error', texto: 'Error al reintentar: ' + err.message });
    } finally {
      setProcesando(false);
    }
  }

  async function descargarComprobante(factura) {
    try {
      const mod = await import('../utils/generatePDF');
      if (mod.downloadFacturaPDF) {
        mod.downloadFacturaPDF(factura, { empresa: empresaData });
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      setMensaje({ tipo: 'error', texto: 'Error al generar el PDF: ' + err.message });
      setTimeout(() => setMensaje(null), 5000);
    }
  }

  function verDetalle(factura) {
    setFacturaDetalle(factura);
    setMostrarDetalle(true);
  }

  const badgeEstado = (estado) => {
    const clase = (estado || 'pendiente').toLowerCase();
    return (
      <span className={`badge-sunat estado-${clase}`}>
        {ICONO_ESTADO[estado] || <FiClock />}
        {estado || 'PENDIENTE'}
      </span>
    );
  };

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }
  function alCambiarTipo(valor) {
    setFiltroTipo(valor);
    setPaginaActual(1);
  }
  function alCambiarEstado(valor) {
    setFiltroEstado(valor);
    setPaginaActual(1);
  }

  if (cargandoFacturas || cargandoCotizaciones) return <Loading message="Cargando facturación..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Boletas / Facturas SUNAT</h1>
          <p className="pagina-subtitle">Generación de comprobantes electrónicos conectados a SUNAT</p>
        </div>
        <button className="btn-principal" onClick={() => setMostrarModal(true)}>
          <FiPlus size={16} /> Generar Comprobante
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="stats-facturacion">
        <div className="stat-mini">
          <span className="stat-mini-label">Total</span>
          <span className="stat-mini-value">{stats.total}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Aceptadas</span>
          <span className="stat-mini-value stat-verde">{stats.aceptadas}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Pendientes</span>
          <span className="stat-mini-value stat-amarillo">{stats.pendientes}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Con Error</span>
          <span className="stat-mini-value stat-rojo">{stats.errores}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Rechazadas SUNAT</span>
          <span className="stat-mini-value stat-rojo">{stats.rechazadas}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Monto Aceptado</span>
          <span className="stat-mini-value stat-azul">{formatUSD(stats.montoTotal)}</span>
        </div>
      </div>

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por número, cliente, RUC o cotización..."
            value={terminoBusqueda}
            onChange={(e) => alCambiarBusqueda(e.target.value)}
          />
        </div>
        <select className="selector-filtro" value={filtroTipo} onChange={(e) => alCambiarTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value={TIPOS_COMPROBANTE.BOLETA}>Boleta</option>
          <option value={TIPOS_COMPROBANTE.FACTURA}>Factura</option>
        </select>
        <select className="selector-filtro" value={filtroEstado} onChange={(e) => alCambiarEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ACEPTADA">Aceptada</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="RECHAZADA">Rechazada por SUNAT</option>
          <option value="ERROR">Error</option>
        </select>
        <button className="btn-secundario btn-pequeno" onClick={refrescar} title="Refrescar">
          <FiRefreshCw size={14} /> Refrescar
        </button>
      </div>

      <div className="tarjeta-tabla">
        {facturasFiltradas.length === 0 ? (
          <div className="estado-vacio">
            <FiFileText size={48} style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
            <p>No hay comprobantes generados</p>
            <p className="pista">Genera tu primera boleta o factura desde una cotización aprobada</p>
          </div>
        ) : (
          <>
            <Paginacion
              total={facturasFiltradas.length}
              paginaActual={paginaActual}
              porPagina={porPagina}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={setPorPagina}
            />
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Serie</th>
                    <th>Número</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>RUC</th>
                    <th className="texto-derecha">Total</th>
                    <th className="texto-centro">Estado</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasPaginadas.map((f) => (
                    <tr key={f.id}>
                      <td className="texto-codigo">{f.serie}</td>
                      <td className="texto-codigo">{f.numero}</td>
                      <td>
                        <span className={`badge-tipo tipo-${f.tipo.toLowerCase().replace(/\s/g, '-')}`}>
                          {f.tipo}
                        </span>
                      </td>
                      <td>{formatDate(f.fechaEmision)}</td>
                      <td className="texto-negrita">{f.cliente?.razonSocial || '-'}</td>
                      <td className="texto-codigo">{f.cliente?.ruc || '-'}</td>
                      <td className="texto-derecha texto-negrita">{formatUSD(f.total || 0)}</td>
                      <td className="texto-centro">
                        <div title={(f.estadoSunat === 'RECHAZADA' || f.estadoSunat === 'ERROR') ? (f.mensajeSunat || f.descripcionErrorSunat || 'Rechazado por SUNAT') : f.estadoSunat}>
                          {badgeEstado(f.estadoSunat)}
                          {(f.estadoSunat === 'RECHAZADA' || f.estadoSunat === 'ERROR') && (
                            <div style={{ fontSize: '10px', color: '#c0392b', marginTop: '2px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.mensajeSunat || f.descripcionErrorSunat || ''}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          <button className="btn-accion" onClick={() => verDetalle(f)} title="Ver detalle">
                            <FiEye size={16} />
                          </button>
                          <button className="btn-accion" onClick={() => descargarComprobante(f)} title="Descargar PDF">
                            <FiDownload size={16} />
                          </button>
                          <button className="btn-accion" onClick={() => descargarXML(f)} title="Descargar XML">
                            <FiFileText size={16} />
                          </button>

                          {/* Reintento solo para ERROR y RECHAZADA */}
                          {(f.estadoSunat === 'ERROR' || f.estadoSunat === 'RECHAZADA') && (
                            <button
                              className="btn-accion"
                              onClick={() => reintentarEnvioSunat(f)}
                              title="Reintentar envío a SUNAT"
                              disabled={procesando}
                              style={{ color: '#eab308' }}
                            >
                              <FiRefreshCw size={16} />
                            </button>
                          )}

                          {/* Solo se permite eliminar comprobantes NO ACEPTADOS por SUNAT */}
                          {f.estadoSunat !== 'ACEPTADA' && (
                            <button
                              className="btn-accion btn-eliminar"
                              onClick={() => solicitarEliminar(f)}
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={mostrarModal}
        onClose={() => {
          setMostrarModal(false);
          setCotizacionSeleccionada(null);
          setItemsEditables([]);
          setFormComprobante({ ...FORM_COMPROBANTE_VACIO });
        }}
        title="Generar Boleta / Factura"
        size="large"
      >
        <div className="modal-generar">
          <p className="modal-info">
            Selecciona una cotización para generar su comprobante electrónico.
            El tipo se auto-selecciona según el RUC, pero puedes cambiarlo manualmente.
            Completa los datos operativos (guía de remisión, orden de compra, detracción)
            antes de emitir el comprobante a SUNAT.
          </p>

          {cotizacionesAprobadas.length === 0 ? (
            <div className="estado-vacio">
              <p>No hay cotizaciones pendientes de facturar</p>
              <p className="pista">Crea cotizaciones desde el módulo de Cotizaciones. Las cotizaciones rechazadas por SUNAT no aparecen aquí.</p>
            </div>
          ) : (
            <>
              <div className="lista-cotizaciones-aprobadas">
                {cotizacionesAprobadas.map((cot) => (
                  <div
                    key={cot.id}
                    className={`item-cotizacion-aprobada ${cotizacionSeleccionada?.id === cot.id ? 'seleccionada' : ''}`}
                    onClick={() => seleccionarCotizacion(cot)}
                  >
                    <div className="item-info">
                      <span className="item-codigo">{cot.codigo}</span>
                      <span className="item-cliente">{cot.cliente?.razonSocial || '-'}</span>
                      <span className="item-total">{formatUSD(cot.total || 0)}</span>
                    </div>
                    {cotizacionSeleccionada?.id === cot.id && <span className="item-seleccionado"><FiCheck size={14} /></span>}
                  </div>
                ))}
              </div>

              {cotizacionSeleccionada && (
                <div className="modal-preview">
                  <h4>Comprobante a emitir — Cotización {cotizacionSeleccionada.codigo}</h4>

                  {/* ====== Items editables ====== */}
                  <div className="items-comprobante-seccion">
                    <h5 className="subtitulo-seccion">Items del comprobante</h5>
                    <div className="items-tabla-wrapper">
                      <table className="items-tabla items-tabla-comprobante">
                        <thead>
                          <tr>
                            <th className="col-codigo">Código</th>
                            <th className="col-desc">Descripción</th>
                            <th className="col-cant">Cant.</th>
                            <th className="col-unidad">Unidad</th>
                            <th className="col-precio">Precio Unit.</th>
                            <th className="col-subtotal">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsConImporte.length === 0 ? (
                            <tr><td colSpan="6" className="texto-centro">No hay items en esta cotización</td></tr>
                          ) : (
                            itemsConImporte.map((item, idx) => (
                              <tr key={idx}>
                                <td>
                                  <input
                                    type="text"
                                    value={item.codigo || ''}
                                    onChange={(e) => cambiarItemEditable(idx, 'codigo', e.target.value)}
                                    placeholder="Código"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={item.descripcion || ''}
                                    onChange={(e) => cambiarItemEditable(idx, 'descripcion', e.target.value)}
                                    placeholder="Descripción"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={item.cantidad}
                                    onChange={(e) => cambiarItemEditable(idx, 'cantidad', Number(e.target.value))}
                                    min="0"
                                    step="0.01"
                                    className="input-centro"
                                  />
                                </td>
                                <td>
                                  <select
                                    value={item.unidadMedida || 'UNIDAD'}
                                    onChange={(e) => cambiarItemEditable(idx, 'unidadMedida', e.target.value)}
                                  >
                                    {UNIDADES_MEDIDA.map((u) => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={item.precioUnitario}
                                    onChange={(e) => cambiarItemEditable(idx, 'precioUnitario', Number(e.target.value))}
                                    min="0"
                                    step="0.01"
                                    className="input-derecha"
                                  />
                                </td>
                                <td className="texto-derecha texto-negrita">
                                  {formatUSD(item.importe || 0)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="preview-totales">
                      <span>Subtotal: {formatUSD(subtotalEditable)}</span>
                      <span>IGV (18%): {formatUSD(igvEditable)}</span>
                      <span><strong>Total: {formatUSD(totalEditable)}</strong></span>
                    </div>
                  </div>

                  {/* ====== Datos operativos ====== */}
                  <div className="datos-operativos-seccion">
                    <h5 className="subtitulo-seccion">Datos operativos del comprobante</h5>
                    <div className="fila-form fila-form-2">
                      <div className="campo">
                        <label>Tipo de comprobante</label>
                        <select
                          value={tipoComprobante}
                          onChange={(e) => setTipoComprobante(e.target.value)}
                        >
                          <option value={TIPOS_COMPROBANTE.BOLETA}>Boleta</option>
                          <option value={TIPOS_COMPROBANTE.FACTURA}>Factura</option>
                        </select>
                      </div>
                      <div className="campo">
                        <label>Forma de pago</label>
                        <input
                          type="text"
                          value={cotizacionSeleccionada.condicionPago || 'Contado'}
                          readOnly
                          className="input-solo-lectura"
                        />
                      </div>
                    </div>

                    <div className="fila-form fila-form-2">
                      <div className="campo">
                        <label>Guía de remisión remitente *</label>
                        <input
                          type="text"
                          value={formComprobante.guiaRemision}
                          onChange={(e) => cambiarCampoComprobante('guiaRemision', e.target.value)}
                          placeholder="Ej. T001-12345"
                          maxLength="40"
                        />
                        <span className="pista-campo">Número de guía de remisión emitida manualmente.</span>
                      </div>
                      <div className="campo">
                        <label>Orden de compra</label>
                        <input
                          type="text"
                          value={formComprobante.ordenCompra}
                          onChange={(e) => cambiarCampoComprobante('ordenCompra', e.target.value)}
                          placeholder="Ej. OC-2025-0456"
                          maxLength="40"
                        />
                        <span className="pista-campo">OC que el cliente nos entrega.</span>
                      </div>
                    </div>

                    <div className="campo">
                      <label>Observación</label>
                      <textarea
                        value={formComprobante.observaciones}
                        onChange={(e) => cambiarCampoComprobante('observaciones', e.target.value)}
                        placeholder="Observaciones que aparecerán en el comprobante..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* ====== Detracción ====== */}
                  <div className="detraccion-seccion">
                    <div className="detraccion-header">
                      <label className="detraccion-toggle">
                        <input
                          type="checkbox"
                          checked={formComprobante.aplicarDetraccion}
                          onChange={(e) => cambiarCampoComprobante('aplicarDetraccion', e.target.checked)}
                        />
                        <span>Aplicar detracción (Sistema de Pago de Obligaciones Tributarias)</span>
                      </label>
                    </div>

                    {formComprobante.aplicarDetraccion && (
                      <div className="detraccion-cuerpo">
                        <div className="fila-form fila-form-3">
                          <div className="campo">
                            <label>Porcentaje detracción (%)</label>
                            <input
                              type="number"
                              value={formComprobante.porcentajeDetraccion}
                              onChange={(e) => cambiarCampoComprobante('porcentajeDetraccion', Number(e.target.value))}
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </div>
                          <div className="campo">
                            <label>Monto detracción (S/)</label>
                            <input
                              type="number"
                              value={formComprobante.montoDetraccion}
                              onChange={(e) => cambiarCampoComprobante('montoDetraccion', Number(e.target.value))}
                              min="0"
                              step="0.01"
                            />
                            <span className="pista-campo">La detracción siempre se paga en Soles al Banco de la Nación.</span>
                          </div>
                          <div className="campo">
                            <label>N° Cuenta Banco de la Nación</label>
                            <input
                              type="text"
                              value={formComprobante.cuentaDetraccion}
                              onChange={(e) => cambiarCampoComprobante('cuentaDetraccion', e.target.value)}
                              maxLength="20"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="acciones-form">
                <button
                  className="btn-secundario"
                  onClick={() => {
                    setMostrarModal(false);
                    setCotizacionSeleccionada(null);
                    setItemsEditables([]);
                    setFormComprobante({ ...FORM_COMPROBANTE_VACIO });
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-principal"
                  onClick={generarComprobante}
                  disabled={!cotizacionSeleccionada || procesando}
                >
                  {procesando ? 'Generando...' : 'Generar y enviar a SUNAT'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={mostrarDetalle}
        onClose={() => setMostrarDetalle(false)}
        title="Detalle del Comprobante"
        size="large"
      >
        {facturaDetalle && (
          <div className="detalle-factura">
            <div className="detalle-header">
              <h3>{facturaDetalle.tipo} {facturaDetalle.serie}-{facturaDetalle.numero}</h3>
              <p>Fecha: {formatDate(facturaDetalle.fechaEmision)}</p>
              <p>Estado: <strong>{facturaDetalle.estadoSunat}</strong></p>
              {facturaDetalle.codigoRespuesta && (
                <p>Código de respuesta SUNAT: <strong>{facturaDetalle.codigoRespuesta}</strong></p>
              )}
              {(facturaDetalle.estadoSunat === 'RECHAZADA' || facturaDetalle.estadoSunat === 'ERROR') && (
                <div style={{
                  background: '#fdecea',
                  border: '1px solid #c0392b',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginTop: '8px',
                  color: '#c0392b',
                }}>
                  <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>
                    Motivo del rechazo:
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>
                    {facturaDetalle.mensajeSunat || facturaDetalle.descripcionErrorSunat || 'SUNAT rechazó el comprobante sin especificar motivo.'}
                  </p>
                  {facturaDetalle.descripcionErrorSunat && facturaDetalle.descripcionErrorSunat !== facturaDetalle.mensajeSunat && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#7f1d1d', fontStyle: 'italic' }}>
                      Detalle técnico: {facturaDetalle.descripcionErrorSunat}
                    </p>
                  )}
                </div>
              )}
              {facturaDetalle.estadoSunat === 'ACEPTADA' && facturaDetalle.cdrBase64 && (
                <div style={{
                  background: '#eafaf1',
                  border: '1px solid #1e7e34',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  marginTop: '8px',
                  color: '#1e7e34',
                  fontSize: '13px',
                }}>
                  Comprobante aceptado por SUNAT. CDR disponible.
                </div>
              )}
            </div>
            <div className="detalle-cliente">
              <h4>Cliente</h4>
              <p><strong>{facturaDetalle.cliente?.razonSocial}</strong></p>
              <p>RUC: {facturaDetalle.cliente?.ruc}</p>
              <p>Dirección: {facturaDetalle.cliente?.direccion}</p>
              <p>Teléfono: {facturaDetalle.cliente?.telefono}</p>
              <p>Email: {facturaDetalle.cliente?.email}</p>
            </div>
            <div className="detalle-items">
              <h4>Items</h4>
              <table className="tabla-datos">
                <thead>
                  <tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Importe</th></tr>
                </thead>
                <tbody>
                  {facturaDetalle.items?.map((item, i) => (
                    <tr key={i}>
                      <td>{item.descripcion}</td>
                      <td className="texto-centro">{item.cantidad}</td>
                      <td className="texto-derecha">{formatUSD(item.precioUnitario)}</td>
                      <td className="texto-derecha">{formatUSD(item.importe)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan="3" className="texto-derecha">Subtotal:</td><td className="texto-derecha">{formatUSD(facturaDetalle.subtotal)}</td></tr>
                  <tr><td colSpan="3" className="texto-derecha">IGV (18%):</td><td className="texto-derecha">{formatUSD(facturaDetalle.igv)}</td></tr>
                  <tr><td colSpan="3" className="texto-derecha"><strong>Total:</strong></td><td className="texto-derecha"><strong>{formatUSD(facturaDetalle.total)}</strong></td></tr>
                </tfoot>
              </table>
            </div>
            <div className="acciones-form">
              <button className="btn-secundario" onClick={() => setMostrarDetalle(false)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirm}
        onClose={() => setMostrarConfirm(false)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar comprobante?"
        message="Esta acción eliminará el comprobante permanentemente. Si el comprobante ya fue enviado a SUNAT, deberá emitir una nota de crédito en su lugar."
      />
    </div>
  );
}
