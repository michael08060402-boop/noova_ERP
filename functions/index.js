const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { generarXmlUBL, SIG_ID } = require('./src/generarXml');
const { firmarXml } = require('./src/firmarXml');
const { enviarASunat } = require('./src/sunatClient');
const { validarRuc, consultarRucCompleto } = require('./src/consultarRuc');
const {
  listarCarpeta, obtenerLinkDescarga,
  obtenerCarpetaPorRuta, obtenerItem, crearCarpeta, subirArchivo,
  renombrarItem, eliminarItem, estaDentroDeCarpeta, buscarDocumentos
} = require('./src/graph/graphDriveProvider');
const {
  normalizarRol,
  esRolValido,
  getAreaPredeterminada,
  getNombreArea,
  getCarpetaNubePerfil,
  crearAccessControl
} = require('./src/accessControl');
const { enviarCorreo } = require('./src/graph/graphMailProvider');
const AdmZip = require('adm-zip');

const TIPO_DOC_COD = { 'Factura': '01', 'Boleta': '03', 'Nota de Crédito': '07' };

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const {
  obtenerPerfilActivo,
  exigirPermiso,
  exigirAlgunoPermisos,
  exigirSeccionConfiguracion
} = crearAccessControl(db);

function textoSeguro(valor, maximo = 300) {
  return String(valor || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maximo);
}

exports.logsCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 10, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');

    const perfil = await obtenerPerfilActivo(request.auth.uid);
    const accion = textoSeguro(request.data?.accion, 100);
    const detalle = textoSeguro(request.data?.detalle, 1000);
    if (!accion) throw new HttpsError('invalid-argument', 'La acción es requerida');

    const email = textoSeguro(request.auth.token?.email, 200).toLowerCase();
    const nombre = textoSeguro(perfil.nombre, 100);
    const usuario = email ? `${nombre || email} (${email})` : request.auth.uid;
    const ahora = new Date();
    const partesHora = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(ahora);

    await db.collection('logs').add({
      usuarioUid: request.auth.uid,
      usuarioEmail: email,
      usuarioNombre: nombre,
      usuario,
      accion,
      detalle,
      fecha: ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
      hora: partesHora,
      createdAt: ahora.toISOString()
    });

    return { registrado: true };
  }
);

function normalizarItemsCompra(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new HttpsError('invalid-argument', 'La orden debe contener entre 1 y 100 ítems');
  }
  return items.map((item, index) => {
    const cantidad = Number(item.cantidad);
    const precioUnitario = Number(item.precioUnitario);
    const descripcion = textoSeguro(item.descripcion, 500);
    if (!descripcion || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      throw new HttpsError('invalid-argument', `El ítem ${index + 1} tiene datos inválidos`);
    }
    return {
      codigo: textoSeguro(item.codigo, 60),
      descripcion,
      unidadMedida: textoSeguro(item.unidadMedida || 'UND.', 20),
      cantidad,
      precioUnitario,
      total: Math.round((cantidad * precioUnitario + Number.EPSILON) * 100) / 100
    };
  });
}

function construirCodigo(prefijo, numero, longitud) {
  const limpio = textoSeguro(prefijo || '', 8).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return `${limpio}${String(numero).padStart(longitud, '0')}`;
}

async function crearDocumentoCorrelativo({ request, coleccion, campoConfig, permiso, defaults, prepararDatos }) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
  const perfil = await exigirPermiso(request.auth.uid, permiso);
  const configRef = db.collection('configuracion').doc('general');

  return db.runTransaction(async (transaction) => {
    const configSnapshot = await transaction.get(configRef);
    const configGeneral = configSnapshot.exists ? configSnapshot.data() : {};
    const correlativo = { ...defaults, ...(configGeneral[campoConfig] || {}) };
    const prefijo = textoSeguro(correlativo.prefijo || defaults.prefijo, 8).toUpperCase();
    const longitud = Math.min(12, Math.max(1, Number(correlativo.longitud || defaults.longitud)));
    let numero = Math.max(1, Math.trunc(Number(correlativo.proximoNumero || defaults.proximoNumero)));
    let codigo;
    let documentoRef;

    for (let intentos = 0; intentos < 100; intentos += 1) {
      codigo = construirCodigo(prefijo, numero, longitud);
      documentoRef = db.collection(coleccion).doc(codigo);
      const existente = await transaction.get(documentoRef);
      const codigoExistente = await transaction.get(db.collection(coleccion).where('codigo', '==', codigo).limit(1));
      if (!existente.exists && codigoExistente.empty) break;
      numero += 1;
      documentoRef = null;
    }
    if (!documentoRef) throw new HttpsError('resource-exhausted', 'No se pudo reservar un correlativo único');

    const ahora = new Date().toISOString();
    const datos = await prepararDatos({ data: request.data || {}, transaction, db, perfil });
    transaction.create(documentoRef, {
      ...datos,
      codigo,
      creadoPorUid: request.auth.uid,
      creadoPorNombre: perfil.nombre || request.auth.token?.email || request.auth.uid,
      createdAt: ahora,
      updatedAt: ahora
    });
    transaction.set(configRef, {
      [campoConfig]: {
        ...correlativo,
        prefijo,
        longitud,
        ultimoCorrelativo: codigo,
        proximoNumero: numero + 1
      },
      updatedAt: ahora
    }, { merge: true });
    return { id: documentoRef.id, codigo };
  });
}

exports.cotizacionCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' },
  async (request) => crearDocumentoCorrelativo({
    request,
    coleccion: 'cotizaciones',
    campoConfig: 'cotizacion',
    permiso: 'cotizaciones',
    defaults: { prefijo: 'NV', longitud: 7, proximoNumero: 1000001 },
    prepararDatos: async ({ data }) => {
      if (!Array.isArray(data.items) || !data.items.length) {
        throw new HttpsError('invalid-argument', 'La cotización debe contener al menos un ítem');
      }
      return data;
    }
  })
);

