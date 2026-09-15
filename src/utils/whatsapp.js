/**
 * Utilidades para WhatsApp Web / app.
 * El envío se hace abriendo wa.me en una nueva pestaña — el navegador
 * delega en WhatsApp Web o en la app de escritorio/móvil instalada.
 *
 * No se usa la API Business de WhatsApp (requiere token y número verificado).
 * Si en el futuro se desea envío programático, migrar a Cloud API.
 */

import { normalizarCelularPE, sanitizarTexto } from './validation';

/**
 * Construye la URL de wa.me con mensaje pre-llenado.
 * @param {string} celular - Número en cualquier formato peruano
 * @param {string} mensaje - Texto a pre-llenar
 * @returns {{ url: string; error: string|null; numero: string|null }}
 */
export function construirUrlWhatsApp(celular, mensaje) {
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

/**
 * Abre WhatsApp con el número y mensaje indicados.
 * Detecta ventanas bloqueadas, también en aperturas programadas sin gesto
 * del usuario. `ok` indica ventana abierta, no mensaje enviado.
 */
export function abrirWhatsApp(celular, mensaje) {
  const { url, error } = construirUrlWhatsApp(celular, mensaje);
  if (error || !url) return { ok: false, error };

  try {
    const ventana = window.open('about:blank', '_blank');
    if (!ventana) {
      return { ok: false, error: 'El navegador bloqueó WhatsApp. Permite ventanas emergentes para este ERP y vuelve a abrirlo.' };
    }
    // Cortar acceso al ERP antes de navegar a un sitio externo.
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

/**
 * Plantillas de mensajes predefinidas para agilizar el envío.
 */
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

/**
 * Rellena una plantilla con variables.
 * @param {string} cuerpo
 * @param {{ nombre?: string; responsable?: string; empresa?: string }} vars
 */
export function rellenarPlantilla(cuerpo, vars = {}) {
  return cuerpo
    .replace(/\{nombre\}/g, vars.nombre || '')
    .replace(/\{responsable\}/g, vars.responsable || '')
    .replace(/\{empresa\}/g, vars.empresa || 'NOOVA S.A.C.');
}
