export const TIPOS_BLOQUE = [
  { tipo: 'campos', label: 'Datos', descripcion: 'Etiqueta y valor: asunto, lugar, fechas, plazos…' },
  { tipo: 'tabla', label: 'Tabla de ítems', descripcion: 'Lo que se cotiza, con columnas configurables' },
  { tipo: 'lista', label: 'Lista', descripcion: 'Requisitos, documentos o condiciones' },
  { tipo: 'texto', label: 'Texto', descripcion: 'Alcance, descripción o notas libres' }
];

export const TIPOS_CAMPO = [
  { valor: 'texto', label: 'Texto' },
  { valor: 'textoLargo', label: 'Texto largo' },
  { valor: 'fecha', label: 'Fecha' },
  { valor: 'numero', label: 'Número' }
];

export const TIPOS_COLUMNA = [
  { valor: 'texto', label: 'Texto' },
  { valor: 'numero', label: 'Número' },
  { valor: 'unidad', label: 'Unidad' }
];

export const CAMPOS_AUTOMATICOS = [
  { auto: 'fecha', etiqueta: 'Fecha de Emisión' },
  { auto: 'solicitante', etiqueta: 'Solicitante' },
  { auto: 'empresa', etiqueta: 'Empresa' },
  { auto: 'ruc', etiqueta: 'RUC' },
  { auto: 'direccion', etiqueta: 'Dirección' },
  { auto: 'moneda', etiqueta: 'Tipo de Moneda' }
];

export const MONEDAS = [
  { codigo: 'S/', label: 'Soles (S/)', nombre: 'SOLES' },
  { codigo: 'US$', label: 'Dólares (US$)', nombre: 'DÓLARES AMERICANOS' }
];

export const ICONOS_PLANTILLA = ['transporte', 'maquinaria', 'epp', 'materiales', 'equipos', 'servicios', 'combustible', 'campamento', 'general'];

function nuevoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export function crearCampo(datos = {}) {
  return { id: nuevoId(), etiqueta: '', tipo: 'texto', valor: '', ancho: 'completo', ...datos };
}

export function crearColumna(datos = {}) {
  return { id: nuevoId(), etiqueta: '', tipo: 'texto', ancho: 2, ...datos };
}

export function crearFila(columnas = [], valores = {}) {
  const fila = { id: nuevoId(), valores: {} };
  for (const c of columnas) fila.valores[c.id] = valores[c.id] ?? (c.tipo === 'unidad' ? 'UNIDAD' : '');
  return fila;
}

export function crearBloque(tipo, datos = {}) {
  const base = { id: nuevoId(), tipo, titulo: '', mostrarTitulo: true, ancho: 'completo' };
  if (tipo === 'campos') return { ...base, titulo: 'Datos', campos: [crearCampo({ etiqueta: 'Nuevo dato' })], ...datos };
  if (tipo === 'tabla') {
    const columnas = datos.columnas || COLUMNAS_ESTANDAR();
    return { ...base, titulo: 'Ítems', mostrarTitulo: false, numerar: true, ...datos, columnas, filas: datos.filas || [crearFila(columnas)] };
  }
  if (tipo === 'lista') return { ...base, titulo: 'Requisitos', estilo: 'vinetas', elementos: [''], ...datos };
  return { ...base, titulo: 'Notas', contenido: '', ...datos };
}

function COLUMNAS_ESTANDAR() {
  return [
    crearColumna({ etiqueta: 'Descripción', rol: 'descripcion', ancho: 6 }),
    crearColumna({ etiqueta: 'Unidad', tipo: 'unidad', rol: 'unidad', ancho: 2 }),
    crearColumna({ etiqueta: 'Cantidad', tipo: 'numero', rol: 'cantidad', ancho: 2 })
  ];
}

