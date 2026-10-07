import { FiBriefcase, FiDroplet, FiFileText, FiHome, FiPackage, FiShield, FiTool, FiTruck } from 'react-icons/fi';
import { TbBackhoe } from 'react-icons/tb';

const ICONOS = {
  transporte: FiTruck,
  maquinaria: TbBackhoe,
  epp: FiShield,
  materiales: FiPackage,
  equipos: FiTool,
  servicios: FiBriefcase,
  combustible: FiDroplet,
  campamento: FiHome,
  general: FiFileText
};

export const NOMBRES_ICONO = {
  transporte: 'Transporte',
  maquinaria: 'Maquinaria',
  epp: 'Protección personal',
  materiales: 'Materiales',
  equipos: 'Equipos',
  servicios: 'Servicios',
  combustible: 'Combustible',
  campamento: 'Campamento',
  general: 'General'
};

export default function IconoPlantilla({ icono, size = 20 }) {
  const Icono = ICONOS[icono] || FiFileText;
  return <Icono size={size} aria-hidden="true" />;
}
