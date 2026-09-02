import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiEdit2, FiTrash2, FiPlus, FiSearch, FiUserPlus, FiLoader, FiX, FiShoppingCart } from 'react-icons/fi';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { useClientes } from '../hooks/useClientes';
import { useEquipos } from '../hooks/useEquipos';
import { useMangas } from '../hooks/useMangas';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { searchEquipoByCodigo } from '../services/equipoService';
import { searchMangaByCodigo } from '../services/mangaService';
import { addLog } from '../services/logService';
import { useRucLookup } from '../hooks/useRucLookup';
import { formatDate, formatDateISO } from '../utils/formatDate';
import { formatUSD, formatCurrency, calcularSubtotal, calcularIGV, calcularTotal } from '../utils/formatCurrency';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Cotizaciones.css';

const CONDICIONES_PAGO_DEFAULT = ['Contado', '7 días', '15 días'];
const ESTADOS = ['Generada', 'Aceptada', 'Error', 'Cancelada'];

const MONEDAS = [
  { codigo: 'US$', label: 'Dólares (US$)', format: formatUSD },
  { codigo: 'S/', label: 'Soles (S/)', format: formatCurrency }
];

function formatMoneda(monto, codigoMoneda) {
  const moneda = MONEDAS.find(m => m.codigo === codigoMoneda) || MONEDAS[0];
  return moneda.format(monto);
}

const COLOR_FILA_ESTADO = {
  Generada: 'fila-generada',
  Aceptada: 'fila-aceptada',
  Error: 'fila-error',
  Cancelada: 'fila-cancelada',
  // Compatibilidad con cotizaciones antiguas
  Borrador: 'fila-generada',
  Enviada: 'fila-generada',
  Aprobada: 'fila-aceptada',
  Rechazada: 'fila-error'
};

function obtenerContactosCliente(cliente) {
  if (!cliente) return [];
  if (cliente.contactos && cliente.contactos.length > 0) return cliente.contactos;
  if (cliente.contacto || cliente.email) {
    return [{
      nombre: cliente.contacto || '',
      celular: cliente.telefono || cliente.celular || '',
      email: cliente.email || ''
    }];
  }
  return [];
}

const ITEM_VACIO = { codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, equipoId: '', unidadMedida: 'UNIDAD', tiempoEntrega: '', tipo: 'producto' };
const UNIDADES_MEDIDA = ['UNIDAD', 'LT.', 'KG.', 'DOC.', 'PZ.', 'EQ.', 'M.', 'KIT.', '%.', 'MILL.'];
const UNIDADES_TIEMPO = ['semanas', 'meses', 'días'];

const FORMULARIO_VACIO = {
  clienteId: '',
  contactoClienteId: '',
  condicionPago: 'Contado',
  validezNumero: 15,
  moneda: 'US$',
  tiempoEntregaNumero: 3,
  tiempoEntregaUnidad: 'semanas',
  tipoItem: 'equipo',
  sinIGV: false,
  items: [{ ...ITEM_VACIO }],
  estado: 'Generada'
};