function datosGenerales(extra = []) {
  return crearBloque('campos', {
    titulo: 'Datos generales',
    mostrarTitulo: false,
    campos: [
      ...CAMPOS_AUTOMATICOS.filter((c) => c.auto !== 'moneda').map((c) => crearCampo(c)),
      crearCampo({ etiqueta: 'Asunto', clave: 'asunto' }),
      ...extra.map((c) => crearCampo(c)),
      crearCampo({ ...CAMPOS_AUTOMATICOS.find((c) => c.auto === 'moneda') })
    ]
  });
}

function condicionesYPago(condicionesExtra = []) {
  return [
    crearBloque('lista', {
      titulo: 'Condiciones de la oferta',
      estilo: 'tarjeta',
      ancho: 'mitad',
      elementos: [
        'Indicar validez de la oferta.',
        'Indicar tiempo de entrega.',
        'Indicar condiciones de pago.',
        'Indicar si los precios incluyen IGV.',
        ...condicionesExtra
      ]
    }),
    crearBloque('lista', {
      titulo: 'Datos bancarios para pago',
      estilo: 'tarjeta',
      ancho: 'mitad',
      elementos: [
        'Indicar entidad bancaria.',
        'Indicar tipo de cuenta.',
        'Indicar moneda de la cuenta.',
        'Indicar N.° de cuenta.',
        'Indicar CCI.'
      ]
    })
  ];
}

const LUGAR = { etiqueta: 'Lugar de entrega', clave: 'lugarEntrega' };
const FECHA_REQUERIDA = { etiqueta: 'Fecha requerida', tipo: 'fecha', clave: 'fechaRequerida' };

function tabla(columnas, titulo = 'Ítems') {
  return crearBloque('tabla', { titulo, columnas: columnas.map((c) => crearColumna(c)) });
}

const COL = {
  descripcion: (etiqueta = 'Descripción', ancho = 5) => ({ etiqueta, rol: 'descripcion', ancho }),
  especificaciones: (etiqueta = 'Especificaciones', ancho = 5) => ({ etiqueta, rol: 'especificaciones', ancho }),
  unidad: () => ({ etiqueta: 'Unidad', tipo: 'unidad', rol: 'unidad', ancho: 2 }),
  cantidad: () => ({ etiqueta: 'Cantidad', tipo: 'numero', rol: 'cantidad', ancho: 2 }),
  codigo: () => ({ etiqueta: 'Código', rol: 'codigo', ancho: 2 })
};