exports.ordenCompraCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' },
  async (request) => crearDocumentoCorrelativo({
    request,
    coleccion: 'ordenesCompra',
    campoConfig: 'ordenCompra',
    permiso: 'compras',
    defaults: { prefijo: 'OC', longitud: 6, proximoNumero: 100111 },
    prepararDatos: async ({ data, transaction, db }) => {
      const proveedorId = textoSeguro(data.proveedorId, 150);
      if (!proveedorId) {
        throw new HttpsError('invalid-argument', 'Selecciona un proveedor registrado');
      }
      const proveedorSnapshot = await transaction.get(db.collection('proveedores').doc(proveedorId));
      if (!proveedorSnapshot.exists) {
        throw new HttpsError('not-found', 'El proveedor seleccionado ya no existe');
      }
      const proveedor = proveedorSnapshot.data();
      if (proveedor.activo === false) {
        throw new HttpsError('failed-precondition', 'El proveedor seleccionado está inactivo');
      }
      if (!data.fecha || !textoSeguro(data.formaPago, 120) || !textoSeguro(data.lugarEntrega, 300)) {
        throw new HttpsError('invalid-argument', 'Fecha, forma de pago y lugar de entrega son requeridos');
      }
      if (data.origenCotizacionId) {
        const cotizacion = await transaction.get(db.collection('cotizaciones').doc(data.origenCotizacionId));
        if (!cotizacion.exists) throw new HttpsError('not-found', 'La cotización de origen no existe');
        const ordenExistente = await transaction.get(
          db.collection('ordenesCompra').where('origenCotizacionId', '==', data.origenCotizacionId).limit(1)
        );
        if (!ordenExistente.empty) {
          throw new HttpsError('already-exists', 'Esta cotización ya tiene una orden de compra vinculada');
        }
      }
      const items = normalizarItemsCompra(data.items);
      const subtotal = Math.round(items.reduce((suma, item) => suma + item.total, 0) * 100) / 100;
      const aplicaIgv = data.aplicaIgv !== false;
      const igv = aplicaIgv ? Math.round(subtotal * 18) / 100 : 0;
      const total = Math.round((subtotal + igv) * 100) / 100;
      return {
        fecha: textoSeguro(data.fecha, 10),
        proveedorId,
        proveedor: {
          razonSocial: textoSeguro(proveedor.razonSocial, 180),
          ruc: textoSeguro(proveedor.ruc, 20),
          contacto: textoSeguro(proveedor.contacto, 120),
          direccion: textoSeguro(proveedor.direccion, 300),
          telefono: textoSeguro(proveedor.telefono, 30),
          email: textoSeguro(proveedor.email, 160)
        },
        moneda: data.moneda === 'S/' ? 'S/' : 'US$',
        formaPago: textoSeguro(data.formaPago, 120),
        lugarEntrega: textoSeguro(data.lugarEntrega, 300),
        referencia: textoSeguro(data.referencia, 160),
        observaciones: textoSeguro(data.observaciones, 500),
        aplicaIgv,
        estado: data.estado === 'Borrador' ? 'Borrador' : 'Emitida',
        items,
        subtotal,
        igv,
        total,
        origenCotizacionId: data.origenCotizacionId || null,
        origenCotizacionCodigo: textoSeguro(data.origenCotizacionCodigo, 40) || null,
        elaboradoPor: textoSeguro(data.elaboradoPor, 140),
        cargoElaborador: textoSeguro(data.cargoElaborador, 100),
        autorizadoPor: textoSeguro(data.autorizadoPor, 140),
        cargoAutorizador: textoSeguro(data.cargoAutorizador, 100)
      };
    }
  })
);


function normalizarProveedorCompra(proveedor = {}) {
  const razonSocial = textoSeguro(proveedor.razonSocial, 180);
  if (!razonSocial) throw new HttpsError('invalid-argument', 'El proveedor es requerido');
  return {
    razonSocial,
    ruc: textoSeguro(proveedor.ruc, 20),
    contacto: textoSeguro(proveedor.contacto, 120),
    direccion: textoSeguro(proveedor.direccion, 300),
    telefono: textoSeguro(proveedor.telefono || proveedor.celular, 30),
    email: textoSeguro(proveedor.email, 160)
  };
}

function normalizarOrdenCompraEditable(data = {}) {
  if (!data.fecha || !textoSeguro(data.formaPago, 120) || !textoSeguro(data.lugarEntrega, 300)) {
    throw new HttpsError('invalid-argument', 'Fecha, forma de pago y lugar de entrega son requeridos');
  }
  const proveedor = normalizarProveedorCompra(data.proveedor || {});
  const items = normalizarItemsCompra(data.items);
  const subtotal = Math.round(items.reduce((suma, item) => suma + item.total, 0) * 100) / 100;
  const aplicaIgv = data.aplicaIgv !== false;
  const igv = aplicaIgv ? Math.round(subtotal * 18) / 100 : 0;
  const total = Math.round((subtotal + igv) * 100) / 100;
  return {
    fecha: textoSeguro(data.fecha, 10),
    proveedorId: textoSeguro(data.proveedorId, 150),
    proveedor,
    moneda: data.moneda === 'S/' ? 'S/' : 'US$',
    formaPago: textoSeguro(data.formaPago, 120),
    lugarEntrega: textoSeguro(data.lugarEntrega, 300),
    referencia: textoSeguro(data.referencia, 160),
    observaciones: textoSeguro(data.observaciones, 500),
    aplicaIgv,
    estado: data.estado === 'Borrador' ? 'Borrador' : 'Emitida',
    items,
    subtotal,
    igv,
    total,
    elaboradoPor: textoSeguro(data.elaboradoPor, 140),
    cargoElaborador: textoSeguro(data.cargoElaborador, 100),
    autorizadoPor: textoSeguro(data.autorizadoPor, 140),
    cargoAutorizador: textoSeguro(data.cargoAutorizador, 100)
  };
}

