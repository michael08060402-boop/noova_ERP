import { DISENOS } from '../data/catalogoDiseno.js';

export const FORMATOS = {
  flyer: 'Flyer',
  carrusel: 'Carrusel',
  publicacion: 'Publicación',
  vertical: 'Vertical (9:16)'
};

// Solo existen diseños para estas combinaciones; coincide con functions/src/marketingPiezas.js.
export const FORMATOS_POR_RED = {
  linkedin: ['flyer', 'carrusel', 'publicacion'],
  facebook: ['flyer', 'carrusel', 'publicacion'],
  instagram: ['flyer', 'carrusel', 'publicacion', 'vertical'],
  tiktok: ['vertical']
};

export function disenosPara(red, formato) {
  return DISENOS.filter((d) => d.formato === formato && d.redes.includes(red));
}

export function getDiseno(id) {
  return DISENOS.find((d) => d.id === id) || null;
}

// Avanza o retrocede por la lista, sin salirse de ella. Con 'automatico' parte del primero o del último.
export function moverDiseno(lista, actualId, paso) {
  if (lista.length === 0) return 'automatico';
  const indice = lista.findIndex((d) => d.id === actualId);
  if (indice < 0) return lista[paso > 0 ? 0 : lista.length - 1].id;
  return lista[(indice + paso + lista.length) % lista.length].id;
}

// Para «Otro boceto»: el siguiente diseño distinto al que se acaba de usar.
export function otroDiseno(lista, usadoId) {
  if (lista.length === 0) return 'automatico';
  if (lista.length === 1) return lista[0].id;
  return moverDiseno(lista, usadoId, 1);
}
