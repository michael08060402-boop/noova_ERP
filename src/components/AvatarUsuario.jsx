import { colorAvatar, iniciales } from '../utils/avatar';
import './AvatarUsuario.css';

export default function AvatarUsuario({ nombre, email, foto, tamano = 32, className = '' }) {
  const estilo = tamano ? { width: tamano, height: tamano, fontSize: Math.round(tamano * 0.38) } : {};
  const clases = ['avatar-usuario', className].filter(Boolean).join(' ');

  if (foto) {
    return <img className={clases} src={foto} alt={nombre ? `Foto de ${nombre}` : 'Foto de usuario'} style={estilo} />;
  }

  return (
    <span
      className={`${clases} avatar-usuario-iniciales`}
      style={{ ...estilo, background: colorAvatar(email || nombre), color: '#fff' }}
      role="img"
      aria-label={nombre || 'Usuario'}
    >
      {iniciales(nombre || email)}
    </span>
  );
}