// Las lecturas y mutaciones de Compras pasan por Functions para que la UX no
// dependa de que unas reglas Firestore antiguas sigan desplegadas. La Function
// vuelve a validar el permiso con el perfil real del usuario antes de usar Admin SDK.
exports.ordenesCompraListar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const snap = await db.collection('ordenesCompra').orderBy('createdAt', 'desc').get();
    return { ordenes: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

exports.ordenCompraActualizar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const { id, orden } = request.data || {};
    if (!id || !orden) throw new HttpsError('invalid-argument', 'id y orden son requeridos');
    const ref = db.collection('ordenesCompra').doc(String(id));
    const actual = await ref.get();
    if (!actual.exists) throw new HttpsError('not-found', 'La orden de compra no existe');
    const proveedorId = textoSeguro(orden.proveedorId, 150);
    if (!proveedorId) throw new HttpsError('invalid-argument', 'Selecciona un proveedor registrado');
    const proveedorSnapshot = await db.collection('proveedores').doc(proveedorId).get();
    if (!proveedorSnapshot.exists) throw new HttpsError('not-found', 'El proveedor seleccionado ya no existe');
    const proveedor = proveedorSnapshot.data();
    if (proveedor.activo === false && actual.data().proveedorId !== proveedorId) {
      throw new HttpsError('failed-precondition', 'No puedes cambiar la orden a un proveedor inactivo');
    }
    const editable = normalizarOrdenCompraEditable({ ...orden, proveedorId, proveedor });
    await ref.update({ ...editable, updatedAt: new Date().toISOString() });
    return { actualizado: true };
  }
);

exports.ordenCompraEliminar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const { id } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id es requerido');
    const ref = db.collection('ordenesCompra').doc(String(id));
    const actual = await ref.get();
    if (!actual.exists) throw new HttpsError('not-found', 'La orden de compra no existe');
    if (actual.data().estado !== 'Borrador') {
      throw new HttpsError('failed-precondition', 'Solo se pueden eliminar órdenes en borrador');
    }
    await ref.delete();
    return { eliminado: true };
  }
);

const PROVEEDOR_DEMO_ID = 'instruments-labs-testo-demo';
const PROVEEDOR_DEMO = {
  razonSocial: 'INSTRUMENTS LABS / TESTO (DEMO)',
  ruc: '',
  contacto: 'Completar datos reales',
  direccion: '',
  telefono: '',
  email: '',
  activo: true,
  esDemo: true,
  notaInterna: 'Proveedor inicial de prueba. Editar con los datos comerciales reales antes de emitir una OC definitiva.'
};

async function asegurarProveedorDemo(db) {
  const ref = db.collection('proveedores').doc(PROVEEDOR_DEMO_ID);
  const existente = await ref.get();
  if (existente.exists) return;
  const ahora = new Date().toISOString();
  await ref.set({ ...PROVEEDOR_DEMO, createdAt: ahora, updatedAt: ahora });
}

function normalizarProveedorMaestro(data = {}) {
  const proveedor = normalizarProveedorCompra(data);
  return {
    ...proveedor,
    activo: data.activo !== false,
    notaInterna: textoSeguro(data.notaInterna, 500),
    esDemo: data.esDemo === true
  };
}

exports.proveedoresListar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirAlgunoPermisos(request.auth.uid, ['proveedores', 'compras']);
      await asegurarProveedorDemo(db);
    const snap = await db.collection('proveedores').orderBy('razonSocial', 'asc').get();
    return { proveedores: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

exports.proveedorCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'proveedores');
    const proveedor = normalizarProveedorMaestro(request.data?.proveedor || {});
    const ahora = new Date().toISOString();
    const ref = await db.collection('proveedores').add({ ...proveedor, esDemo: false, createdAt: ahora, updatedAt: ahora });
    return { id: ref.id };
  }
);

exports.proveedorActualizar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'proveedores');
    const { id, proveedor: proveedorEntrada } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id es requerido');
    const proveedor = normalizarProveedorMaestro(proveedorEntrada || {});
    const ref = db.collection('proveedores').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'El proveedor no existe');
    await ref.update({ ...proveedor, esDemo: false, updatedAt: new Date().toISOString() });
    return { actualizado: true };
  }
);

exports.proveedorEliminar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'proveedores');
    const { id } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id es requerido');
      const usado = await db.collection('ordenesCompra').where('proveedorId', '==', String(id)).limit(1).get();
    if (!usado.empty) throw new HttpsError('failed-precondition', 'No se puede eliminar un proveedor que ya está asociado a una orden de compra');
    await db.collection('proveedores').doc(String(id)).delete();
    return { eliminado: true };
  }
);

