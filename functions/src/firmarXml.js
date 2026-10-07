const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

async function firmarXml(xmlString, certBase64, certPass, sigId = 'IDSignNOOVA') {
  const p12Der = Buffer.from(certBase64, 'base64');
  const p12Asn1 = forge.asn1.fromDer(p12Der.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPass);

  let privateKey = null;
  let primerCertificado = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        privateKey = safeBag.key;
      }
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        if (!primerCertificado) {
          primerCertificado = safeBag.cert;
        }
      }
    }
  }

  const cert = primerCertificado;

  if (!privateKey || !cert) {
    throw new Error('No se pudo extraer clave privada o certificado del P12');
  }

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  const xmlPreparado = xmlString.replace(
    /<ext:ExtensionContent\s*\/>/g,
    '<ext:ExtensionContent></ext:ExtensionContent>'
  );

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });

  sig.addReference({
    xpath: '/*',
    isEmptyUri: true,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });

  sig.computeSignature(xmlPreparado, {
    prefix: 'ds',
    attrs: { Id: sigId },
    location: {
      reference: "//*[local-name()='ExtensionContent']",
      action: 'append',
    },
  });

  return sig.getSignedXml();
}

module.exports = { firmarXml };
