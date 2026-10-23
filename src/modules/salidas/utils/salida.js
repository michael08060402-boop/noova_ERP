export const MOTIVOS_SALIDA = [
  { id: 'mantenimiento', label: 'Mantenimiento y/o reparación' },
  { id: 'prestamo', label: 'Préstamo / alquiler' },
  { id: 'devolucion', label: 'Devolución' },
  { id: 'propiedad', label: 'Por ser de su propiedad' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'despacho', label: 'Despacho' },
  { id: 'trabajo', label: 'Realizar un trabajo' },
  { id: 'otros', label: 'Otros (explicar)' }
];

export const CONTROLES = [
  { id: 'salida', titulo: 'CONTROL DE SALIDA' },
  { id: 'ingreso', titulo: 'CONTROL DE INGRESO' }
];

export const ESTADOS_BIEN = ['Enviado', 'Recibido', 'Devuelto', 'Observado'];

export const CONTENEDORES = ['Caja', 'Maleta'];

export const SIN_DATO = 'N/A';

export const FIRMAS_CONTROL = [
  { id: 'solicita', titulo: 'SOLICITADO POR:' },
  { id: 'autoriza', titulo: 'AUTORIZADO POR:' }
];

let contador = 0;

function nuevoId() {
  contador += 1;
  return `it-${Date.now().toString(36)}-${contador}`;
}

export function crearItemSalida(datos = {}) {
  return {
    descripcion: '',
    contenedor: CONTENEDORES[0],
    marca: '',
    serie: '',
    cantidad: '',
    unidad: '',
    tipo: '',
    estado: ESTADOS_BIEN[0],
    origen: 'manual',
    ...datos,
    id: datos.id || nuevoId()
  };
}

function crearFirmaVacia() {
  return { nombre: '', fecha: '', hora: '' };
}

function crearFormatoVacio() {
  return {
    correlativo: '',
    paquete: '1',
    dependencia: 'NOOVA S.A.C.',
    lugar: '',
    fechaSalida: '',
    fechaIngreso: '',
    destino: '',
    personaAutorizada: '',
    jefeAutoriza: '',
    motivo: 'trabajo',
    observacion: '',
    salida: { solicita: crearFirmaVacia(), autoriza: crearFirmaVacia() },
    ingreso: { solicita: crearFirmaVacia(), autoriza: crearFirmaVacia() }
  };
}

export function crearSalida({ guia = {}, formato = {}, items = [], origen = 'manual', documento = null } = {}) {
  return {
    guia: { tipo: '09', serie: '', numero: '', ...guia },
    formato: { ...crearFormatoVacio(), ...formato },
    items: items.map((item) => crearItemSalida(item)),
    origen,
    documento,
    estado: 'pendiente'
  };
}

const MOTIVOS_SUNAT = [
  { patron: /VENTA/, motivo: 'despacho' },
  { patron: /ESTABLECIMIENTOS DE LA MISMA EMPRESA/, motivo: 'transferencia' },
  { patron: /DEVOLUCI[OÓ]N/, motivo: 'devolucion' },
  { patron: /CONSIGNACI[OÓ]N|PR[EÉ]STAMO|ALQUILER/, motivo: 'prestamo' },
  { patron: /REPARACI[OÓ]N|MANTENIMIENTO/, motivo: 'mantenimiento' }
];

export function motivoDesdeGuia(guia) {
  const texto = `${guia?.motivoTraslado || ''} ${guia?.descripcionMotivo || ''}`.toUpperCase();
  return MOTIVOS_SUNAT.find((m) => m.patron.test(texto))?.motivo || 'trabajo';
}

export function destinoDesdeGuia(guia) {
  const proyecto = String(guia?.descripcionMotivo || '').replace(/^TRASLADO\s+(A\s+)?/i, '').trim();
  const destinatario = String(guia?.destinatarioNombre || '').trim();
  if (!proyecto && !destinatario) return guia?.puntoLlegada || '';
  return [proyecto && 'PROYECTO', proyecto, destinatario].filter(Boolean).join(' - ');
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatoDesdeGuia(guia, { correlativo = '', persona = '', solicitante = '', autorizador = '' } = {}) {
  const fecha = guia.fechaTraslado || guia.fechaEmision || hoy();
  const hora = guia.horaEmision || horaActual();
  return {
    correlativo,
    lugar: guia.puntoPartida || '',
    fechaSalida: fecha,
    destino: destinoDesdeGuia(guia),
    personaAutorizada: persona,
    jefeAutoriza: autorizador,
    motivo: motivoDesdeGuia(guia),
    salida: {
      solicita: { nombre: solicitante, fecha, hora },
      autoriza: { nombre: autorizador, fecha, hora }
    }
  };
}

function vacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

function rellenar(actual, sugerido) {
  const resultado = { ...sugerido };
  for (const [clave, valor] of Object.entries(actual || {})) {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) resultado[clave] = rellenar(valor, sugerido[clave] || {});
    else if (!vacio(valor)) resultado[clave] = valor;
  }
  return resultado;
}