// Genera un comprobante electrónico: crea el XML UBL 2.1, lo firma con el
// certificado digital, lo empaqueta en ZIP y lo envía a SUNAT. El resultado
// (aceptado, rechazado o error) se guarda en Firestore.
exports.emitirComprobante = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '1GiB',
    secrets: ['NOOVA_CERT_P12', 'NOOVA_CERT_PASS'],
  },
  async (request) => {
    console.log('Iniciando emitirComprobante');

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    await exigirPermiso(request.auth.uid, 'facturacion');

    const { facturaId, facturaData, empresaData } = request.data;

    if (!empresaData || typeof empresaData !== 'object' || !empresaData.ruc) {
      console.error('empresaData inválido:', empresaData);
      throw new HttpsError(
        'failed-precondition',
        `empresaData.ruc es requerido. Recibido: ${JSON.stringify(empresaData || {})}`
      );
    }

    if (!facturaData?.tipo) {
      console.error('facturaData.tipo faltante');
      throw new HttpsError('failed-precondition', "facturaData.tipo es requerido");
    }

    console.log('Datos recibidos:', {
      facturaId,
      tipo: facturaData.tipo,
      tipoOperacion: facturaData.tipoOperacion || facturaData.operacion || '0101',
      serie: facturaData.serie,
      numero: facturaData.numero,
      rucEmpresa: empresaData.ruc,
    });

      try {
      // 1. Generar XML UBL 2.1
      console.log('Generando XML...');
      const facturaConOperacion = {
        ...facturaData,
        tipoOperacion: facturaData.tipoOperacion || facturaData.operacion || '0101',
      };
      const xmlString = generarXmlUBL(facturaConOperacion, empresaData);
      console.log('XML generado (longitud):', xmlString.length);

      // 2. Firmar XML con el certificado digital (o simular en modo pruebas)
      const simulate = process.env.SUNAT_SIMULATE === 'true';
      let xmlFirmado;
      if (simulate) {
        console.log('MODO SIMULACIÓN: no se usará certificado. Firma simulada.');
        xmlFirmado = xmlString;
      } else {
        const certBase64 = process.env.NOOVA_CERT_P12;
        const certPass = process.env.NOOVA_CERT_PASS;
        if (!certBase64 || !certPass) {
          throw new Error('Faltan variables NOOVA_CERT_P12 o NOOVA_CERT_PASS');
        }
        console.log('Certificado cargado (longitud base64):', certBase64.length);
        console.log('Firmando XML con sigId:', SIG_ID);
        xmlFirmado = await firmarXml(xmlString, certBase64, certPass, SIG_ID);
        console.log('XML firmado (longitud):', xmlFirmado.length);
      }

      // 3. Construir nombre de archivo SUNAT: RUC-TIPODOC-SERIE-NUMERO
      const tipoDocCod = TIPO_DOC_COD[facturaData.tipo] || '01';
      const esFactura = tipoDocCod === '01';
      const nombreArchivo = `${empresaData.ruc}-${tipoDocCod}-${facturaData.serie}-${facturaData.numero}`;
      console.log('Nombre archivo:', nombreArchivo);

      // 4. Crear ZIP (SUNAT exige un único XML dentro del ZIP)
      const zipBuffer = crearZip(xmlFirmado, `${nombreArchivo}.xml`);
      console.log('ZIP creado (tamaño en bytes):', zipBuffer.length);

      // 5. Enviar a SUNAT (beta o producción)
      const esBeta = process.env.SUNAT_ENV !== 'produccion';
      console.log(`${simulate ? 'SIMULANDO envío a' : 'Enviando a'} SUNAT ${esBeta ? 'BETA' : 'PRODUCCIÓN'}...`);
      const respuestaSunat = await enviarASunat(zipBuffer, nombreArchivo, empresaData.ruc, esBeta, esFactura, simulate);
      console.log('Respuesta SUNAT:', JSON.stringify(respuestaSunat));

      // 6. Guardar resultado en Firestore
      await db.collection('facturacion').doc(facturaId).set({
        ...facturaData,
        estadoSunat: respuestaSunat.estado,
        mensajeSunat: respuestaSunat.mensaje,
        codigoRespuesta: respuestaSunat.codigo,
        descripcionErrorSunat: respuestaSunat.descripcionError || null,
        xmlFirmado: xmlFirmado,
        cdrBase64: respuestaSunat.cdrBase64 || null,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log('Proceso completado con éxito');
      return {
        estado: respuestaSunat.estado,
        mensaje: respuestaSunat.mensaje,
        codigo: respuestaSunat.codigo,
      };

    } catch (err) {
      console.error('Error en emitirComprobante:', err);

      await db.collection('facturacion').doc(facturaId).set({
        estadoSunat: 'ERROR',
        mensajeSunat: err.message || 'Error interno',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', err.message || 'Error procesando el comprobante');
    }
  }
);

function crearZip(xmlFirmado, nombreArchivoXml) {
  const zip = new AdmZip();
  zip.addFile(nombreArchivoXml, Buffer.from(xmlFirmado, 'utf8'));
  return zip.toBuffer();
}

// Consulta de RUC con cache permanente en Firestore + api.apis.net.pe.
// Si la API cae y el RUC no está en cache, el frontend muestra mensaje de
// "servicios fuera de línea" y el usuario ingresa datos manualmente.
exports.consultarRuc = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    console.log('Iniciando consultarRuc');

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    await obtenerPerfilActivo(request.auth.uid);

    const { ruc } = request.data || {};

    const validacion = validarRuc(ruc);
    if (!validacion.valido) {
      console.warn('RUC inválido:', ruc, '—', validacion.error);
      throw new HttpsError('invalid-argument', validacion.error);
    }

    console.log('Consultando RUC:', ruc);

    try {
      const resultado = await consultarRucCompleto(ruc);
      console.log('RUC consultado correctamente:', {
        ruc: resultado.ruc,
        razonSocial: resultado.razonSocial,
        fuente: resultado.fuente,
      });
      return resultado;
    } catch (err) {
      console.error('Error en consultarRuc:', err.message);
      throw new HttpsError('internal', err.message || 'Error consultando RUC');
    }
  }
);

function convertirErrorGraph(err, fallback) {
  if (err instanceof HttpsError) return err;
  const status = Number(err?.response?.status || 0);
  const graphCode = err?.response?.data?.error?.code || '';
  const graphMessage = err?.response?.data?.error?.message || '';
  const original = String(err?.message || '');
  const detalle = graphMessage || original || fallback;

  if (/Faltan variables GRAPH_|Falta variable GRAPH_DRIVE_ID|GRAPH_DRIVE_TYPE inválido/i.test(detalle)) {
    return new HttpsError('failed-precondition', `Microsoft Graph no está configurado: ${detalle}`);
  }
  if (status === 401 || /InvalidAuthenticationToken|invalid_client|AADSTS/i.test(`${graphCode} ${detalle}`)) {
    return new HttpsError('failed-precondition', 'Microsoft Graph rechazó las credenciales. Revisa Tenant ID, Client ID y Client Secret en Firebase Secrets.');
  }
  if (status === 403 || /accessDenied|Authorization_RequestDenied/i.test(`${graphCode} ${detalle}`)) {
    return new HttpsError('permission-denied', 'La aplicación de Microsoft Entra no tiene permisos suficientes. Para OneDrive de usuario usa Files.ReadWrite.All (Application); para SharePoint usa Sites.ReadWrite.All o Sites.Selected, siempre con consentimiento de administrador.');
  }
  if (status === 404 || /itemNotFound|resourceNotFound/i.test(`${graphCode} ${detalle}`)) {
    return new HttpsError('not-found', 'No se encontró el OneDrive/SharePoint configurado. Revisa GRAPH_DRIVE_TYPE y GRAPH_DRIVE_ID.');
  }
  if (status === 412) {
    return new HttpsError('aborted', 'El elemento cambió en OneDrive durante la operación. Actualiza la carpeta e inténtalo nuevamente.');
  }
  if (/timeout|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(detalle)) {
    return new HttpsError('unavailable', 'No se pudo conectar con Microsoft Graph. Reintenta y revisa conectividad/configuración.');
  }
  return new HttpsError('internal', `${fallback}: ${detalle}`);
}

// ── MÓDULO NUBE ──
// Funciones para acceder a OneDrive/SharePoint via Microsoft Graph API.
// Usan client credentials (app-only) — no requieren que el usuario
// tenga sesión Microsoft, solo Firebase Auth.

// Listar carpetas y archivos. null siempre significa la raíz lógica asignada
// por rol; nunca la raíz física del drive.
exports.nubeListarCarpeta = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_TYPE', 'GRAPH_DRIVE_ID'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    const { carpetaId } = request.data || {};

    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      const idAutorizado = await verificarAccesoNube(contexto, carpetaId);
      let items = await listarCarpeta(idAutorizado);
      await verificarAccesoNube(contexto, idAutorizado);

      if (contexto.role === 'administrador' && contexto.confidencialId) {
        items = items.filter((item) => item.id !== contexto.confidencialId);
      }

      return { items };
    } catch (err) {
      console.error('Error en nubeListarCarpeta:', err.message);
      throw convertirErrorGraph(err, 'Error listando carpeta');
    }
  }
);

