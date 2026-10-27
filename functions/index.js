const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { generarXmlUBL, SIG_ID } = require('./src/generarXml');
const { firmarXml } = require('./src/firmarXml');
const { enviarASunat } = require('./src/sunatClient');
const { validarRuc, consultarRucCompleto } = require('./src/consultarRuc');
const {
  listarCarpeta,
  obtenerCarpetaPorRuta, obtenerItem, crearCarpeta, subirArchivo,
  renombrarItem, eliminarItem, estaDentroDeCarpeta, buscarDocumentos,
  listarArchivosPublicacionCarpeta
} = require('./src/graph/graphDriveProvider');
const {
  normalizarRol,
  esRolValido,
  getAreaPredeterminada,
  getNombreArea,
  getCarpetaNubePerfil,
  crearAccessControl
} = require('./src/accessControl');
const AdmZip = require('adm-zip');

const TIPO_DOC_COD = { 'Factura': '01', 'Boleta': '03', 'Nota de Crédito': '07' };

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const {
  obtenerPerfilActivo,
  exigirPermiso,
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
      console.log('Generando XML...');
      const facturaConOperacion = {
        ...facturaData,
        tipoOperacion: facturaData.tipoOperacion || facturaData.operacion || '0101',
      };
      const xmlString = generarXmlUBL(facturaConOperacion, empresaData);
      console.log('XML generado (longitud):', xmlString.length);

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

      const tipoDocCod = TIPO_DOC_COD[facturaData.tipo] || '01';
      const esFactura = tipoDocCod === '01';
      const nombreArchivo = `${empresaData.ruc}-${tipoDocCod}-${facturaData.serie}-${facturaData.numero}`;
      console.log('Nombre archivo:', nombreArchivo);

      const zipBuffer = crearZip(xmlFirmado, `${nombreArchivo}.xml`);
      console.log('ZIP creado (tamaño en bytes):', zipBuffer.length);

      const esBeta = process.env.SUNAT_ENV !== 'produccion';
      console.log(`${simulate ? 'SIMULANDO envío a' : 'Enviando a'} SUNAT ${esBeta ? 'BETA' : 'PRODUCCIÓN'}...`);
      const respuestaSunat = await enviarASunat(zipBuffer, nombreArchivo, empresaData.ruc, esBeta, esFactura, simulate);
      console.log('Respuesta SUNAT:', JSON.stringify(respuestaSunat));

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

const GRAPH_SECRETS_NUBE = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_TYPE', 'GRAPH_DRIVE_ID'];

// ── MÓDULO MARKETING ──
// Publicaciones: imágenes de la carpeta de borradores IA en SharePoint, solo lectura.
const RUTA_PUBLICACIONES = 'NOOVA SAC/04. MARKETING/BORRADORES IA';

function detectarRedSocial(nombreCarpeta) {
  const nombre = String(nombreCarpeta || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

  if (/facebook|^fb$/.test(nombre)) return 'facebook';
  if (/instagram|^ig$/.test(nombre)) return 'instagram';
  if (/linkedin/.test(nombre)) return 'linkedin';
  return null;
}

exports.marketingListarPublicaciones = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }
    await exigirPermiso(request.auth.uid, 'marketing');

    try {
      const carpeta = await obtenerCarpetaPorRuta(RUTA_PUBLICACIONES);
      const hijos = await listarCarpeta(carpeta.id);

      // Cada subcarpeta de red social (FACEBOOK, INSTAGRAM/IG, LINKEDIN) aporta
      // sus imágenes con la red asignada. Las sueltas en la raíz quedan sin red.
      const carpetasRed = hijos
        .filter((hijo) => hijo.tipo === 'carpeta')
        .map((hijo) => ({ id: hijo.id, red: detectarRedSocial(hijo.nombre) }))
        .filter((hijo) => hijo.red);

      const grupos = await Promise.all([
        listarArchivosPublicacionCarpeta(carpeta.id).then((imgs) => imgs.map((img) => ({ ...img, red: null }))),
        ...carpetasRed.map(({ id, red }) =>
          listarArchivosPublicacionCarpeta(id).then((imgs) => imgs.map((img) => ({ ...img, red })))
        )
      ]);

      const items = grupos
        .flat()
        .sort((a, b) => String(b.fechaModificacion).localeCompare(String(a.fechaModificacion)));
      return { items };
    } catch (err) {
      console.error('Error en marketingListarPublicaciones:', err.message);
      throw convertirErrorGraph(err, 'Error listando publicaciones');
    }
  }
);
const RUTA_CONFIDENCIAL = 'NOOVA SAC/09. CONFIDENCIAL';
// Las observaciones se administran mediante funciones: el cliente no decide
// el autor ni la fecha, y las reglas deniegan el acceso directo a la colección.
async function contextoObservacionMarketing(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
  const perfil = await exigirPermiso(request.auth.uid, 'marketing');
  const publicacionId = request.data?.publicacionId;
  if (typeof publicacionId !== 'string' || !/^[a-zA-Z0-9!._-]{1,300}$/.test(publicacionId) || ['.', '..'].includes(publicacionId)) {
    throw new HttpsError('invalid-argument', 'La publicación no es válida.');
  }

  const carpeta = await obtenerCarpetaPorRuta(RUTA_PUBLICACIONES);
  if (!await estaDentroDeCarpeta(publicacionId, carpeta.id)) {
    throw new HttpsError('permission-denied', 'El archivo no pertenece a Publicaciones.');
  }
  const item = await obtenerItem(publicacionId);
  if (!item.file || !(/^image\//i.test(item.file.mimeType || '') || item.file.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.name))) {
    throw new HttpsError('invalid-argument', 'Solo puedes observar imágenes o PDF de Publicaciones.');
  }
  return {
    perfil,
    notas: db.collection('marketingPublicaciones').doc(publicacionId).collection('observaciones')
  };
}

exports.marketingListarObservaciones = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    const { notas } = await contextoObservacionMarketing(request);
    const snapshot = await notas.orderBy('fecha', 'desc').get();
    return { items: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) };
  }
);

