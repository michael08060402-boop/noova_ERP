// Opciones que acepta el workflow generar-pieza del repositorio noova-marketing.
// Deben coincidir con plantillas/variantes/catalogo.json y con las opciones del workflow.

const REDES_PIEZA = ['linkedin', 'facebook', 'instagram', 'tiktok'];

const FORMATOS_POR_RED = {
  linkedin: ['flyer', 'carrusel', 'publicacion'],
  facebook: ['flyer', 'carrusel', 'publicacion'],
  instagram: ['flyer', 'carrusel', 'publicacion', 'vertical'],
  tiktok: ['vertical']
};

const TEMAS = ['automatico', 'trayectoria', 'proyectos', 'operaciones', 'alcance', 'fases-ventilacion', 'metodo-bombeo', 'ductos'];

const REDES_SOCIALES = ['linkedin', 'facebook', 'instagram'];
const VARIANTES = {
  'flyer-lateral': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-superior': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-dato': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-editorial': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-foto-dato': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-foto-titular': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-foto-apertura': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-foto-palabra': { formato: 'flyer', redes: REDES_SOCIALES },
  'flyer-foto-cifras': { formato: 'flyer', redes: REDES_SOCIALES },
  'carrusel-criterio': { formato: 'carrusel', redes: REDES_SOCIALES },
  'carrusel-metodo': { formato: 'carrusel', redes: REDES_SOCIALES },
  'carrusel-foto-secuencia': { formato: 'carrusel', redes: REDES_SOCIALES },
  'social-cuadrado': { formato: 'publicacion', redes: REDES_SOCIALES },
  'social-horizontal': { formato: 'publicacion', redes: ['linkedin', 'facebook'] },
  'vertical-campo': { formato: 'vertical', redes: ['instagram', 'tiktok'] },
  'vertical-secuencia': { formato: 'vertical', redes: ['instagram', 'tiktok'] },
  'vertical-foto-dato': { formato: 'vertical', redes: ['instagram', 'tiktok'] }
};

// Devuelve { inputs } listos para el workflow, o { error } con el mensaje para la persona.
function validarSolicitudPieza(datos = {}) {
  const { red, formato, tema, fecha } = datos;
  const variante = datos.variante || 'automatico';
  if (!REDES_PIEZA.includes(red)) return { error: 'El campo "red" no es válido.' };
  if (!Object.values(FORMATOS_POR_RED).flat().includes(formato)) return { error: 'El campo "formato" no es válido.' };
  if (!TEMAS.includes(tema)) return { error: 'El campo "tema" no es válido.' };
  if (!FORMATOS_POR_RED[red].includes(formato)) return { error: 'Ese formato no está disponible para la red elegida.' };
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'La fecha debe tener el formato AAAA-MM-DD.' };
  if (variante !== 'automatico') {
    const elegida = VARIANTES[variante];
    if (!elegida) return { error: 'El diseño elegido no existe.' };
    if (elegida.formato !== formato || !elegida.redes.includes(red)) return { error: 'Ese diseño no sirve para la red y el formato elegidos.' };
  }
  const inputs = { red, formato, tema };
  if (fecha) inputs.fecha = fecha;
  if (variante !== 'automatico') inputs.variante = variante;
  return { inputs };
}

module.exports = { REDES_PIEZA, FORMATOS_POR_RED, TEMAS, VARIANTES, validarSolicitudPieza };