// Obtener link de descarga temporal de un archivo
exports.nubeObtenerLinkDescarga = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 15,
    memory: '128MiB',
    secrets: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_TYPE', 'GRAPH_DRIVE_ID'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    const { itemId } = request.data || {};

    if (!itemId) {
      throw new HttpsError('invalid-argument', 'itemId es requerido');
    }

    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      await verificarAccesoNube(contexto, itemId);
      const itemActual = await obtenerItem(itemId);
      await verificarAccesoNube(contexto, itemActual.id);
      const resultado = await obtenerLinkDescarga(itemActual.id, itemActual.eTag);
      return resultado;
    } catch (err) {
      console.error('Error en nubeObtenerLinkDescarga:', err.message);
      throw convertirErrorGraph(err, 'Error obteniendo link de descarga');
    }
  }
);

// ── Nube: control de acceso por rol ──
const GRAPH_SECRETS_NUBE = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_TYPE', 'GRAPH_DRIVE_ID'];
const RUTA_CONFIDENCIAL = 'NOOVA SAC/09. CONFIDENCIAL';
const ROLES_NUBE_RESTRINGIDA = new Set([
  'soporte_ti',
  'responsable_marketing',
  'jefe_proyecto_mina'
]);

function esNombreConfidencial(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase() === '09. CONFIDENCIAL';
}

async function obtenerContextoNube(uid) {
  const perfil = await exigirPermiso(uid, 'nube');
  const role = normalizarRol(perfil.role);
  const rutaRaiz = getCarpetaNubePerfil(perfil);

  if (!rutaRaiz) {
    throw new HttpsError('permission-denied', 'El rol no tiene una raíz lógica de Nube configurada');
  }

  const raiz = await obtenerCarpetaPorRuta(rutaRaiz);
  let confidencialId = null;

  if (role === 'administrador') {
    try {
      confidencialId = (await obtenerCarpetaPorRuta(RUTA_CONFIDENCIAL)).id;
    } catch (err) {
      if (Number(err?.response?.status || 0) !== 404) throw err;
    }
  }

  return {
    perfil,
    role,
    rutaRaiz,
    raizId: raiz.id,
    confidencialId
  };
}

async function verificarAccesoNube(contexto, itemId, { permitirRaiz = true } = {}) {
  const objetivoId = String(itemId || contexto.raizId).trim();

  try {
    const dentroDeRaiz = await estaDentroDeCarpeta(objetivoId, contexto.raizId);
    if (!dentroDeRaiz) {
      throw new HttpsError('permission-denied', 'No tienes acceso a ese elemento de Nube.');
    }

    if (!permitirRaiz && objetivoId === contexto.raizId) {
      throw new HttpsError('permission-denied', 'No puedes modificar la carpeta raíz asignada a tu rol.');
    }

    if (
      contexto.role === 'administrador'
      && contexto.confidencialId
      && await estaDentroDeCarpeta(objetivoId, contexto.confidencialId)
    ) {
      throw new HttpsError('permission-denied', 'No tienes acceso a ese elemento de Nube.');
    }

    return objetivoId;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (Number(err?.response?.status || 0) === 404) {
      throw new HttpsError('permission-denied', 'No tienes acceso a ese elemento de Nube.');
    }
    throw err;
  }
}