export function completarSalida(salida, porDefecto = {}) {
  const sugerido = rellenar(formatoDesdeGuia(salida.guia || {}, porDefecto), crearFormatoVacio());
  return {
    ...salida,
    estado: salida.estado === 'exportado' ? 'exportado' : 'pendiente',
    formato: rellenar(salida.formato, sugerido),
    items: (salida.items || []).map((item) => crearItemSalida({
      ...item,
      contenedor: item.contenedor || CONTENEDORES[0],
      estado: item.estado || ESTADOS_BIEN[0]
    }))
  };
}

export function siguienteCorrelativo(salidas) {
  const numeros = salidas
    .map((s) => Number.parseInt(s.formato?.correlativo, 10))
    .filter(Number.isFinite);
  return numeros.length ? Math.max(...numeros) + 1 : 1;
}

function milisegundos(valor) {
  return valor?.toMillis?.() ?? (valor ? new Date(valor).getTime() : 0);
}

export function numerarSinCorrelativo(salidas, porDefecto = {}) {
  let siguiente = siguienteCorrelativo(salidas);
  return salidas
    .filter((s) => !Number.isInteger(Number.parseInt(s.formato?.correlativo, 10)))
    .sort((a, b) => milisegundos(a.creadoEn) - milisegundos(b.creadoEn))
    .map((s) => {
      const completa = completarSalida(s, porDefecto);
      completa.formato.correlativo = siguiente;
      siguiente += 1;
      return completa;
    });
}

export function separarNumeroGuia(texto) {
  const m = /^\s*([A-Z0-9]{4})\s*-\s*(\d{1,8})\s*$/i.exec(String(texto || ''));
  return m ? { serie: m[1].toUpperCase(), numero: String(Number(m[2])) } : null;
}

export function claveGuia(guia) {
  const serie = String(guia?.serie || '').trim().toUpperCase();
  const numero = Number.parseInt(String(guia?.numero || '').replace(/\D/g, ''), 10);
  if (!serie || !Number.isFinite(numero)) return '';
  return `${guia?.tipo || '09'}-${serie}-${numero}`;
}

export function formatearGuia(guia) {
  const serie = String(guia?.serie || '').trim().toUpperCase();
  const numero = String(guia?.numero || '').replace(/\D/g, '');
  if (!serie || !numero) return '';
  return `${serie}-${numero.padStart(8, '0')}`;
}

export function formatearCorrelativo(correlativo) {
  const n = Number.parseInt(correlativo, 10);
  return Number.isFinite(n) ? `N° ${String(n).padStart(4, '0')}` : '';
}

export function numeroCantidad(valor) {
  const n = Number(String(valor ?? '').replace(',', '.').trim());
  return String(valor ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
}

function filaVacia(item) {
  return ['descripcion', 'marca', 'serie', 'cantidad', 'unidad', 'tipo']
    .every((campo) => !String(item[campo] ?? '').trim());
}

export function itemsConDatos(items) {
  return (items || []).filter((item) => !filaVacia(item));
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validarSalida(salida) {
  const errores = {};
  const porItem = {};
  const { guia = {}, formato = {} } = salida || {};
  const items = itemsConDatos(salida?.items);

  if (!claveGuia(guia)) errores.guia = 'Escribe el N° de guía (ej. EG07-108).';
  const correlativo = Number(formato.correlativo);
  if (!Number.isInteger(correlativo) || correlativo < 1) errores.correlativo = 'Falta el N° del formato.';
  if (!FECHA_ISO.test(formato.fechaSalida || '')) errores.fechaSalida = 'Falta la fecha de salida.';
  if (!String(formato.destino || '').trim()) errores.destino = 'Falta el destino.';
  if (formato.motivo === 'otros' && !String(formato.observacion || '').trim()) errores.observacion = 'Explica el motivo "Otros".';
  if (!items.length) errores.items = 'Agrega al menos un bien.';

  const series = new Map();
  for (const item of items) {
    const problemas = [];
    const cantidad = numeroCantidad(item.cantidad);
    const serie = String(item.serie || '').trim().toUpperCase();
    if (!String(item.descripcion || '').trim()) problemas.push('descripcion');
    if (cantidad === null || cantidad <= 0) problemas.push('cantidad');
    if (!String(item.unidad || '').trim()) problemas.push('unidad');
    if (serie && cantidad !== null && cantidad !== 1) problemas.push('cantidad');
    if (serie && series.has(serie)) {
      problemas.push('serie');
      porItem[series.get(serie)] = [...new Set([...(porItem[series.get(serie)] || []), 'serie'])];
    } else if (serie) {
      series.set(serie, item.id);
    }
    if (problemas.length) porItem[item.id] = [...new Set([...(porItem[item.id] || []), ...problemas])];
  }
  if (Object.keys(porItem).length) {
    errores.items = 'Revisa las celdas en rojo: faltan datos, hay series repetidas o una fila con serie no tiene cantidad 1.';
  }

  return { valido: Object.keys(errores).length === 0, errores, porItem };
}
