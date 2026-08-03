const { post } = require('./graphClient');

// Envío de correo saliente vía Microsoft Graph (endpoint /users/{id}/sendMail).
// Usa la misma app-only auth (client credentials) que ya usa el módulo Nube,
// por lo tanto no requiere ningún servicio de terceros ni costo adicional:
// se envía desde el buzón de Microsoft 365 configurado en GRAPH_MAIL_SENDER
// (o GRAPH_DRIVE_ID como respaldo), sin límites propios más allá de los
// que ya tenga la cuenta de correo de la empresa.

function buzonRemitente() {
  const remitente = process.env.GRAPH_MAIL_SENDER || process.env.GRAPH_DRIVE_ID;
  if (!remitente) {
    throw new Error('Falta variable GRAPH_MAIL_SENDER (o GRAPH_DRIVE_ID) con el correo remitente.');
  }
  return remitente;
}

function aDestinatarios(lista = []) {
  return (Array.isArray(lista) ? lista : [lista])
    .filter(Boolean)
    .map((email) => ({ emailAddress: { address: String(email).trim() } }));
}

// adjuntos: [{ nombre, contenidoBase64, tipoContenido }]
async function enviarCorreo({ destinatarios, cc = [], asunto, cuerpoHtml, adjuntos = [] }) {
  const paraLista = aDestinatarios(destinatarios);
  if (paraLista.length === 0) {
    throw new Error('Debe indicar al menos un destinatario');
  }

  const mensaje = {
    subject: asunto || '(sin asunto)',
    body: {
      contentType: 'HTML',
      content: cuerpoHtml || ''
    },
    toRecipients: paraLista,
    ccRecipients: aDestinatarios(cc)
  };

  if (adjuntos.length > 0) {
    mensaje.attachments = adjuntos.map((adj) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: adj.nombre,
      contentType: adj.tipoContenido || 'application/octet-stream',
      contentBytes: adj.contenidoBase64
    }));
  }

  const remitente = buzonRemitente();
  await post(`/users/${encodeURIComponent(remitente)}/sendMail`, {
    message: mensaje,
    saveToSentItems: true
  });

  return { enviado: true, remitente };
}

module.exports = { enviarCorreo };
