import { FaFacebook, FaInstagram, FaLinkedin } from 'react-icons/fa';

export const REDES = [
  { key: 'facebook', label: 'Facebook', Icono: FaFacebook },
  { key: 'instagram', label: 'Instagram', Icono: FaInstagram },
  { key: 'linkedin', label: 'LinkedIn', Icono: FaLinkedin }
];

export const FILTROS = [{ key: 'todo', label: 'Todo' }, ...REDES];

export function getRed(key) {
  return REDES.find((red) => red.key === key) || null;
}