const PLANTILLAS_BASE_DEF = [
  {
    id: 'transporte',
    nombre: 'Transporte de personal',
    descripcion: 'Camionetas 4x4, minibuses y buses con o sin conductor',
    icono: 'transporte',
    bloques: () => [
      datosGenerales([
        { etiqueta: 'Unidad minera / lugar de servicio', clave: 'lugarEntrega' },
        { etiqueta: 'Fecha de inicio', tipo: 'fecha' },
        { etiqueta: 'Duración del servicio', ancho: 'mitad' },
        { etiqueta: 'Turno / horario', ancho: 'mitad' }
      ]),
      tabla([COL.descripcion('Vehículo', 4), COL.especificaciones('Especificaciones', 6), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos del vehículo y conductor',
        elementos: [
          'SOAT y revisión técnica vigentes.',
          'Antigüedad máxima del vehículo: indicar año de fabricación.',
          'GPS operativo con acceso a monitoreo.',
          'Conductor con licencia vigente y licencia interna de la unidad minera.',
          'Equipamiento de seguridad: circulina, pértiga con banderín, alarma de retroceso, cuñas, extintor, botiquín y kit antiderrame.',
          'SCTR (salud y pensión) vigente del conductor.'
        ]
      }),
      ...condicionesYPago(['Indicar si el combustible y el mantenimiento están incluidos.'])
    ]
  },
  {
    id: 'maquinaria',
    nombre: 'Alquiler de maquinaria pesada',
    descripcion: 'Excavadoras, cargadores, volquetes, grúas y similares',
    icono: 'maquinaria',
    bloques: () => [
      datosGenerales([
        { etiqueta: 'Unidad minera / frente de trabajo', clave: 'lugarEntrega' },
        { etiqueta: 'Fecha de movilización', tipo: 'fecha' },
        { etiqueta: 'Horas mínimas garantizadas', ancho: 'mitad' },
        { etiqueta: 'Periodo de alquiler', ancho: 'mitad' }
      ]),
      tabla([COL.descripcion('Equipo', 4), COL.especificaciones('Capacidad / especificaciones', 6), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos del equipo',
        elementos: [
          'Indicar si incluye operador certificado.',
          'Certificado de operatividad y último mantenimiento.',
          'Seguro vigente del equipo (TREC / responsabilidad civil).',
          'Indicar costo de movilización y desmovilización.',
          'Indicar si el combustible está a cargo del proveedor o del cliente.'
        ]
      }),
      ...condicionesYPago()
    ]
  },
  {
    id: 'epp',
    nombre: 'EPP',
    descripcion: 'Equipos de protección personal',
    icono: 'epp',
    bloques: () => [
      datosGenerales([LUGAR, FECHA_REQUERIDA]),
      tabla([COL.codigo(), COL.descripcion('Descripción', 5), COL.especificaciones('Talla / especificación', 3), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos',
        elementos: [
          'Certificación según norma aplicable (ANSI, NTP o equivalente).',
          'Adjuntar fichas técnicas y certificados de conformidad.',
          'Indicar marca y modelo ofertado.'
        ]
      }),
      ...condicionesYPago(['Indicar si el envío está incluido o se cotiza como servicio adicional.'])
    ]
  },
  {
    id: 'materiales',
    nombre: 'Materiales e insumos',
    descripcion: 'Materiales de construcción, eléctricos, ferretería e insumos',
    icono: 'materiales',
    bloques: () => [
      datosGenerales([LUGAR, FECHA_REQUERIDA]),
      tabla([COL.codigo(), COL.descripcion('Descripción', 5), COL.especificaciones('Especificaciones', 4), COL.unidad(), COL.cantidad()]),
      ...condicionesYPago(['Indicar si el envío está incluido o se cotiza como servicio adicional.'])
    ]
  },
  {
    id: 'equipos',
    nombre: 'Equipos y herramientas',
    descripcion: 'Compra o alquiler de equipos, instrumentos y herramientas',
    icono: 'equipos',
    bloques: () => [
      datosGenerales([LUGAR, FECHA_REQUERIDA, { etiqueta: 'Modalidad (compra / alquiler)' }]),
      tabla([COL.descripcion('Equipo / herramienta', 4), COL.especificaciones('Especificaciones técnicas', 6), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos',
        elementos: ['Indicar garantía.', 'Adjuntar ficha técnica.', 'Indicar si incluye certificado de calibración.']
      }),
      ...condicionesYPago()
    ]
  },
  {
    id: 'servicios',
    nombre: 'Servicios',
    descripcion: 'Mantenimiento, instalaciones, consultoría y servicios generales',
    icono: 'servicios',
    bloques: () => [
      datosGenerales([
        { etiqueta: 'Lugar de ejecución', clave: 'lugarEntrega' },
        { etiqueta: 'Fecha de inicio', tipo: 'fecha', ancho: 'mitad' },
        { etiqueta: 'Plazo de ejecución', ancho: 'mitad' }
      ]),
      crearBloque('texto', { titulo: 'Alcance del servicio', contenido: '' }),
      tabla([COL.descripcion('Actividad / entregable', 8), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos de seguridad',
        elementos: [
          'SCTR (salud y pensión) vigente del personal.',
          'Exámenes médicos ocupacionales (EMO) vigentes.',
          'IPERC y procedimientos de trabajo del servicio.',
          'EPP completo del personal a cargo del proveedor.'
        ]
      }),
      ...condicionesYPago()
    ]
  },
  {
    id: 'combustible',
    nombre: 'Combustible y lubricantes',
    descripcion: 'Diésel, gasolina, aceites y grasas',
    icono: 'combustible',
    bloques: () => [
      datosGenerales([LUGAR, { etiqueta: 'Frecuencia de abastecimiento' }]),
      tabla([COL.descripcion('Producto', 6), COL.especificaciones('Especificación', 4), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos',
        elementos: ['Hoja de seguridad (MSDS) de cada producto.', 'Indicar si incluye transporte hasta la unidad minera.']
      }),
      ...condicionesYPago()
    ]
  },
  {
    id: 'campamento',
    nombre: 'Alimentación y hospedaje',
    descripcion: 'Alimentación, hospedaje y servicios de campamento',
    icono: 'campamento',
    bloques: () => [
      datosGenerales([LUGAR, { etiqueta: 'Fecha de inicio', tipo: 'fecha', ancho: 'mitad' }, { etiqueta: 'Duración', ancho: 'mitad' }, { etiqueta: 'Cantidad de personas' }]),
      tabla([COL.descripcion('Servicio', 6), COL.especificaciones('Detalle', 4), COL.unidad(), COL.cantidad()]),
      crearBloque('lista', {
        titulo: 'Requisitos',
        elementos: ['Indicar menú y número de comidas por día.', 'Certificado sanitario vigente.', 'Indicar condiciones de habitaciones y servicios incluidos.']
      }),
      ...condicionesYPago()
    ]
  },
  {
    id: 'general',
    nombre: 'Solicitud general',
    descripcion: 'Formato libre para cotizar cualquier otra cosa',
    icono: 'general',
    bloques: () => [datosGenerales([LUGAR, FECHA_REQUERIDA]), tabla([COL.descripcion('Descripción', 8), COL.unidad(), COL.cantidad()]), ...condicionesYPago()]
  }
];

