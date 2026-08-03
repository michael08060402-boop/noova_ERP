const https = require('https');
const AdmZip = require('adm-zip');

const ENDPOINTS_BETA = {
  factura: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
  boleta:  'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
};
const ENDPOINTS_PROD = {
  factura: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
  boleta:  'https://e-factura.sunat.gob.pe/ol-ti-itcpbem/billService',
};

const CREDENCIALES_BETA = {
  usuario: '20000000001MODDATOS',
  password: 'moddatos',
};

async function enviarASunat(zipBuffer, nombreArchivo, rucEmisor, esBeta = true, esFactura = true, simulate = false) {
  if (simulate) {
    console.log('[SIMULACIÓN] SUNAT devuelve aceptación automática.');
    return {
      estado: 'ACEPTADA',
      codigo: '0',
      mensaje: 'SIMULACIÓN: Comprobante aceptado (sin conexión real a SUNAT)',
      descripcionError: null,
      cdrBase64: null,
    };
  }

  const endpoints  = esBeta ? ENDPOINTS_BETA : ENDPOINTS_PROD;
  const serviceUrl = esFactura ? endpoints.factura : endpoints.boleta;

  const credenciales = esBeta
    ? CREDENCIALES_BETA
    : {
        usuario:  `${rucEmisor}SOL`,
        password: process.env.SUNAT_SOL_PASS || '',
      };

  const zipBase64 = zipBuffer.toString('base64');

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${credenciales.usuario}</wsse:Username>
        <wsse:Password>${credenciales.password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ser:sendBill>
      <fileName>${nombreArchivo}.zip</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendBill>
  </soap:Body>
</soap:Envelope>`;

  try {
    const respuesta = await httpPost(serviceUrl, soapEnvelope, {
      Authorization: basicAuth(credenciales),
    });

    if (respuesta.status >= 400) {
      const faultCode   = extraerTag(respuesta.body, 'faultcode')   || `HTTP_${respuesta.status}`;
      const faultString = extraerTag(respuesta.body, 'faultstring') || `HTTP Error ${respuesta.status}`;
      throw new Error(`SUNAT ${esBeta ? 'BETA' : 'PROD'} [${faultCode}]: ${faultString}`);
    }

    const applicationResponse = extraerTag(respuesta.body, 'applicationResponse');

    if (applicationResponse) {
      const cdrZip = Buffer.from(applicationResponse.trim(), 'base64');
      const { codigo, descripcion } = extraerRespuestaCDR(cdrZip);

      return {
        estado:    codigo === '0' ? 'ACEPTADA' : 'RECHAZADA',
        codigo:    codigo,
        mensaje:   codigo === '0'
          ? `Comprobante aceptado por SUNAT ${esBeta ? '(BETA)' : ''}`
          : `Rechazado con código SUNAT: ${codigo}${descripcion ? ' — ' + descripcion : ''}`,
        descripcionError: descripcion,
        cdrBase64: applicationResponse.trim(),
      };
    }

    const faultCode   = extraerTag(respuesta.body, 'faultcode');
    const faultString = extraerTag(respuesta.body, 'faultstring');
    if (faultCode) {
      throw new Error(`SUNAT ${esBeta ? 'BETA' : 'PROD'} [${faultCode}]: ${faultString}`);
    }

    return { estado: 'ERROR', mensaje: 'SUNAT no devolvió applicationResponse.', codigo: null };

  } catch (err) {
    if (err.message.startsWith('SUNAT')) throw err;
    throw new Error(`Error de conexión con SUNAT: ${err.message}`);
  }
}

// HELPERS

function basicAuth({ usuario, password }) {
  return 'Basic ' + Buffer.from(`${usuario}:${password}`).toString('base64');
}

function extraerTag(xml, tag) {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extraerRespuestaCDR(cdrZipBuffer) {
  try {
    const zip     = new AdmZip(cdrZipBuffer);
    const entries = zip.getEntries();
    if (entries.length > 0) {
      const xmlCdr = entries[0].getData().toString('utf8');
      const codigo = extraerTag(xmlCdr, 'ResponseCode') || '0';
      const descripcion = extraerTag(xmlCdr, 'Description') || null;
      return { codigo, descripcion };
    }
    return { codigo: '0', descripcion: null };
  } catch {
    return { codigo: '0', descripcion: null };
  }
}

function httpPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyBuffer = Buffer.from(body, 'utf8');

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""',
        'Content-Length': bodyBuffer.length,
        ...extraHeaders,
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout al conectar con SUNAT'));
    });

    req.write(bodyBuffer);
    req.end();
  });
}

module.exports = { enviarASunat };