function verificarNombreReservado(contexto, padreId, nombre) {
  if (
    contexto.role === 'administrador'
    && padreId === contexto.raizId
    && esNombreConfidencial(nombre)
  ) {
    throw new HttpsError('permission-denied', 'No puedes crear ni renombrar la carpeta confidencial.');
  }
}

async function filtrarFueraDeCarpeta(items, carpetaBloqueadaId) {
  const permitidos = [];
  const TAMANO_LOTE = 5;

  for (let inicio = 0; inicio < items.length; inicio += TAMANO_LOTE) {
    const lote = items.slice(inicio, inicio + TAMANO_LOTE);
    const bloqueados = await Promise.all(
      lote.map((item) => estaDentroDeCarpeta(item.id, carpetaBloqueadaId))
    );

    lote.forEach((item, index) => {
      if (!bloqueados[index]) permitidos.push(item);
    });
  }

  return permitidos;
}

async function asegurarResultadoAutorizado(contexto, item) {
  try {
    await verificarAccesoNube(contexto, item?.id, { permitirRaiz: false });
  } catch (err) {
    if (item?.id) {
      try {
        await eliminarItem(item.id);
      } catch (cleanupError) {
        console.error('No se pudo revertir un elemento creado fuera de la raíz autorizada:', cleanupError.message);
      }
    }
    throw err;
  }
}

// Buscar documentos dentro de la raíz lógica asignada al rol.
exports.nubeBuscarDocumentos = onCall(
  { region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { termino } = request.data || {};
    if (!termino || termino.trim().length < 2) {
      throw new HttpsError('invalid-argument', 'El término de búsqueda debe tener al menos 2 caracteres');
    }
    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      let items = await buscarDocumentos(termino.trim(), contexto.raizId);

      if (contexto.role === 'administrador' && contexto.confidencialId) {
        items = await filtrarFueraDeCarpeta(items, contexto.confidencialId);
      }

      items = items.map(({ _rutaPadreCompleta, _parentId, ...resto }) => resto);
      return { items };
    } catch (err) {
      console.error('Error en nubeBuscarDocumentos:', err.message);
      throw convertirErrorGraph(err, 'Error buscando documentos');
    }
  }
);

exports.nubeObtenerContexto = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      return {
        carpetaArea: ROLES_NUBE_RESTRINGIDA.has(contexto.role)
          ? contexto.rutaRaiz
          : null,
        carpetaRaiz: contexto.rutaRaiz,
        carpetaId: contexto.raizId
      };
    } catch (err) {
      console.error('Error en nubeObtenerContexto:', err.message);
      throw convertirErrorGraph(err, 'Error obteniendo el contexto de Nube');
    }
  }
);

// Crear carpeta
exports.nubeCrearCarpeta = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { carpetaPadreId, nombre } = request.data || {};
    if (!nombre || !nombre.trim()) throw new HttpsError('invalid-argument', 'El nombre de la carpeta es requerido');

    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      const padreId = await verificarAccesoNube(contexto, carpetaPadreId);
      verificarNombreReservado(contexto, padreId, nombre);
      const item = await crearCarpeta(padreId, nombre.trim());
      await asegurarResultadoAutorizado(contexto, item);
      return { item };
    } catch (err) {
      console.error('Error en nubeCrearCarpeta:', err.message);
      throw convertirErrorGraph(err, 'Error creando la carpeta');
    }
  }
);

// Subir archivo (< 4MB, subida directa en base64)
exports.nubeSubirArchivo = onCall(
  { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { carpetaPadreId, nombre, contenidoBase64, mimeType } = request.data || {};
    if (!nombre || !contenidoBase64) {
      throw new HttpsError('invalid-argument', 'nombre y contenidoBase64 son requeridos');
    }

    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      const padreId = await verificarAccesoNube(contexto, carpetaPadreId);
      const item = await subirArchivo(padreId, nombre, contenidoBase64, mimeType);
      await asegurarResultadoAutorizado(contexto, item);
      return { item };
    } catch (err) {
      console.error('Error en nubeSubirArchivo:', err.message);
      throw convertirErrorGraph(err, 'Error subiendo el archivo');
    }
  }
);

// Renombrar carpeta o archivo
exports.nubeRenombrarItem = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { itemId, nuevoNombre } = request.data || {};
    if (!itemId || !nuevoNombre || !nuevoNombre.trim()) {
      throw new HttpsError('invalid-argument', 'itemId y nuevoNombre son requeridos');
    }
    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      await verificarAccesoNube(contexto, itemId, { permitirRaiz: false });
      const itemActual = await obtenerItem(itemId);
      verificarNombreReservado(
        contexto,
        itemActual.parentReference?.id || null,
        nuevoNombre
      );
      await verificarAccesoNube(contexto, itemActual.id, { permitirRaiz: false });
      const item = await renombrarItem(itemId, nuevoNombre.trim(), itemActual.eTag);
      await verificarAccesoNube(contexto, item.id, { permitirRaiz: false });
      return { item };
    } catch (err) {
      console.error('Error en nubeRenombrarItem:', err.message);
      throw convertirErrorGraph(err, 'Error renombrando el elemento');
    }
  }
);