export function plantillasBase() {
  return PLANTILLAS_BASE_DEF.map((p, orden) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    icono: p.icono,
    orden,
    base: true,
    activa: true,
    bloques: p.bloques()
  }));
}

export function combinarPlantillas(guardadas = []) {
  const porId = new Map(guardadas.map((p) => [p.id, p]));
  const base = plantillasBase().map((p) => (porId.has(p.id) ? { ...p, ...porId.get(p.id), base: true, personalizada: true } : p));
  const propias = guardadas.filter((p) => !base.some((b) => b.id === p.id)).map((p) => ({ ...p, base: false }));
  return [...base, ...propias].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

export function clonarBloques(bloques = []) {
  return bloques.map((b) => {
    const bloque = { ...structuredClone(b), id: nuevoId() };
    if (bloque.tipo === 'campos') bloque.campos = bloque.campos.map((c) => ({ ...c, id: nuevoId() }));
    if (bloque.tipo === 'tabla') {
      const mapa = {};
      bloque.columnas = bloque.columnas.map((c) => { const id = nuevoId(); mapa[c.id] = id; return { ...c, id }; });
      bloque.filas = (bloque.filas || []).map((f) => ({
        id: nuevoId(),
        valores: Object.fromEntries(Object.entries(f.valores || {}).map(([k, v]) => [mapa[k] || k, v]))
      }));
    }
    return bloque;
  });
}

export function valorAutomatico(auto, contexto = {}) {
  const { fecha, solicitante, empresa = {}, moneda } = contexto;
  if (auto === 'fecha') return fecha || '';
  if (auto === 'solicitante') return solicitante || '';
  if (auto === 'empresa') return empresa.razonSocial || '';
  if (auto === 'ruc') return empresa.ruc || '';
  if (auto === 'direccion') return empresa.direccion || '';
  if (auto === 'moneda') return MONEDAS.find((m) => m.codigo === moneda)?.nombre || '';
  return '';
}

export function contarItems(bloques = []) {
  return bloques
    .filter((b) => b.tipo === 'tabla')
    .reduce((t, b) => t + (b.filas || []).filter((f) => (b.columnas || []).some((c) => c.tipo !== 'unidad' && String(f.valores?.[c.id] ?? '').trim())).length, 0);
}

export function valorCampo(bloques = [], clave) {
  for (const b of bloques) {
    if (b.tipo !== 'campos') continue;
    const c = b.campos.find((x) => x.clave === clave);
    if (c && String(c.valor || '').trim()) return c.valor;
  }
  return '';
}

export function primeraDescripcion(bloques = []) {
  for (const b of bloques) {
    if (b.tipo !== 'tabla') continue;
    const col = b.columnas.find((c) => c.rol === 'descripcion') || b.columnas[0];
    const fila = (b.filas || []).find((f) => String(f.valores?.[col?.id] || '').trim());
    if (fila) return fila.valores[col.id];
  }
  return '';
}

export const ETIQUETAS_LEGACY = {
  epp: 'EPP',
  transporte: 'Transporte / Vehículos',
  productos: 'Productos / Materiales',
  equipos: 'Equipos / Herramientas',
  servicios: 'Servicios',
  otros: 'Otros'
};

function bloquesDesdeSolicitudAntigua(sol = {}) {
  const campos = [
    ...CAMPOS_AUTOMATICOS.filter((c) => c.auto !== 'moneda').map((c) => crearCampo(c)),
    crearCampo({ etiqueta: 'Tipo de Solicitud', valor: ETIQUETAS_LEGACY[sol.categoria] || 'EPP' })
  ];
  if (sol.asunto) campos.push(crearCampo({ etiqueta: 'Asunto', clave: 'asunto', valor: sol.asunto }));
  if (sol.lugarEntrega) campos.push(crearCampo({ etiqueta: 'Lugar de Entrega', clave: 'lugarEntrega', valor: sol.lugarEntrega }));
  if (sol.fechaRequerida) campos.push(crearCampo({ etiqueta: 'Fecha Requerida', tipo: 'fecha', clave: 'fechaRequerida', valor: sol.fechaRequerida }));
  campos.push(crearCampo({ ...CAMPOS_AUTOMATICOS.find((c) => c.auto === 'moneda') }));
  if (sol.observacion) campos.push(crearCampo({ etiqueta: 'Observación', tipo: 'textoLargo', valor: sol.observacion }));

  const items = sol.items || [];
  const conCodigo = items.some((i) => String(i.codigo || '').trim());
  const columnas = [
    ...(conCodigo ? [crearColumna({ etiqueta: 'Código', rol: 'codigo', ancho: 2 })] : []),
    crearColumna({ etiqueta: 'Descripción', rol: 'descripcion', ancho: 7 }),
    crearColumna({ etiqueta: 'Unidad', tipo: 'unidad', rol: 'unidad', ancho: 2 }),
    crearColumna({ etiqueta: 'Cantidad', tipo: 'numero', rol: 'cantidad', ancho: 2 })
  ];
  const col = Object.fromEntries(columnas.map((c) => [c.rol, c.id]));
  const filas = items.map((i) => {
    const detalle = [i.descripcion, i.especificaciones, [i.marca, i.modelo].filter(Boolean).join(' · ')]
      .map((t) => String(t || '').trim()).filter(Boolean).join('\n');
    return crearFila(columnas, {
      ...(col.codigo ? { [col.codigo]: i.codigo || '' } : {}),
      [col.descripcion]: detalle,
      [col.unidad]: i.unidadMedida || 'UNIDAD',
      [col.cantidad]: i.cantidad ?? ''
    });
  });

  return [
    crearBloque('campos', { titulo: 'Datos generales', mostrarTitulo: false, campos }),
    crearBloque('tabla', { titulo: 'Ítems', mostrarTitulo: false, columnas, filas: filas.length ? filas : [crearFila(columnas)] }),
    ...condicionesYPago(['Indicar si el envío está incluido o se cotiza como servicio adicional.'])
  ];
}

export function bloquesDeSolicitud(sol = {}) {
  return Array.isArray(sol.bloques) && sol.bloques.length ? sol.bloques : bloquesDesdeSolicitudAntigua(sol);
}
