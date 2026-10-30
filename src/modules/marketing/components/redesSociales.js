import { FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube } from 'react-icons/fa';

// El color identifica la red en pantalla (icono y gráficos). Facebook no usa su azul para no confundirse con LinkedIn.
export const REDES = [
  { key: 'facebook', label: 'Facebook', Icono: FaFacebook, color: '#0d9488' },
  { key: 'instagram', label: 'Instagram', Icono: FaInstagram, color: '#c13584' },
  { key: 'linkedin', label: 'LinkedIn', Icono: FaLinkedin, color: '#0a66c2' },
  { key: 'tiktok', label: 'TikTok', Icono: FaTiktok, color: '#111827' }
];

// YouTube solo se monitorea: todavía no se publica en ella desde el ERP.
export const REDES_MONITOREO = [...REDES, { key: 'youtube', label: 'YouTube', Icono: FaYoutube, color: '#d92d20' }];

export const FILTROS = [{ key: 'todo', label: 'Todas' }, ...REDES];

export function getRed(key) {
  return REDES.find((red) => red.key === key) || null;
}

export function getRedMonitoreo(key) {
  return REDES_MONITOREO.find((red) => red.key === key) || null;
}
