import firmaElena from '../assets/firmas/ingelena.jpeg';
import firmaGianfranco from '../assets/firmas/gianfranco.jpeg';
import firmaAlfredo from '../assets/firmas/ing.alfredoleon.jpeg';
import { mismaPersona } from '../utils/nombres';

export const FIRMANTES = [
  { id: 'elena', nombre: 'Elena Mendoza', cargo: 'Jefe Comercial y Ventas', firma: firmaElena },
  { id: 'gianfranco', nombre: 'Gianfranco Errea Molina', cargo: 'Asesor Comercial', firma: firmaGianfranco }
];

export const FIRMANTES_SALIDA = [
  ...FIRMANTES,
  { id: 'alfredo', nombre: 'Alfredo Landeo León Landeo', cargo: 'Gerente General', firma: firmaAlfredo }
];

export function firmantePorNombre(nombre) {
  return FIRMANTES_SALIDA.find((f) => mismaPersona(f.nombre, nombre)) || null;
}
