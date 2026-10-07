import { normalizarCelularPE, sanitizarTexto } from './validation';

function construirUrlWhatsApp(celular, mensaje) {
  const numero = normalizarCelularPE(celular);
  if (!numero) {
    return {
      url: null,
      error: 'Número de celular inválido. Use formato peruano 9XXXXXXXX o +51 9XXXXXXXX',
      numero: null
    };
  }
  const mensajeLimpio = sanitizarTexto(mensaje, 4000);
  if (!mensajeLimpio) {
    return {
      url: null,
      error: 'El mensaje no puede estar vacío',
      numero
    };
  }
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensajeLimpio)}`;
  return { url, error: null, numero };
}

export function abrirWhatsApp(celular, mensaje) {
  const { url, error } = construirUrlWhatsApp(celular, mensaje);
  if (error || !url) return { ok: false, error };

  try {
    const ventana = window.open('about:blank', '_blank');
    if (!ventana) {
      return { ok: false, error: 'El navegador bloqueó WhatsApp. Permite ventanas emergentes para este ERP y vuelve a abrirlo.' };
    }
    ventana.opener = null;
    const link = ventana.document.createElement('a');
    link.href = url;
    link.rel = 'noreferrer';
    ventana.document.body.appendChild(link);
    link.click();
    return { ok: true, error: null };
  } catch (err) {
    console.error('Error abriendo WhatsApp:', err);
    return { ok: false, error: 'No se pudo abrir WhatsApp: ' + (err.message || err) };
  }
}

export const PLANTILLAS_WHATSAPP = [
  {
    id: 'saludo',
    nombre: 'Saludo inicial',
    cuerpo: 'Hola {nombre}, espero se encuentre muy bien. Soy {responsable} de NOOVA S.A.C. ¿Tiene un momento para conversar?'
  },
  {
    id: 'cotizacion',
    nombre: 'Envío de cotización',
    cuerpo: 'Hola {nombre}, le comparto la cotización solicitada. Quedo atento a cualquier consulta. Saludos, {responsable} - NOOVA S.A.C.'
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento de cotización',
    cuerpo: 'Hola {nombre}, le escribo para hacer seguimiento a la cotización enviada. ¿Tuvo oportunidad de revisarla? Quedo a su disposición. Saludos, {responsable}'
  },
  {
    id: 'pago',
    nombre: 'Recordatorio de pago',
    cuerpo: 'Estimado/a {nombre}, le recordamos amablemente que tiene una factura pendiente de pago. Cualquier consulta estamos a su disposición. NOOVA S.A.C.'
  },
  {
    id: 'agradecimiento',
    nombre: 'Agradecimiento',
    cuerpo: 'Hola {nombre}, muchas gracias por su preferencia. Esperamos seguir trabajando juntos. Saludos cordiales, {responsable} - NOOVA S.A.C.'
  }
];

export function rellenarPlantilla(cuerpo, vars = {}) {
  return cuerpo
    .replace(/\{nombre\}/g, vars.nombre || '')
    .replace(/\{responsable\}/g, vars.responsable || '')
    .replace(/\{empresa\}/g, vars.empresa || 'NOOVA S.A.C.');
}