exports.marketingCrearObservacion = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const texto = request.data?.texto;
    if (typeof texto !== 'string' || !texto.trim() || texto.length > 500) {
      throw new HttpsError('invalid-argument', 'Escribe una observación de entre 1 y 500 caracteres.');
    }
    const solicitudId = request.data?.solicitudId;
    if (typeof solicitudId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(solicitudId)) {
      throw new HttpsError('invalid-argument', 'La solicitud de observación no es válida.');
    }
    const { perfil, notas } = await contextoObservacionMarketing(request);
    const referencia = notas.doc(solicitudId);
    // La misma solicitud no crea dos notas si se reintenta tras un fallo de red.
    const item = await db.runTransaction(async (transaction) => {
      const anterior = await transaction.get(referencia);
      if (anterior.exists) {
        const guardada = anterior.data();
        if (guardada.usuarioUid !== request.auth.uid || guardada.texto !== texto.trim()) {
          throw new HttpsError('already-exists', 'Esta solicitud ya fue utilizada.');
        }
        return { ...guardada, id: referencia.id };
      }
      const observacion = {
        texto: texto.trim(),
        usuarioUid: request.auth.uid,
        usuarioNombre: textoSeguro(perfil.nombre || request.auth.token?.name || request.auth.token?.email || 'Usuario', 150),
        fecha: new Date().toISOString()
      };
      transaction.create(referencia, observacion);
      return { ...observacion, id: referencia.id };
    });
    return { item };
  }
);

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

async function esGestorUsuarios(uid) {
  await exigirSeccionConfiguracion(uid, 'usuarios');
  return true;
}

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

exports.limpiarLogsAntiguos = onSchedule(
  { schedule: '0 3 * * 0', timeZone: 'America/Lima', region: 'us-central1', memory: '256MiB' },
  async () => {
    const corteIso = new Date().toISOString();

    let totalBorrados = 0;
    while (true) {
      const snapshot = await db.collection('logs')
        .where('createdAt', '<=', corteIso)
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

    console.log(`limpiarLogsAntiguos: limpieza semanal completa, ${totalBorrados} logs eliminados (hasta ${corteIso})`);
  }
);

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
