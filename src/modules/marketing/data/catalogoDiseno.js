// Diseños de la fábrica de piezas (plantillas/variantes/catalogo.json del repositorio noova-marketing).
// Los id deben coincidir con ese catálogo y con functions/src/marketingPiezas.js.
// Cada diseño tiene su imagen real en public/disenos/<id>.webp.
// OJO: estos diseños son de PRUEBA, para validar la interfaz. No son los finales; hay que reemplazarlos.

const SOCIALES = ['linkedin', 'facebook', 'instagram'];

export const DISENOS = [
  { id: 'flyer-lateral', nombre: 'Foto con texto lateral', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-superior', nombre: 'Foto superior con titular', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-dato', nombre: 'Dato tipográfico', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-editorial', nombre: 'Editorial', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-foto-dato', nombre: 'Foto completa con dato', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-foto-titular', nombre: 'Foto completa con titular', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-foto-apertura', nombre: 'Foto completa con apertura', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-foto-palabra', nombre: 'Foto completa con una palabra', formato: 'flyer', redes: SOCIALES },
  { id: 'flyer-foto-cifras', nombre: 'Foto completa con cifras', formato: 'flyer', redes: SOCIALES },
  { id: 'carrusel-criterio', nombre: 'Carrusel: pregunta y evidencia', formato: 'carrusel', redes: SOCIALES },
  { id: 'carrusel-metodo', nombre: 'Carrusel: secuencia real', formato: 'carrusel', redes: SOCIALES },
  { id: 'carrusel-foto-secuencia', nombre: 'Carrusel de fotos en secuencia', formato: 'carrusel', redes: SOCIALES },
  { id: 'social-cuadrado', nombre: 'Publicación cuadrada', formato: 'publicacion', redes: SOCIALES },
  { id: 'social-horizontal', nombre: 'Publicación panorámica', formato: 'publicacion', redes: ['linkedin', 'facebook'] },
  { id: 'vertical-campo', nombre: 'Vertical de campo', formato: 'vertical', redes: ['instagram', 'tiktok'] },
  { id: 'vertical-secuencia', nombre: 'Vertical en secuencia', formato: 'vertical', redes: ['instagram', 'tiktok'] },
  { id: 'vertical-foto-dato', nombre: 'Vertical con foto y dato', formato: 'vertical', redes: ['instagram', 'tiktok'] }
];