function EquipoCombobox({ equipos, value, onSelect }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 });
  const contenedorRef = useRef(null);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const equipoSeleccionado = useMemo(
    () => equipos.find((eq) => eq.id === value) || null,
    [equipos, value]
  );

  const textoMostrado = abierto ? busqueda : (equipoSeleccionado ? `${equipoSeleccionado.codigo} - ${equipoSeleccionado.nombre}` : '');

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return equipos.slice(0, 50);
    return equipos
      .filter((eq) =>
        (eq.codigo || '').toLowerCase().includes(q) ||
        (eq.nombre || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [equipos, busqueda]);

  function actualizarPosicion() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom;
    const alturaLista = 240;
    const mostrarArriba = espacioAbajo < alturaLista && rect.top > alturaLista;
    setPosicion({
      top: mostrarArriba ? rect.top - Math.min(alturaLista, rect.top - 8) : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 260),
      abajo: !mostrarArriba
    });
  }

  function abrir() {
    actualizarPosicion();
    setAbierto(true);
    setBusqueda('');
    setResaltado(0);
  }

  useEffect(() => {
    if (!abierto) return;
    actualizarPosicion();
    function alClicFuera(e) {
      if (
        contenedorRef.current && !contenedorRef.current.contains(e.target) &&
        listaRef.current && !listaRef.current.contains(e.target)
      ) {
        setAbierto(false);
        setBusqueda('');
      }
    }
    function alScrollOResize() {
      actualizarPosicion();
    }
    document.addEventListener('mousedown', alClicFuera);
    window.addEventListener('scroll', alScrollOResize, true);
    window.addEventListener('resize', alScrollOResize);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      window.removeEventListener('scroll', alScrollOResize, true);
      window.removeEventListener('resize', alScrollOResize);
    };
  }, [abierto]);

  function elegir(eq) {
    onSelect(eq.id);
    setAbierto(false);
    setBusqueda('');
  }

  function alTeclear(e) {
    if (!abierto) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (resultados[resaltado]) elegir(resultados[resaltado]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
      setBusqueda('');
    }
  }

  return (
    <div className="equipo-combobox" ref={contenedorRef}>
      <input
        ref={inputRef}
        type="text"
        className="equipo-combobox-input"
        value={textoMostrado}
        placeholder="Buscar por código o nombre..."
        onFocus={abrir}
        onChange={(e) => { setBusqueda(e.target.value); setResaltado(0); if (!abierto) abrir(); }}
        onKeyDown={alTeclear}
      />
      {value && !abierto && (
        <button
          type="button"
          className="equipo-combobox-limpiar"
          title="Quitar selección"
          onClick={() => onSelect('')}
        >
          <FiX size={12} />
        </button>
      )}
      {abierto && createPortal(
        <div
          className="equipo-combobox-lista"
          ref={listaRef}
          style={{
            position: 'fixed',
            top: posicion.top,
            left: posicion.left,
            width: posicion.width
          }}
        >
          {resultados.length === 0 && (
            <div className="equipo-combobox-vacio">Sin resultados</div>
          )}
          {resultados.map((eq, i) => (
            <div
              key={eq.id}
              className={`equipo-combobox-item${i === resaltado ? ' resaltado' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); elegir(eq); }}
              onMouseEnter={() => setResaltado(i)}
            >
              <span className="equipo-combobox-codigo">{eq.codigo}</span>
              <span className="equipo-combobox-nombre">{eq.nombre}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Cotizaciones() {
  const navigate = useNavigate();
  const { cotizaciones, loading, addCotizacion, editCotizacion, removeCotizacion } = useCotizaciones();
  const { clientes, addCliente, editCliente } = useClientes();
  const { equipos } = useEquipos();
  const { mangas } = useMangas();
  const { currentUser, userProfile } = useAuth();
  const { config, refreshConfig } = useConfig();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 6000);
  }

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [clienteDropdownAbierto, setClienteDropdownAbierto] = useState(false);

  const [busquedaContacto, setBusquedaContacto] = useState('');
  const [contactoDropdownAbierto, setContactoDropdownAbierto] = useState(false);

  // Edición del contacto seleccionado directamente desde la cotización
  const [editandoContacto, setEditandoContacto] = useState(false);
  const [contactoEditForm, setContactoEditForm] = useState({ nombre: '', celular: '', email: '' });
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  const [form, setForm] = useState({ ...FORMULARIO_VACIO });
  const [erroresForm, setErroresForm] = useState({});
  const [buscandoCodigo, setBuscandoCodigo] = useState({});

  const CONDICIONES_PAGO = (config?.condicionesPago && config.condicionesPago.length > 0)
    ? config.condicionesPago
    : CONDICIONES_PAGO_DEFAULT;

  const responsable = userProfile?.nombre || currentUser?.displayName || currentUser?.email || '';
  const cargoResponsable = userProfile?.cargo || '';
  const emailResponsable = userProfile?.email || currentUser?.email || '';
  const telefonoResponsable = userProfile?.telefono || '';

  const contactosCliente = useMemo(() => obtenerContactosCliente(clienteSeleccionado), [clienteSeleccionado]);

  const contactosFiltrados = useMemo(() => {
    if (!busquedaContacto.trim()) return contactosCliente;
    const term = busquedaContacto.toLowerCase();
    return contactosCliente.filter(ct =>
      (ct.nombre || '').toLowerCase().includes(term) ||
      (ct.email || '').toLowerCase().includes(term) ||
      (ct.celular || '').toLowerCase().includes(term)
    );
  }, [contactosCliente, busquedaContacto]);

  const cotizacionesFiltradas = useMemo(() => {
    return cotizaciones.filter((c) => {
      const term = terminoBusqueda.toLowerCase();
      const coincideBusqueda =
        c.codigo?.toLowerCase().includes(term) ||
        c.cliente?.razonSocial?.toLowerCase().includes(term) ||
        c.responsable?.toLowerCase().includes(term);
      const coincideEstado = !filtroEstado || c.estado === filtroEstado;
      return coincideBusqueda && coincideEstado;
    });
  }, [cotizaciones, terminoBusqueda, filtroEstado]);

  const cotizacionesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return cotizacionesFiltradas.slice(inicio, inicio + porPagina);
  }, [cotizacionesFiltradas, paginaActual, porPagina]);

  const pendientesCount = cotizaciones.filter(
    (c) => c.estado === 'Generada' || c.estado === 'Borrador' || c.estado === 'Enviada'
  ).length;

  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente.trim()) return clientes.slice(0, 10);
    const term = busquedaCliente.toLowerCase();
    return clientes
      .filter(c =>
        c.razonSocial?.toLowerCase().includes(term) ||
        c.ruc?.toLowerCase().includes(term)
      )
      .slice(0, 20);
  }, [clientes, busquedaCliente]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }

  function alCambiarEstado(valor) {
    setFiltroEstado(valor);
    setPaginaActual(1);
  }

  function nuevaCotizacion() {
    setEditandoId(null);
    setForm({ ...FORMULARIO_VACIO, items: [{ ...ITEM_VACIO }] });
    setErroresForm({});
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setClienteDropdownAbierto(false);
    setBusquedaContacto('');
    setContactoDropdownAbierto(false);
    setMostrarModal(true);
  }

  function editarCotizacion(cot) {
    setEditandoId(cot.id);
    const validezStr = String(cot.validez || '');
    const numeroEncontrado = validezStr.match(/\d+/);
    const contactosCliente = obtenerContactosCliente(cot.cliente);
    let contactoIdx = '';
    if (cot.contactoSeleccionado) {
      const idx = contactosCliente.findIndex(
        c => (c.nombre || '') === (cot.contactoSeleccionado.nombre || '') &&
          (c.email || '') === (cot.contactoSeleccionado.email || '')
      );
      if (idx >= 0) contactoIdx = String(idx);
    }
    if (contactoIdx === '' && contactosCliente.length > 0) contactoIdx = '0';

    setForm({
      clienteId: cot.clienteId || '',
      contactoClienteId: contactoIdx,
      condicionPago: cot.condicionPago || 'Contado',
      validezNumero: numeroEncontrado ? parseInt(numeroEncontrado[0], 10) : 15,
      moneda: cot.moneda || 'US$',
      tiempoEntregaNumero: cot.tiempoEntregaNumero || (cot.tiempoEntrega ? (String(cot.tiempoEntrega).match(/\d+/) || [3])[0] : 3),
      tiempoEntregaUnidad: cot.tiempoEntregaUnidad || (cot.tiempoEntrega && /mes/i.test(cot.tiempoEntrega) ? 'meses' : cot.tiempoEntrega && /d[ií]a/i.test(cot.tiempoEntrega) ? 'días' : 'semanas'),
      tipoItem: cot.tipoItem || 'equipo',
      sinIGV: !!cot.sinIGV,
      items: cot.items?.length ? cot.items.map((i) => ({ ...i })) : [{ ...ITEM_VACIO }],
      estado: cot.estado || 'Generada'
    });
    setErroresForm({});
    setBusquedaCliente(cot.cliente?.razonSocial || '');
    setClienteSeleccionado(cot.cliente || null);
    setMostrarModal(true);
  }

  function solicitarEliminar(id) {
    setEliminarId(id);
    setMostrarConfirm(true);
  }

  function handleChange(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (erroresForm[campo]) {
      setErroresForm((prev) => ({ ...prev, [campo]: null }));
    }
  }

  function cambiarItem(index, campo, valor) {
    setForm((prev) => {
      const items = [...prev.items];
      let valorFinal = valor;
      if (campo === 'precioUnitario' && valor !== '') {
        // Redondeo a 2 decimales para evitar desvíos de punto flotante
        // (ej. escribir 10 y que termine guardándose como 9.99).
        const num = Number(valor);
        valorFinal = Number.isFinite(num) ? Math.round(num * 100) / 100 : valor;
      }
      items[index] = { ...items[index], [campo]: valorFinal };
      return { ...prev, items };
    });
  }

  // Actualiza el tiempo de entrega (OC) de un ítem como número + unidad
  // (día/semana/mes), igual que el selector que existía antes, en vez de
  // texto libre.
  function cambiarEntregaItem(index, numero, unidad) {
    setForm((prev) => {
      const items = [...prev.items];
      const n = numero === '' ? '' : Math.max(1, Number(numero));
      const u = unidad || items[index].tiempoEntregaUnidad || 'días';
      items[index] = {
        ...items[index],
        tiempoEntregaNumero: n,
        tiempoEntregaUnidad: u,
        tiempoEntrega: n === '' ? '' : `${n} ${u} recibida la OC`
      };
      return { ...prev, items };
    });
  }

  async function buscarEquipoPorCodigo(index, codigo) {
    if (!codigo || codigo.trim().length < 2) return;
    setBuscandoCodigo((prev) => ({ ...prev, [index]: true }));
    try {
      const searcher = form.tipoItem === 'manga' ? searchMangaByCodigo : searchEquipoByCodigo;
      const producto = await searcher(codigo.trim());
      if (producto) {
        setForm((prev) => {
          const items = [...prev.items];
          items[index] = {
            ...items[index],
            codigo: producto.codigo,
            descripcion: producto.nombre,
            unidadMedida: producto.unidadMedida || 'UNIDAD',
            precioUnitario: producto.precio || 0,
            diametro: producto.diametro || '',
            longitud: producto.longitud || '',
            material: producto.material || '',
            tipoAcople: producto.tipoAcople || '',
            esAccesorio: producto.tipoProducto === 'accesorio'
          };
          return { ...prev, items };
        });
      }
    } catch (err) {
      console.error('Error buscando producto:', err);
    } finally {
      setBuscandoCodigo((prev) => ({ ...prev, [index]: false }));
    }
  }

  function agregarItem(tipo = 'producto') {
    const nuevo = { ...ITEM_VACIO, tipo };
    if (tipo === 'transporte') {
      nuevo.codigo = '6000 0001';
      nuevo.descripcion = 'Transporte';
      nuevo.cantidad = 1;
      nuevo.unidadMedida = 'SERVICIO';
      nuevo.esAccesorio = false;
    } else if (tipo === 'accesorio') {
      nuevo.unidadMedida = 'PIEZA';
      nuevo.esAccesorio = true;
    }
    setForm((prev) => ({ ...prev, items: [...prev.items, nuevo] }));
  }

  function quitarItem(index) {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function seleccionarEquipo(index, equipoId) {
    const lista = form.tipoItem === 'manga' ? mangas : equipos;
    const producto = lista.find((e) => e.id === equipoId);
    if (producto) {
      setForm((prev) => {
        const items = [...prev.items];
        items[index] = {
          ...items[index],
          equipoId: producto.id,
          codigo: producto.codigo,
          descripcion: producto.nombre,
          unidadMedida: producto.unidadMedida || 'UNIDAD',
          precioUnitario: producto.precio || 0,
          diametro: producto.diametro || '',
          longitud: producto.longitud || '',
          material: producto.material || '',
          tipoAcople: producto.tipoAcople || '',
          esAccesorio: producto.tipoProducto === 'accesorio'
        };
        return { ...prev, items };
      });
    }
  }

  function seleccionarCliente(cliente) {
    const contactos = obtenerContactosCliente(cliente);
    setForm((prev) => ({
      ...prev,
      clienteId: cliente.id,
      contactoClienteId: contactos.length > 0 ? '0' : ''
    }));
    setClienteSeleccionado(cliente);
    setBusquedaCliente(cliente.razonSocial);
    setClienteDropdownAbierto(false);
    if (erroresForm.clienteId) {
      setErroresForm((prev) => ({ ...prev, clienteId: null }));
    }
  }

  function limpiarCliente() {
    setForm((prev) => ({ ...prev, clienteId: '', contactoClienteId: '' }));
    setClienteSeleccionado(null);
    setBusquedaCliente('');
    setClienteDropdownAbierto(false);
    limpiarRucLookup();
  }

  // Edición del contacto seleccionado directamente desde la cotización.
  function abrirEdicionContacto() {
    const ct = contactosCliente[Number(form.contactoClienteId)] || {};
    setContactoEditForm({
      nombre: ct.nombre || '',
      celular: ct.celular || '',
      email: ct.email || ''
    });
    setEditandoContacto(true);
  }

  function cerrarEdicionContacto() {
    setEditandoContacto(false);
  }

  async function guardarContactoEditado() {
    if (!clienteSeleccionado) return;
    const nombre = contactoEditForm.nombre.trim();
    if (!nombre) {
      mostrarMensaje('error', 'El nombre del contacto es obligatorio.');
      return;
    }
    const idx = Number(form.contactoClienteId);
    const contactosActualizados = contactosCliente.map((ct, i) =>
      i === idx
        ? { nombre, celular: contactoEditForm.celular.trim(), email: contactoEditForm.email.trim() }
        : ct
    );
    setGuardandoContacto(true);
    try {
      await editCliente(clienteSeleccionado.id, { contactos: contactosActualizados });
      const clienteActualizado = { ...clienteSeleccionado, contactos: contactosActualizados };
      setClienteSeleccionado(clienteActualizado);
      setEditandoContacto(false);
      mostrarMensaje('success', 'Contacto actualizado correctamente.');
    } catch (err) {
      console.error('Error actualizando contacto:', err);
      mostrarMensaje('error', 'No se pudo actualizar el contacto.');
    } finally {
      setGuardandoContacto(false);
    }
  }

  // Autollenado de cliente por RUC desde SUNAT.
  // Si el usuario ingresa un RUC de 11 dígitos y no existe en Firestore,
  // se ofrece crearlo automáticamente con los datos consultados a SUNAT.
  const { lookupRuc, datosRuc, cargando: rucCargando, error: rucError, limpiar: limpiarRucLookup } = useRucLookup();

  // Dispara la consulta cuando el texto del buscador es un RUC de 11 dígitos
  // y no hay cliente seleccionado
  useEffect(() => {
    if (clienteSeleccionado) return;
    const rucIngresado = busquedaCliente.replace(/\D/g, '');
    if (rucIngresado.length === 11) {
      // Verificar si ya existe un cliente con ese RUC
      const clienteExistente = clientes.find(c => c.ruc === rucIngresado);
      if (clienteExistente) {
        seleccionarCliente(clienteExistente);
      } else {
        lookupRuc(rucIngresado);
      }
    } else {
      limpiarRucLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaCliente]);

  // Crear un cliente nuevo en Firestore con los datos obtenidos de SUNAT
  // y seleccionarlo automáticamente para la cotización.
  // Permite al usuario añadir un contacto antes de crear el cliente.
  const [creandoClienteRuc, setCreandoClienteRuc] = useState(false);
  const [contactoNuevoRuc, setContactoNuevoRuc] = useState({ nombre: '', celular: '', email: '' });

  // Resetea el formulario de contacto cuando llega un nuevo RUC
  useEffect(() => {
    if (datosRuc) {
      setContactoNuevoRuc({ nombre: '', celular: '', email: '' });
    }
  }, [datosRuc]);

  async function crearClienteDesdeRuc() {
    if (!datosRuc) return;

    // Validar que el contacto tenga al menos nombre (obligatorio)
    const nombreContacto = contactoNuevoRuc.nombre.trim();
    if (!nombreContacto) {
      mostrarMensaje('error', 'Debe ingresar al menos el nombre del contacto antes de crear el cliente.');
      return;
    }

    setCreandoClienteRuc(true);
    try {
      // El contacto es obligatorio: siempre se incluye uno
      const contactoLimpio = [{
        nombre: nombreContacto,
        celular: contactoNuevoRuc.celular.trim(),
        email: contactoNuevoRuc.email.trim(),
      }];

      const nuevoCliente = {
        razonSocial: datosRuc.razonSocial,
        ruc: datosRuc.ruc,
        direccion: datosRuc.direccion || '',
        contactos: contactoLimpio,
        // Campos legacy para compatibilidad
        contacto: contactoLimpio[0]?.nombre || '',
        telefono: contactoLimpio[0]?.celular || '',
        email: contactoLimpio[0]?.email || '',
        createdAt: new Date().toISOString(),
      };
      const nuevoId = await addCliente(nuevoCliente);
      await addLog({
        usuario: responsable,
        accion: 'crear_cliente_autoruc',
        detalle: `${datosRuc.ruc} - ${datosRuc.razonSocial}`,
      });
      // Seleccionar el cliente recién creado.
      // addCliente retorna el id (string) directamente, no un objeto.
      const clienteCreado = { ...nuevoCliente, id: nuevoId };
      seleccionarCliente(clienteCreado);
      setBusquedaCliente(datosRuc.razonSocial);
      limpiarRucLookup();
      setContactoNuevoRuc({ nombre: '', celular: '', email: '' });
    } catch (err) {
      console.error('Error creando cliente desde RUC:', err);
      mostrarMensaje('error', 'Error al crear cliente: ' + err.message);
    } finally {
      setCreandoClienteRuc(false);
    }
  }

  function validarFormulario() {
    const errores = {};
    if (!form.clienteId) errores.clienteId = 'Seleccione un cliente';

    form.items.forEach((item, i) => {
      if (!item.descripcion) errores[`item_${i}_descripcion`] = 'Descripción requerida';
      if (!item.cantidad || item.cantidad <= 0) errores[`item_${i}_cantidad`] = 'Cantidad inválida';
      if (!item.precioUnitario || item.precioUnitario <= 0) errores[`item_${i}_precio`] = 'Precio inválido';
      if (item.tipo !== 'transporte' && (item.tiempoEntregaNumero === '' || item.tiempoEntregaNumero === undefined || item.tiempoEntregaNumero === null || Number(item.tiempoEntregaNumero) <= 0)) {
        errores[`item_${i}_entrega`] = 'Elija el tiempo de entrega (OC)';
      }
    });

    setErroresForm(errores);
    return Object.keys(errores).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validarFormulario()) return;

    setGuardando(true);
    try {
      const cliente = clientes.find((c) => c.id === form.clienteId);
      const subtotal = calcularSubtotal(form.items);
      const igv = form.sinIGV ? 0 : calcularIGV(subtotal);
      const total = form.sinIGV ? subtotal : calcularTotal(subtotal);

      const clienteContactos = obtenerContactosCliente(cliente);
      let contactoSeleccionado = null;
      if (clienteContactos.length > 0) {
        const idx = form.contactoClienteId !== '' ? Number(form.contactoClienteId) : 0;
        contactoSeleccionado = clienteContactos[idx] || clienteContactos[0];
      }

      const data = {
        clienteId: form.clienteId,
        cliente: {
          razonSocial: cliente?.razonSocial || '',
          ruc: cliente?.ruc || '',
          direccion: cliente?.direccion || '',
          telefono: contactoSeleccionado?.celular || cliente?.telefono || '',
          celular: contactoSeleccionado?.celular || cliente?.telefono || '',
          email: contactoSeleccionado?.email || cliente?.email || '',
          contacto: contactoSeleccionado?.nombre || cliente?.contacto || '',
          contactos: clienteContactos
        },
        responsable,
        cargoResponsable,
        emailResponsable,
        telefonoResponsable,
        contactoSeleccionado,
        condicionPago: form.condicionPago,
        validez: `${form.validezNumero} días`,
        tiempoEntregaNumero: Number(form.tiempoEntregaNumero) || 0,
        tiempoEntregaUnidad: form.tiempoEntregaUnidad || 'semanas',
        tiempoEntrega: `${form.tiempoEntregaNumero} ${form.tiempoEntregaUnidad} recibida la OC`,
        tipoItem: form.tipoItem || 'equipo',
        items: form.items.map((item) => ({
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidadMedida: item.unidadMedida || 'UNIDAD',
          precioUnitario: Number(item.precioUnitario),
          diametro: item.diametro || '',
          longitud: item.longitud || '',
          material: item.material || '',
          tipoAcople: item.tipoAcople || '',
          tiempoEntrega: item.tiempoEntrega || '',
          tiempoEntregaNumero: item.tiempoEntregaNumero || '',
          tiempoEntregaUnidad: item.tiempoEntregaUnidad || '',
          esAccesorio: !!item.esAccesorio,
          tipo: item.tipo || 'producto'
        })),
        subtotal, igv, total,
        sinIGV: !!form.sinIGV,
        estado: form.estado,
        fechaEmision: formatDateISO(),
        fecha: formatDateISO(),
        moneda: form.moneda || 'US$'
      };

      if (editandoId) {
        await editCotizacion(editandoId, data);
        await addLog({ usuario: responsable, accion: 'editar_cotizacion', detalle: data.codigo || editandoId });
      } else {
        const result = await addCotizacion(data);
        await addLog({ usuario: responsable, accion: 'crear_cotizacion', detalle: result.codigo || '' });
      }
      setMostrarModal(false);
    } catch (err) {
      console.error('Error guardando cotización:', err);
      mostrarMensaje('error', 'Error al guardar cotización: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ============================================================
  // DETECCIÓN DE TIPO DE ITEM (EQUIPO vs MANGA)
  // ============================================================
  // Las cotizaciones viejas creadas antes de añadir el campo `tipoItem`
  // no tienen ese campo guardado en Firestore. Para que el PDF correcto
  // se genere igual, detectamos el tipo automáticamente basándonos en
  // los campos de los items:
  //   - Si algún item tiene `diametro`, `longitud`, `material` o `tipoAcople`
  //     → es manga.
  //   - Si no → es equipo (default).
  // Las cotizaciones nuevas con `tipoItem` explícito usan ese valor directo.
  function detectarTipoItem(cot) {
    if (cot.tipoItem) return cot.tipoItem;
    const items = cot.items || [];
    if (items.length === 0) return 'equipo';
    const tieneCampoManga = items.some((it) =>
      Boolean(it.diametro || it.longitud || it.material || it.tipoAcople)
    );
    return tieneCampoManga ? 'manga' : 'equipo';
  }

  async function exportarPDF(cot) {
    try {
      const c = config || (await refreshConfig());
      const tipoDetectado = detectarTipoItem(cot);
      console.log('[PDF] Cotización', cot.codigo, '→ tipoItem detectado:', tipoDetectado, '(guardado:', cot.tipoItem || 'null', ')');

      if (tipoDetectado === 'manga') {
        const modManga = await import('../utils/generateMangaPDF');
        const downloader = modManga.downloadMangaPDF;
        downloader(cot, c);
        mostrarMensaje('success', `Generando PDF de MANGAS para la cotización ${cot.codigo || ''}`);
      } else {
        const mod = await import('../utils/generatePDF');
        const downloader = mod.downloadCotizacionPDF;
        downloader(cot, c);
        mostrarMensaje('success', `Generando PDF de EQUIPOS para la cotización ${cot.codigo || ''}`);
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      mostrarMensaje('error', 'Error al generar PDF: ' + err.message);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeCotizacion(eliminarId);
      await addLog({ usuario: responsable, accion: 'eliminar_cotizacion' });
      setMostrarConfirm(false);
      setEliminarId(null);
    } catch (err) {
      console.error('Error eliminando cotización:', err);
      mostrarMensaje('error', 'Error al eliminar cotización');
    }
  }

  const subtotal = calcularSubtotal(form.items);
  const igv = form.sinIGV ? 0 : calcularIGV(subtotal);
  const total = form.sinIGV ? subtotal : calcularTotal(subtotal);

  if (loading) return <Loading message="Cargando cotizaciones..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Cotizaciones</h1>
          <p className="pagina-subtitle">
            {cotizaciones.length} cotizaciones registradas • {pendientesCount} pendientes
          </p>
        </div>
        <button className="btn-principal" onClick={nuevaCotizacion}>
          <FiPlus size={16} /> Nueva Cotización
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por código, cliente o responsable..."
            value={terminoBusqueda}
            onChange={(e) => alCambiarBusqueda(e.target.value)}
          />
        </div>
        <select
          className="selector-filtro"
          value={filtroEstado}
          onChange={(e) => alCambiarEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <div className="tarjeta-tabla">
        {cotizacionesFiltradas.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron cotizaciones</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={cotizacionesFiltradas.length}
              paginaActual={paginaActual}
              porPagina={porPagina}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={setPorPagina}
            />
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="texto-centro">Tipo</th>
                    <th>Responsable</th>
                    <th>Cond. Pago</th>
                    <th className="texto-derecha">Total</th>
                    <th className="texto-centro">
                      Estado
                      <span className="info-icon" title="El estado se actualiza automáticamente desde SUNAT">i</span>
                    </th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacionesPaginadas.map((cot) => {
                    const tipoCot = detectarTipoItem(cot);
                    return (
                    <tr key={cot.id} className={COLOR_FILA_ESTADO[cot.estado] || ''}>
                      <td className="texto-codigo">{cot.codigo}</td>
                      <td>{formatDate(cot.fecha || cot.fechaEmision || cot.createdAt)}</td>
                      <td>{cot.cliente?.razonSocial || '-'}</td>
                      <td className="texto-centro">
                        <span
                          className={`badge-tipo-cotizacion badge-tipo-${tipoCot}`}
                          title={cot.tipoItem ? 'Tipo guardado al crear' : 'Tipo detectado automáticamente'}
                        >
                          {tipoCot === 'manga' ? 'Manga' : 'Equipo'}
                        </span>
                      </td>
                      <td>{cot.responsable || '-'}</td>
                      <td>{cot.condicionPago || '-'}</td>
                      <td className="texto-derecha texto-negrita">{formatMoneda(cot.total || 0, cot.moneda)}</td>
                      <td className="texto-centro">
                        <span
                          className={`badge-estado-sunat estado-${(cot.estado || 'Generada').toLowerCase()}`}
                          title={(cot.estado === 'Error' || cot.estado === 'Cancelada' || cot.estado === 'Rechazada') && cot.motivoRechazoSunat ? `Motivo: ${cot.motivoRechazoSunat}` : 'Estado de la cotización'}
                        >
                          {cot.estado || 'Generada'}
                        </span>
                        {(cot.estado === 'Error' || cot.estado === 'Cancelada' || cot.estado === 'Rechazada') && cot.motivoRechazoSunat && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#c0392b',
                              marginTop: '4px',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontStyle: 'italic',
                            }}
                            title={cot.motivoRechazoSunat}
                          >
                            {cot.motivoRechazoSunat}
                          </div>
                        )}
                      </td>
                      <td className="texto-centro">
                        <div className="acciones-tabla">
                          {!cot.ordenCompraId && (
                            <button
                              className="btn-accion"
                              onClick={() => navigate('/compras', { state: { cotizacionOrigen: cot } })}
                              title="Generar orden de compra y marcar cotización como aceptada"
                            >
                              <FiShoppingCart size={18} />
                            </button>
                          )}
                          <button className="btn-accion" onClick={() => exportarPDF(cot)} title={`Exportar PDF (${tipoCot === 'manga' ? 'Manga' : 'Equipo'})`}>
                            <FiDownload size={18} />
                          </button>
                          <button className="btn-accion" onClick={() => editarCotizacion(cot)} title="Editar">
                            <FiEdit2 size={18} />
                          </button>
                          <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminar(cot.id)} title="Eliminar">
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={mostrarModal}
        onClose={() => setMostrarModal(false)}
        title={editandoId ? 'Editar Cotización' : 'Nueva Cotización'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="formulario formulario-compacto">
          {/* Cliente */}
          <div className="fila-form">
            <div className="campo campo-cliente-busqueda">
              <label>Cliente *</label>
              {clienteSeleccionado ? (
                <div className="cliente-seleccionado">
                  <div className="cliente-info">
                    <span className="cliente-nombre">{clienteSeleccionado.razonSocial}</span>
                    <span className="cliente-ruc">RUC: {clienteSeleccionado.ruc}</span>
                    {clienteSeleccionado.direccion && (
                      <span className="cliente-direccion">{clienteSeleccionado.direccion}</span>
                    )}
                  </div>
                  <button type="button" className="btn-limpiar-cliente" onClick={limpiarCliente} title="Cambiar cliente">
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div className="buscador-cliente">
                  <FiSearch className="icono-busqueda-cliente" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o RUC..."
                    value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); setClienteDropdownAbierto(true); }}
                    onFocus={() => setClienteDropdownAbierto(true)}
                    onBlur={() => setTimeout(() => setClienteDropdownAbierto(false), 180)}
                    className={erroresForm.clienteId ? 'input-error' : ''}
                    autoComplete="off"
                  />
                  {clienteDropdownAbierto && clientesFiltrados.length > 0 && (
                    <div className="lista-resultados-clientes">
                      {clientesFiltrados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="resultado-cliente"
                          onMouseDown={(e) => { e.preventDefault(); seleccionarCliente(c); }}
                        >
                          <span className="resultado-nombre">{c.razonSocial}</span>
                          <span className="resultado-ruc">RUC: {c.ruc}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Panel de autollenado por RUC cuando no existe el cliente en Firestore */}
                  {rucCargando && (
                    <div className="lista-resultados-clientes ruc-buscando-panel">
                      <div className="resultado-cliente ruc-buscando">
                        <FiLoader className="ruc-spinner-mini" size={14} />
                        <span>Consultando RUC en SUNAT...</span>
                      </div>
                    </div>
                  )}

                  {!rucCargando && rucError && busquedaCliente.replace(/\D/g, '').length === 11 && (
                    <div className="lista-resultados-clientes ruc-error-panel">
                      <div className="resultado-cliente ruc-error">
                        <div className="ruc-datos-encontrados">
                          <span className="resultado-nombre">Servicios de consulta externa están fuera de línea</span>
                          <span className="resultado-ruc">
                            No se pudo obtener la información del RUC automáticamente.
                          </span>
                          <span className="resultado-ruc ruc-direccion-line">
                            Por favor ingrese los datos del cliente manualmente abajo, o intente nuevamente más tarde.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!rucCargando && datosRuc && !clienteSeleccionado && (
                    <div className="lista-resultados-clientes ruc-resultado-panel">
                      <div className="resultado-cliente ruc-resultado">
                        <div className="ruc-datos-encontrados">
                          <span className="resultado-nombre">{datosRuc.razonSocial}</span>
                          <span className="resultado-ruc">RUC: {datosRuc.ruc}</span>
                          {datosRuc.direccion && (
                            <span className="resultado-ruc ruc-direccion-line">{datosRuc.direccion}</span>
                          )}
                          <span className="ruc-fuente">Fuente: SUNAT · Cliente nuevo</span>

                          {/* Formulario de contacto obligatorio antes de crear */}
                          <div className="ruc-contacto-form">
                            <span className="ruc-contacto-label">Contacto del cliente *:</span>
                            <div className="ruc-contacto-campos">
                              <input
                                type="text"
                                placeholder="Nombre *"
                                value={contactoNuevoRuc.nombre}
                                onChange={(e) => setContactoNuevoRuc(prev => ({ ...prev, nombre: e.target.value }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`ruc-contacto-input ${!contactoNuevoRuc.nombre.trim() ? 'ruc-contacto-input-error' : ''}`}
                              />
                              <input
                                type="text"
                                placeholder="Celular"
                                value={contactoNuevoRuc.celular}
                                onChange={(e) => setContactoNuevoRuc(prev => ({ ...prev, celular: e.target.value }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="ruc-contacto-input"
                              />
                              <input
                                type="email"
                                placeholder="Email"
                                value={contactoNuevoRuc.email}
                                onChange={(e) => setContactoNuevoRuc(prev => ({ ...prev, email: e.target.value }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="ruc-contacto-input"
                              />
                            </div>
                            {!contactoNuevoRuc.nombre.trim() && (
                              <span className="ruc-contacto-hint">El nombre del contacto es obligatorio para crear el cliente.</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-crear-cliente-ruc"
                          onMouseDown={(e) => { e.preventDefault(); crearClienteDesdeRuc(); }}
                          disabled={creandoClienteRuc || !contactoNuevoRuc.nombre.trim()}
                        >
                          {creandoClienteRuc ? (
                            <><FiLoader className="ruc-spinner-mini" size={14} /> Creando...</>
                          ) : (
                            <><FiUserPlus size={14} /> Crear y seleccionar</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {erroresForm.clienteId && <span className="mensaje-error">{erroresForm.clienteId}</span>}
            </div>
            <div className="campo">
              <label>Responsable</label>
              <input type="text" value={responsable} readOnly className="input-solo-lectura" />
            </div>
          </div>

          {/* Contacto */}
          {clienteSeleccionado && contactosCliente.length > 0 && (
            <div className="campo campo-cliente-busqueda">
              <label>Contacto del Cliente {contactosCliente.length > 1 && `(${contactosCliente.length} disponibles)`}</label>
              {form.contactoClienteId !== '' ? (
                editandoContacto ? (
                  <div className="cliente-seleccionado contacto-edicion">
                    <div className="ruc-contacto-campos">
                      <input
                        type="text"
                        placeholder="Nombre *"
                        value={contactoEditForm.nombre}
                        onChange={(e) => setContactoEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                        className={`ruc-contacto-input ${!contactoEditForm.nombre.trim() ? 'ruc-contacto-input-error' : ''}`}
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Celular"
                        value={contactoEditForm.celular}
                        onChange={(e) => setContactoEditForm((prev) => ({ ...prev, celular: e.target.value }))}
                        className="ruc-contacto-input"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={contactoEditForm.email}
                        onChange={(e) => setContactoEditForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="ruc-contacto-input"
                      />
                    </div>
                    <div className="acciones-form" style={{ marginTop: 6 }}>
                      <button type="button" className="btn-secundario btn-pequeno" onClick={cerrarEdicionContacto} disabled={guardandoContacto}>
                        Cancelar
                      </button>
                      <button type="button" className="btn-principal btn-pequeno" onClick={guardarContactoEditado} disabled={guardandoContacto}>
                        {guardandoContacto ? 'Guardando...' : 'Guardar contacto'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cliente-seleccionado">
                    <div className="cliente-info">
                      {(() => {
                        const ct = contactosCliente[Number(form.contactoClienteId)];
                        return ct ? (
                          <>
                            <span className="cliente-nombre">{ct.nombre || '(sin nombre)'}</span>
                            {ct.celular && <span className="cliente-ruc">{ct.celular}</span>}
                            {ct.email && <span className="cliente-ruc">{ct.email}</span>}
                          </>
                        ) : null;
                      })()}
                    </div>
                    <div className="acciones-contacto">
                      <button type="button" className="btn-limpiar-cliente"
                        onClick={abrirEdicionContacto}
                        title="Editar contacto"><FiEdit2 size={16} /></button>
                      <button type="button" className="btn-limpiar-cliente"
                        onClick={() => { handleChange('contactoClienteId', ''); setBusquedaContacto(''); setContactoDropdownAbierto(false); }}
                        title="Cambiar contacto"><FiX size={16} /></button>
                    </div>
                  </div>
                )
              ) : (
                <div className="buscador-cliente">
                  <FiSearch className="icono-busqueda-cliente" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar contacto..."
                    value={busquedaContacto}
                    onChange={(e) => { setBusquedaContacto(e.target.value); setContactoDropdownAbierto(true); }}
                    onFocus={() => setContactoDropdownAbierto(true)}
                    onBlur={() => setTimeout(() => setContactoDropdownAbierto(false), 180)}
                    autoComplete="off"
                  />
                  {contactoDropdownAbierto && contactosFiltrados.length > 0 && (
                    <div className="lista-resultados-clientes">
                      {contactosFiltrados.map((ct) => {
                        const realIdx = contactosCliente.indexOf(ct);
                        return (
                          <button key={realIdx} type="button" className="resultado-cliente"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleChange('contactoClienteId', String(realIdx));
                              setBusquedaContacto('');
                              setContactoDropdownAbierto(false);
                            }}>
                            <span className="resultado-nombre">{ct.nombre || '(sin nombre)'}</span>
                            <span className="resultado-ruc">{[ct.celular, ct.email].filter(Boolean).join(' · ')}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Condición, Validez, Moneda */}
          <div className="fila-form fila-form-3">
            <div className="campo">
              <label>Condición de Pago</label>
              <select value={form.condicionPago} onChange={(e) => handleChange('condicionPago', e.target.value)}>
                {CONDICIONES_PAGO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Validez</label>
              <div className="input-con-sufijo">
                <input
                  type="number"
                  value={form.validezNumero}
                  onChange={(e) => handleChange('validezNumero', e.target.value === '' ? '' : Number(e.target.value))}
                  min="1"
                  placeholder="15"
                  className="input-numero"
                />
                <span className="sufijo-input">días</span>
              </div>
            </div>
            <div className="campo">
              <label>Moneda</label>
              <select value={form.moneda} onChange={(e) => handleChange('moneda', e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo de item — fila propia */}
          <div className="fila-form fila-form-1">
            <div className="campo">
              <label>Tipo de item</label>
              <select
                value={form.tipoItem}
                onChange={(e) => handleChange('tipoItem', e.target.value)}
                className="selector-tipo-item"
              >
                <option value="equipo">Equipos</option>
                <option value="manga">Mangas de ventilación</option>
              </select>
            </div>
          </div>

          {import.meta.env.DEV && editandoId && (
            <div className="fila-form fila-form-1">
              <div className="campo">
                <label>Estado de cotización · pruebas</label>
                <select value={form.estado} onChange={(e) => handleChange('estado', e.target.value)}>
                  {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
                <span className="pista-form">
                  Solo aparece con <code>npm run dev</code>. Permite volver de Aceptada a Generada para pruebas sin modificar la relación histórica con una OC existente.
                </span>
              </div>
            </div>
          )}

          <div className="fila-form fila-form-1">
            <label className="checkbox-sin-igv">
              <input
                type="checkbox"
                checked={!!form.sinIGV}
                onChange={(e) => handleChange('sinIGV', e.target.checked)}
              />
              Calcular sin IGV (algunas empresas no lo aplican)
            </label>
          </div>

          {/* Items */}
          <div className="items-seccion">
            <div className="items-header">
              <h3 className="items-titulo">{form.tipoItem === 'manga' ? 'Mangas / Accesorios' : 'Equipos / Items'}</h3>
              <div className="items-header-botones">
                <button type="button" className="btn-secundario btn-pequeno" onClick={() => agregarItem('producto')}>
                  <FiPlus size={14} /> Agregar Item
                </button>
                {form.tipoItem === 'manga' && (
                  <button type="button" className="btn-secundario btn-pequeno" onClick={() => agregarItem('accesorio')}>
                    <FiPlus size={14} /> Agregar Accesorio
                  </button>
                )}
                <button type="button" className="btn-secundario btn-pequeno" onClick={() => agregarItem('transporte')}>
                  <FiPlus size={14} /> Agregar Transporte
                </button>
              </div>
            </div>

            <div className="items-tabla-wrapper">
              <table className="items-tabla">
                <thead>
                  <tr>
                    <th className="col-codigo">Código</th>
                    <th className="col-select">Buscar {form.tipoItem === 'manga' ? 'Manga' : 'Equipo'}</th>
                    <th className="col-desc">Descripción</th>
                    <th className="col-cant">{form.tipoItem === 'manga' ? 'Cantidad (metros)' : 'Cant.'}</th>
                    <th className="col-unidad">Unidad</th>
                    <th className="col-precio">{form.tipoItem === 'manga' ? 'Precio Lineal' : 'Precio Unit.'}</th>
                    <th className="col-subtotal">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => {
                    const colSpanFila = 8;
                    const numeroEnGrupo = form.items
                      .slice(0, index + 1)
                      .filter((it) => it.tipo === item.tipo).length;
                    const etiquetaTipo = item.tipo === 'accesorio'
                      ? `Accesorio #${numeroEnGrupo}`
                      : item.tipo === 'transporte'
                        ? `Transporte #${numeroEnGrupo}`
                        : (form.tipoItem === 'manga' ? `Manga #${numeroEnGrupo}` : `Equipo #${numeroEnGrupo}`);
                    return (
                    <Fragment key={index}>
                    <tr className={`fila-badge-tipo ${item.tipo === 'accesorio' ? 'badge-accesorio' : item.tipo === 'transporte' ? 'badge-transporte' : 'badge-producto'}`}>
                      <td colSpan={colSpanFila}>
                        <div className="fila-badge-contenido">
                          <span className="badge-tipo-item">{etiquetaTipo}</span>
                          <button
                            type="button"
                            className="btn-quitar-item-general"
                            onClick={() => quitarItem(index)}
                            disabled={form.items.length <= 1}
                            title="Eliminar este item completo"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="input-con-cargando">
                          <input
                            type="text"
                            value={item.codigo}
                            onChange={(e) => cambiarItem(index, 'codigo', e.target.value)}
                            onBlur={(e) => e.target.value && buscarEquipoPorCodigo(index, e.target.value)}
                            placeholder={item.tipo === 'transporte' ? 'Ej: 6000 0001' : 'Código'}
                            className={buscandoCodigo[index] ? 'input-cargando' : ''}
                          />
                          {buscandoCodigo[index] && <span className="spinner-inline"></span>}
                        </div>
                      </td>
                      <td>
                        {item.tipo === 'transporte' ? (
                          <span className="cliente-ruc">— servicio —</span>
                        ) : (
                          <EquipoCombobox
                            equipos={form.tipoItem === 'manga' ? mangas : equipos}
                            value={item.equipoId || ''}
                            onSelect={(equipoId) => {
                              if (equipoId) {
                                seleccionarEquipo(index, equipoId);
                              } else {
                                cambiarItem(index, 'equipoId', '');
                              }
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => cambiarItem(index, 'descripcion', e.target.value)}
                          placeholder={item.tipo === 'transporte' ? 'Ej: Transporte a obra' : (item.tipo === 'accesorio' ? 'Ej: Codo, Conector tipo Y' : 'Descripción')}
                          className={erroresForm[`item_${index}_descripcion`] ? 'input-error' : ''}
                        />
                        {erroresForm[`item_${index}_descripcion`] && (
                          <span className="mensaje-error">{erroresForm[`item_${index}_descripcion`]}</span>
                        )}
                      </td>
                      <td>
                        <div className="cantidad-con-sufijo">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => cambiarItem(index, 'cantidad', e.target.value)}
                            min="1"
                            className={`input-centro input-sin-flechas ${erroresForm[`item_${index}_cantidad`] ? 'input-error' : ''}`}
                          />
                          {form.tipoItem === 'manga' && item.tipo === 'producto' && <span className="cantidad-sufijo">m</span>}
                          {item.tipo === 'accesorio' && <span className="cantidad-sufijo">pza</span>}
                        </div>
                      </td>
                      <td>
                        <select
                          value={item.unidadMedida || 'UNIDAD'}
                          onChange={(e) => cambiarItem(index, 'unidadMedida', e.target.value)}
                        >
                          {UNIDADES_MEDIDA.map((unidad) => (
                            <option key={unidad} value={unidad}>{unidad}</option>
                          ))}
                          {item.tipo === 'transporte' && <option value="SERVICIO">SERVICIO</option>}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.precioUnitario}
                          onChange={(e) => cambiarItem(index, 'precioUnitario', e.target.value)}
                          min="0"
                          step="0.01"
                          className={`input-derecha ${erroresForm[`item_${index}_precio`] ? 'input-error' : ''}`}
                        />
                      </td>
                      <td className="texto-derecha texto-negrita">
                        {formatMoneda((Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), form.moneda)}
                      </td>
                      <td></td>
                    </tr>
                    {form.tipoItem === 'manga' && (item.tipo === 'producto' || item.tipo === 'accesorio') && (
                      <tr className="fila-specs-manga">
                        <td colSpan={colSpanFila}>
                          <div className="specs-manga-fila">
                            <label className="spec-campo">
                              Diámetro (plg)
                              <input
                                type="text"
                                value={item.diametro || ''}
                                onChange={(e) => cambiarItem(index, 'diametro', e.target.value)}
                                placeholder="Ej: 36"
                                className="input-centro"
                              />
                            </label>
                            <label className="spec-campo">
                              {(() => {
                                const val = String(item.longitud || '');
                                const esEstandar = val === '15' || val === '20';
                                return esEstandar ? 'Longitud estándar' : 'Longitud';
                              })()}
                              {(() => {
                                const val = String(item.longitud || '');
                                const esEstandar = val === '15' || val === '20';
                                const modoActual = item.longitudModo || (esEstandar ? val : (val ? 'otro' : '15'));
                                return (
                                  <div className="longitud-selector">
                                    <select
                                      value={modoActual === 'otro' ? 'otro' : modoActual}
                                      onChange={(e) => {
                                        const sel = e.target.value;
                                        if (sel === 'otro') {
                                          cambiarItem(index, 'longitudModo', 'otro');
                                        } else {
                                          cambiarItem(index, 'longitudModo', sel);
                                          cambiarItem(index, 'longitud', sel);
                                        }
                                      }}
                                      className="input-centro"
                                    >
                                      <option value="15">15 m (estándar)</option>
                                      <option value="20">20 m (estándar)</option>
                                      <option value="otro">Otro...</option>
                                    </select>
                                    {modoActual === 'otro' && (
                                      <input
                                        type="text"
                                        value={item.longitud || ''}
                                        onChange={(e) => cambiarItem(index, 'longitud', e.target.value)}
                                        placeholder="Ej: 25 m"
                                        className="input-centro"
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                            </label>
                            <label className="spec-campo">
                              Material
                              <span className="cliente-ruc">{item.material || '—'}</span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                    {item.tipo !== 'transporte' && (
                      <tr className="fila-entrega-oc">
                        <td colSpan={colSpanFila}>
                          <div className="entrega-oc-label">
                            Tiempo de entrega (OC) de este ítem:
                            <div className={`tiempo-entrega-contenedor ${erroresForm[`item_${index}_entrega`] ? 'tiempo-entrega-error' : ''}`}>
                              <div className="tiempo-entrega-spinner">
                                <button
                                  type="button"
                                  className="spinner-btn"
                                  onClick={() => cambiarEntregaItem(index, Math.max(1, (Number(item.tiempoEntregaNumero) || 1) - 1), item.tiempoEntregaUnidad || 'días')}
                                  aria-label="Disminuir"
                                >−</button>
                                <input
                                  type="number"
                                  value={item.tiempoEntregaNumero ?? ''}
                                  onChange={(e) => cambiarEntregaItem(index, e.target.value, item.tiempoEntregaUnidad || 'días')}
                                  min="1"
                                  step="1"
                                  className="input-numero"
                                />
                                <button
                                  type="button"
                                  className="spinner-btn"
                                  onClick={() => cambiarEntregaItem(index, (Number(item.tiempoEntregaNumero) || 1) + 1, item.tiempoEntregaUnidad || 'días')}
                                  aria-label="Aumentar"
                                >+</button>
                              </div>
                              <select
                                className="tiempo-entrega-unidad"
                                value={item.tiempoEntregaUnidad || 'días'}
                                onChange={(e) => cambiarEntregaItem(index, item.tiempoEntregaNumero || 1, e.target.value)}
                              >
                                {UNIDADES_TIEMPO.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                              <span className="tiempo-entrega-sufijo">recibida la OC</span>
                            </div>
                            {erroresForm[`item_${index}_entrega`] && (
                              <span className="mensaje-error">{erroresForm[`item_${index}_entrega`]}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="totales-seccion">
              <div className="totales-grid">
                <div className="total-fila">
                  <span>Subtotal:</span>
                  <span className="total-valor">{formatMoneda(subtotal, form.moneda)}</span>
                </div>
                {!form.sinIGV && (
                  <div className="total-fila">
                    <span>IGV (18%):</span>
                    <span className="total-valor">{formatMoneda(igv, form.moneda)}</span>
                  </div>
                )}
                <div className="total-fila total-final">
                  <span>Total:</span>
                  <span className="total-valor total-monto">{formatMoneda(total, form.moneda)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sección INCLUYE (fija, se muestra en el PDF de la cotización) */}
          <div className="campo">
            <label>Incluye</label>
            <ul className="incluye-lista">
              <li>Protocolo de calibración de fábrica</li>
              <li>Garantía oficial Testo</li>
              <li>Soporte técnico postventa</li>
            </ul>
          </div>

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setMostrarModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Actualizar Cotización' : 'Crear Cotización'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirm}
        onClose={() => setMostrarConfirm(false)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar cotización?"
        message="Esta acción eliminará la cotización permanentemente. ¿Está seguro?"
      />
    </div>
  );
}
