const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { generarXmlUBL, SIG_ID } = require('./src/generarXml');
const { firmarXml } = require('./src/firmarXml');
const { enviarASunat } = require('./src/sunatClient');
const { validarRuc, consultarRucCompleto } = require('./src/consultarRuc');
const {
  listarCarpeta, obtenerLinkDescarga, listarCarpetaPorRuta,
  obtenerOCrearCarpetaRaizArea, crearCarpeta, subirArchivo,
  renombrarItem, eliminarItem, estaDentroDeArea, buscarDocumentos
} = require('./src/graph/graphDriveProvider');
const { enviarCorreo } = require('./src/graph/graphMailProvider');
const AdmZip = require('adm-zip');

const TIPO_DOC_COD = { 'Factura': '01', 'Boleta': '03', 'Nota de Crédito': '07' };

if (!admin.apps.length) {
  admin.initializeApp();
}

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

    const db = admin.firestore();
    let respuestaSunat = null;

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
      respuestaSunat = await enviarASunat(zipBuffer, nombreArchivo, empresaData.ruc, esBeta, esFactura, simulate);
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

// ── MÓDULO NUBE ──
// Funciones para acceder a OneDrive/SharePoint via Microsoft Graph API.
// Usan client credentials (app-only) — no requieren que el usuario
// tenga sesión Microsoft, solo Firebase Auth.

// Listar carpetas y archivos de una carpeta (null = raíz)
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
      await verificarAccesoNube(request.auth.uid, carpetaId || null);
      const items = await listarCarpeta(carpetaId || null);
      return { items };
    } catch (err) {
      console.error('Error en nubeListarCarpeta:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error listando carpeta');
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
      await verificarAccesoNube(request.auth.uid, itemId);
      const resultado = await obtenerLinkDescarga(itemId);
      return resultado;
    } catch (err) {
      console.error('Error en nubeObtenerLinkDescarga:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error obteniendo link de descarga');
    }
  }
);

// ── Nube: control de acceso por rol ──
// Debe reflejar exactamente el mapa `ROLES` de src/services/userService.js
// (campo nubeCarpeta). null = acceso completo al drive; un nombre de
// carpeta = el rol queda restringido a esa carpeta (y subcarpetas).
const NUBE_CARPETA_POR_ROL = {
  administrador: null,
  gerencia: null,
  comercial: null,
  operaciones: 'Operaciones',
  marketing: 'Marketing',
  sistemas: 'Sistemas',
  ing_minas: 'Ingeniería de Minas'
};

async function obtenerCarpetaAreaDeUsuario(uid) {
  const db = admin.firestore();
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.exists ? (snap.data().role || 'comercial') : 'comercial';
  return NUBE_CARPETA_POR_ROL[role] ?? null;
}

const GRAPH_SECRETS_NUBE = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_TYPE', 'GRAPH_DRIVE_ID'];

// Devuelve al frontend si el usuario está restringido a una carpeta de área
// y, de ser así, el ID de esa carpeta (creándola en el drive si no existe).
// Buscar documentos en el drive (restringido a su área si el rol aplica)
exports.nubeBuscarDocumentos = onCall(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { termino } = request.data || {};
    if (!termino || termino.trim().length < 2) {
      throw new HttpsError('invalid-argument', 'El término de búsqueda debe tener al menos 2 caracteres');
    }
    try {
      const carpetaArea = await obtenerCarpetaAreaDeUsuario(request.auth.uid);
      let items = await buscarDocumentos(termino.trim());
      if (carpetaArea) {
        items = items.filter((it) =>
          it._rutaPadreCompleta === carpetaArea || it._rutaPadreCompleta?.startsWith(`${carpetaArea}/`)
        );
      }
      items = items.map(({ _rutaPadreCompleta, ...resto }) => resto);
      return { items };
    } catch (err) {
      console.error('Error en nubeBuscarDocumentos:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error buscando documentos');
    }
  }
);

exports.nubeObtenerContexto = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    try {
      const carpetaArea = await obtenerCarpetaAreaDeUsuario(request.auth.uid);
      if (!carpetaArea) return { carpetaArea: null, carpetaId: null };
      const carpetaId = await obtenerOCrearCarpetaRaizArea(carpetaArea);
      return { carpetaArea, carpetaId };
    } catch (err) {
      console.error('Error en nubeObtenerContexto:', err.message);
      throw new HttpsError('internal', err.message || 'Error obteniendo el contexto de Nube');
    }
  }
);