// Eliminar carpeta o archivo
exports.nubeEliminarItem = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { itemId } = request.data || {};
    if (!itemId) throw new HttpsError('invalid-argument', 'itemId es requerido');
    try {
      const contexto = await obtenerContextoNube(request.auth.uid);
      await verificarAccesoNube(contexto, itemId, { permitirRaiz: false });
      const itemActual = await obtenerItem(itemId);
      await verificarAccesoNube(contexto, itemActual.id, { permitirRaiz: false });
      await eliminarItem(itemActual.id, itemActual.eTag);
      return { eliminado: true };
    } catch (err) {
      console.error('Error en nubeEliminarItem:', err.message);
      throw convertirErrorGraph(err, 'Error eliminando el elemento');
    }
  }
);

// ── Solicitudes de cotización a proveedores: CRUD ──
// Todas las operaciones pasan por Admin SDK para no exigir cambios de reglas
// Firestore en el ERP productivo anterior.
function normalizarSolicitudProveedor(data = {}) {
  const tipo = textoSeguro(data.tipo || 'Otro', 80);
  const proveedorId = textoSeguro(data.proveedorId, 150);
  const proveedorNombre = textoSeguro(data.proveedorNombre, 250);
  const proveedorEmail = textoSeguro(data.proveedorEmail, 250).toLowerCase();
  const fechaLimite = textoSeguro(data.fechaLimite, 30);
  const detalle = textoSeguro(data.detalle, 5000);
  if (!proveedorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedorEmail)) {
    throw new HttpsError('invalid-argument', 'El correo del proveedor no es válido');
  }
  if (!detalle) throw new HttpsError('invalid-argument', 'El detalle de la solicitud es obligatorio');
  return { tipo, proveedorId, proveedorNombre, proveedorEmail, fechaLimite, detalle };
}

exports.solicitudesCotizacionListar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const snap = await db.collection('solicitudesCotizacion').orderBy('createdAt', 'desc').get();
    return { solicitudes: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

exports.solicitudCotizacionCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const perfil = await exigirPermiso(request.auth.uid, 'compras');
    const solicitud = normalizarSolicitudProveedor(request.data?.solicitud || {});
      const contadorRef = db.collection('contadores').doc('solicitudesCotizacion');
    const ref = db.collection('solicitudesCotizacion').doc();
    const anio = new Date().getFullYear();
    return db.runTransaction(async (tx) => {
      const contadorSnap = await tx.get(contadorRef);
      const contador = contadorSnap.exists ? contadorSnap.data() : {};
      const actual = contador.anio === anio ? (Number(contador.ultimo) || 0) : 0;
      const siguiente = actual + 1;
      const codigo = `SC-${anio}-${String(siguiente).padStart(4, '0')}`;
      const ahora = new Date().toISOString();
      tx.set(contadorRef, { anio, ultimo: siguiente, updatedAt: ahora }, { merge: true });
      tx.create(ref, {
        ...solicitud,
        codigo,
        estado: 'Borrador',
        historialEnvios: [],
        creadoPorUid: request.auth.uid,
        creadoPorNombre: perfil.nombre || request.auth.token?.email || request.auth.uid,
        createdAt: ahora,
        updatedAt: ahora
      });
      return { id: ref.id, codigo };
    });
  }
);

exports.solicitudCotizacionActualizar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const { id, solicitud: entrada } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id es requerido');
    const solicitud = normalizarSolicitudProveedor(entrada || {});
    const ref = db.collection('solicitudesCotizacion').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'La solicitud no existe');
    await ref.update({ ...solicitud, updatedAt: new Date().toISOString() });
    return { actualizado: true };
  }
);

exports.solicitudCotizacionEliminar = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    await exigirPermiso(request.auth.uid, 'compras');
    const { id } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id es requerido');
    const ref = db.collection('solicitudesCotizacion').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return { eliminado: true };
    await ref.delete();
    return { eliminado: true };
  }
);

// ── Solicitudes de cotización a proveedores ──
// Enviamos NOSOTROS una solicitud de cotización (OC / pedido de precios) a
// un proveedor externo por correo, vía Microsoft Graph. Gratuito: usa el
// buzón de Microsoft 365 ya configurado (GRAPH_MAIL_SENDER), sin límites
// propios ni servicios de pago de terceros.
exports.solicitudCotizacionEnviarCorreo = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_MAIL_SENDER'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    await exigirPermiso(request.auth.uid, 'compras');

    const { solicitudId, destinatarios, cc, asunto, cuerpoHtml } = request.data || {};

    if (!solicitudId) {
      throw new HttpsError('invalid-argument', 'solicitudId es requerido');
    }
    if (!destinatarios || (Array.isArray(destinatarios) && destinatarios.length === 0)) {
      throw new HttpsError('invalid-argument', 'destinatarios es requerido');
    }
    if (!asunto || !cuerpoHtml) {
      throw new HttpsError('invalid-argument', 'asunto y cuerpoHtml son requeridos');
    }

      const docRef = db.collection('solicitudesCotizacion').doc(solicitudId);

    try {
      const resultado = await enviarCorreo({ destinatarios, cc, asunto, cuerpoHtml });

      const ahora = new Date().toISOString();
      await docRef.update({
        estado: 'Enviada',
        updatedAt: ahora,
        historialEnvios: FieldValue.arrayUnion({
          fecha: ahora,
          destinatarios: Array.isArray(destinatarios) ? destinatarios : [destinatarios],
          cc: cc || [],
          asunto,
          enviadoPor: request.auth.token?.email || request.auth.uid
        })
      });

      return resultado;
    } catch (err) {
      console.error('Error en solicitudCotizacionEnviarCorreo:', err.message);
      throw new HttpsError('internal', err.message || 'Error enviando el correo');
    }
  }
);