// Verifica que, si el usuario tiene un rol restringido, el itemId objetivo
// esté dentro de su carpeta de área. Lanza HttpsError si no.
async function verificarAccesoNube(uid, itemId) {
  const carpetaArea = await obtenerCarpetaAreaDeUsuario(uid);
  if (!carpetaArea) return; // acceso completo
  if (!itemId) {
    throw new HttpsError('permission-denied', 'Tu rol solo tiene acceso a la carpeta de tu área.');
  }
  const dentro = await estaDentroDeArea(itemId, carpetaArea);
  if (!dentro) {
    throw new HttpsError('permission-denied', 'No tienes acceso a esa carpeta.');
  }
}

// Crear carpeta
exports.nubeCrearCarpeta = onCall(
  { region: 'us-central1', timeoutSeconds: 20, memory: '256MiB', secrets: GRAPH_SECRETS_NUBE },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado');
    const { carpetaPadreId, nombre } = request.data || {};
    if (!nombre || !nombre.trim()) throw new HttpsError('invalid-argument', 'El nombre de la carpeta es requerido');

    try {
      let padreId = carpetaPadreId || null;
      const carpetaArea = await obtenerCarpetaAreaDeUsuario(request.auth.uid);
      if (carpetaArea) {
        // Rol restringido: si no manda padre, se crea en la raíz de su área;
        // si manda uno, se verifica que esté dentro de su área.
        padreId = padreId || await obtenerOCrearCarpetaRaizArea(carpetaArea);
        await verificarAccesoNube(request.auth.uid, padreId);
      }
      const item = await crearCarpeta(padreId, nombre.trim());
      return { item };
    } catch (err) {
      console.error('Error en nubeCrearCarpeta:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error creando la carpeta');
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
      let padreId = carpetaPadreId || null;
      const carpetaArea = await obtenerCarpetaAreaDeUsuario(request.auth.uid);
      if (carpetaArea) {
        padreId = padreId || await obtenerOCrearCarpetaRaizArea(carpetaArea);
        await verificarAccesoNube(request.auth.uid, padreId);
      }
      const item = await subirArchivo(padreId, nombre, contenidoBase64, mimeType);
      return { item };
    } catch (err) {
      console.error('Error en nubeSubirArchivo:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error subiendo el archivo');
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
      await verificarAccesoNube(request.auth.uid, itemId);
      const item = await renombrarItem(itemId, nuevoNombre.trim());
      return { item };
    } catch (err) {
      console.error('Error en nubeRenombrarItem:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error renombrando el elemento');
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
      await verificarAccesoNube(request.auth.uid, itemId);
      await eliminarItem(itemId);
      return { eliminado: true };
    } catch (err) {
      console.error('Error en nubeEliminarItem:', err.message);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Error eliminando el elemento');
    }
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
    secrets: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_DRIVE_ID', 'GRAPH_MAIL_SENDER'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'No autenticado');
    }

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

    const db = admin.firestore();
    const docRef = db.collection('solicitudesCotizacion').doc(solicitudId);

    try {
      const resultado = await enviarCorreo({ destinatarios, cc, asunto, cuerpoHtml });

      const ahora = new Date().toISOString();
      await docRef.update({
        estado: 'Enviada',
        updatedAt: ahora,
        historialEnvios: admin.firestore.FieldValue.arrayUnion({
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

// ── Gestión de usuarios y roles (Administrador, Gerencia y Sistemas) ──
const ROLES_GESTOR_USUARIOS = ['administrador', 'gerencia', 'sistemas'];

async function esGestorUsuarios(uid) {
  const db = admin.firestore();
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.exists ? snap.data().role : null;
  return ROLES_GESTOR_USUARIOS.includes(role);
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
    if (password.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres');
    }

    try {
      const userRecord = await admin.auth().createUser({
        email: email.trim(),
        password,
        displayName: nombre.trim()
      });

      const ahora = new Date().toISOString();
      const perfil = {
        email: email.trim(),
        nombre: nombre.trim(),
        cargo: cargo || '',
        telefono: telefono || '',
        role,
        activo: true,
        createdAt: ahora,
        updatedAt: ahora
      };
      await admin.firestore().collection('users').doc(userRecord.uid).set(perfil);

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
      await admin.auth().updateUser(uid, { password: nuevaPassword });
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
      await admin.auth().updateUser(uid, { disabled: !activo });
      await admin.firestore().collection('users').doc(uid).update({ activo, updatedAt: new Date().toISOString() });
      return { actualizado: true };
    } catch (err) {
      console.error('Error en usuariosCambiarEstado:', err.message);
      throw new HttpsError('internal', err.message || 'Error actualizando el estado del usuario');
    }
  }
);