async function esGestorUsuarios(uid) {
  await exigirSeccionConfiguracion(uid, 'usuarios');
  return true;
}

// Crea el usuario en Firebase Auth + su perfil en Firestore.
// Requiere Admin SDK: por eso va como Cloud Function y no como escritura
// directa desde el cliente (crear un usuario de Auth desde el navegador
// además obligaría a iniciar sesión con esa cuenta nueva).
exports.usuariosCrear = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    if (!(await esGestorUsuarios(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar usuarios');
    }

    const { email, password, nombre, cargo, telefono, role } = request.data || {};
    if (!email || !password || !nombre || !role) {
      throw new HttpsError('invalid-argument', 'email, password, nombre y role son requeridos');
    }
    const roleNormalizado = normalizarRol(role);
    if (!esRolValido(roleNormalizado)) {
      throw new HttpsError('invalid-argument', 'El rol seleccionado no es válido');
    }
    if (password.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres');
    }

    try {
      const userRecord = await getAuth().createUser({
        email: email.trim(),
        password,
        displayName: nombre.trim()
      });

      const ahora = new Date().toISOString();
      const area = getAreaPredeterminada(roleNormalizado);
      const perfil = {
        email: email.trim(),
        nombre: nombre.trim(),
        cargo: cargo || '',
        telefono: telefono || '',
        role: roleNormalizado,
        area,
        sector: getNombreArea(area),
        activo: true,
        createdAt: ahora,
        updatedAt: ahora
      };
      await db.collection('users').doc(userRecord.uid).set(perfil);

      return { uid: userRecord.uid, ...perfil };
    } catch (err) {
      console.error('Error en usuariosCrear:', err.message);
      if (err.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Ya existe un usuario con ese correo');
      }
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error creando el usuario');
    }
  }
);

// Restablece la contraseña de un usuario existente (evita que Gerencia/
// Sistemas tenga que saber la contraseña anterior o usar la consola de Firebase).
exports.usuariosResetearPassword = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    if (!(await esGestorUsuarios(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar usuarios');
    }
    const { uid, nuevaPassword } = request.data || {};
    if (!uid || !nuevaPassword || nuevaPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'uid y una nuevaPassword de al menos 6 caracteres son requeridos');
    }
    try {
      await getAuth().updateUser(uid, { password: nuevaPassword });
      return { actualizado: true };
    } catch (err) {
      console.error('Error en usuariosResetearPassword:', err.message);
      throw new HttpsError('internal', err.message || 'Error reseteando la contraseña');
    }
  }
);

// Desactiva o reactiva un usuario (bloquea/permite su acceso al ERP sin
// borrar su cuenta ni su historial). AuthContext ya cierra la sesión
// automáticamente si detecta activo:false en el perfil.
exports.usuariosCambiarEstado = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    if (!(await esGestorUsuarios(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar usuarios');
    }
    const { uid, activo } = request.data || {};
    if (!uid || typeof activo !== 'boolean') {
      throw new HttpsError('invalid-argument', 'uid y activo (boolean) son requeridos');
    }
    try {
      await getAuth().updateUser(uid, { disabled: !activo });
      await db.collection('users').doc(uid).update({ activo, updatedAt: new Date().toISOString() });
      return { actualizado: true };
    } catch (err) {
      console.error('Error en usuariosCambiarEstado:', err.message);
      throw new HttpsError('internal', err.message || 'Error actualizando el estado del usuario');
    }
  }
);

// ── Limpieza automática de auditoría ──
// Corre sola una vez por semana y borra los logs de más de 7 días, para que
// la colección `logs` no crezca sin límite. Usa el Admin SDK (no pasa por
// las reglas de Firestore, que hoy bloquean el borrado desde el cliente).
const LOGS_RETENCION_DIAS = 7;

exports.limpiarLogsAntiguos = onSchedule(
  { schedule: '0 3 * * 0', timeZone: 'America/Lima', region: 'us-central1', memory: '256MiB' },
  async () => {
    const corte = new Date();
    corte.setDate(corte.getDate() - LOGS_RETENCION_DIAS);
    const corteIso = corte.toISOString();

    let totalBorrados = 0;
    while (true) {
      const snapshot = await db.collection('logs')
        .where('createdAt', '<', corteIso)
        .limit(400)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      totalBorrados += snapshot.size;
      if (snapshot.size < 400) break;
    }

    console.log(`limpiarLogsAntiguos: ${totalBorrados} logs eliminados (anteriores a ${corteIso})`);
  }
);

// ── Backup diario de la base de datos ──
// Corre sola todos los días y exporta toda Firestore a un bucket de Cloud
// Storage. Es una operación asíncrona administrada por Google (el export
// real sigue corriendo aunque esta función ya haya terminado).
// Requiere la variable de entorno BACKUP_BUCKET (ver ONEDRIVE_SETUP.md /
// documentación de despliegue para cómo configurarla).
const { v1: FirestoreAdminV1 } = require('@google-cloud/firestore');

exports.backupFirestoreDiario = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Lima', region: 'us-central1', memory: '256MiB', timeoutSeconds: 300 },
  async () => {
    const bucket = process.env.BACKUP_BUCKET;
    if (!bucket) {
      throw new Error('Falta la variable de entorno BACKUP_BUCKET (bucket de Cloud Storage donde guardar los backups)');
    }

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const client = new FirestoreAdminV1.FirestoreAdminClient();
    const databaseName = client.databasePath(projectId, '(default)');
    const fecha = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `gs://${bucket}/backups/${fecha}`;

    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      collectionIds: []
    });

    console.log(`backupFirestoreDiario: exportación iniciada -> ${outputUriPrefix}`, operation.name || operation);
  }
);
