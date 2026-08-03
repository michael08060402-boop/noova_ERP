import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  FiBarChart2, FiUsers, FiFileText, FiSettings,
  FiMenu, FiLogOut, FiUser, FiX, FiDollarSign, FiBell, FiTool, FiWind, FiMessageCircle, FiCloud, FiShoppingCart, FiShield
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { ROLES } from '../services/userService';
import logo from '../assets/logo-blanco.png';
import '../styles/shared.css';
import './DashboardLayout.css';

const ITEMS_MENU = [
  { path: '/dashboard', label: 'Dashboard', icon: <FiBarChart2 />, key: 'dashboard' },
  { path: '/clientes', label: 'Clientes', icon: <FiUsers />, key: 'clientes' },
  { path: '/equipos', label: 'Equipos', icon: <FiTool />, key: 'equipos' },
  { path: '/mangas', label: 'Mangas', icon: <FiWind />, key: 'mangas' },
  { path: '/cotizaciones', label: 'Cotizaciones', icon: <FiFileText />, key: 'cotizaciones' },
  { path: '/mensajeria', label: 'Mensajería', icon: <FiMessageCircle />, key: 'mensajeria' },
  { path: '/compras', label: 'Compras', icon: <FiShoppingCart />, key: 'compras' },
  { path: '/facturacion', label: 'Boletas / Facturas', icon: <FiDollarSign />, key: 'facturacion' },
  { path: '/nube', label: 'Nube', icon: <FiCloud />, key: 'nube' },
  { path: '/usuarios', label: 'Usuarios y Roles', icon: <FiShield />, key: 'usuarios' },
  { path: '/configuracion', label: 'Configuración', icon: <FiSettings />, key: 'configuracion' }
];

function useEsMobile() {
  const [esMobile, setEsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const manejarResize = () => setEsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', manejarResize);
    return () => window.removeEventListener('resize', manejarResize);
  }, []);
  return esMobile;
}

export default function DashboardLayout() {
  const { currentUser, userProfile, logout, avisoTimeout, setAvisoTimeout } = useAuth();
  const { cotizaciones } = useCotizaciones();
  const navigate = useNavigate();
  const esMobile = useEsMobile();

  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [sidebarMobileAbierto, setSidebarMobileAbierto] = useState(false);

  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const menuUsuarioRef = useRef(null);
  const notificacionesRef = useRef(null);

  const rolUsuario = userProfile?.role || 'comercial';
  const configRol = ROLES[rolUsuario] || ROLES.comercial;
  const itemsMenu = ITEMS_MENU.filter(item => configRol.navItems.includes(item.key));

  useEffect(() => {
    function manejarClickFuera(e) {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(e.target)) {
        setMenuUsuarioAbierto(false);
      }
      if (notificacionesRef.current && !notificacionesRef.current.contains(e.target)) {
        setNotificacionesAbiertas(false);
      }
    }
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  useEffect(() => {
    if (!esMobile) setSidebarMobileAbierto(false);
  }, [esMobile]);

  async function cerrarSesion() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  }

  const nombreUsuario = userProfile?.nombre || currentUser?.email?.split('@')[0] || 'Usuario';
  const notificacionesPendientes = cotizaciones.filter(c => c.estado === 'Borrador' || c.estado === 'Enviada');

  const sidebarClase = [
    'sidebar',
    esMobile ? 'sidebar-mobile' : '',
    esMobile && sidebarMobileAbierto ? 'sidebar-open' : '',
    !esMobile && sidebarColapsado ? 'sidebar-collapsed' : ''
  ].filter(Boolean).join(' ');

  const mainWrapperClase = [
    'main-wrapper',
    !esMobile && sidebarColapsado ? 'main-wrapper-collapsed' : '',
    !esMobile && !sidebarColapsado ? 'main-wrapper-expanded' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className="dashboard-layout">
      {esMobile && sidebarMobileAbierto && (
        <div className="sidebar-overlay" onClick={() => setSidebarMobileAbierto(false)} />
      )}

      <aside className={sidebarClase}>
        <div className="sidebar-header">
          <button
            className="sidebar-collapse-btn"
            onClick={() => {
              if (esMobile) {
                setSidebarMobileAbierto(false);
              } else {
                setSidebarColapsado(p => !p);
                // Usamos requestAnimationFrame para sincronizar con el repintado
                requestAnimationFrame(() => {
                  window.dispatchEvent(new Event('resize'));
                });
              }
            }}
            aria-label={sidebarColapsado ? 'Expandir' : 'Minimizar'}
          >
            {esMobile ? <FiX size={18} /> : <FiMenu size={16} />}
          </button>
          <div className="sidebar-logo">
            <img className="sidebar-logo-img" src={logo} alt="Logo de Noova" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {itemsMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => esMobile && setSidebarMobileAbierto(false)}
              title={sidebarColapsado ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-wrapper" ref={menuUsuarioRef}>
            <button
              className="sidebar-user-trigger"
              onClick={() => setMenuUsuarioAbierto(p => !p)}
              title={nombreUsuario}
            >
              <div className="user-icono">
                <FiUser size={18} />
              </div>
              <div className="user-info">
                <span className="user-name">{nombreUsuario}</span>
                <span className="user-email-text">{currentUser?.email}</span>
              </div>
            </button>

            {menuUsuarioAbierto && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-name">{nombreUsuario}</span>
                  <span className="dropdown-email">{currentUser?.email}</span>
                </div>
                <div className="dropdown-divider"></div>
                <button
                  className="dropdown-item"
                  onClick={() => { setMenuUsuarioAbierto(false); navigate('/perfil'); }}
                >
                  <FiUser size={16} /><span>Mi Perfil</span>
                </button>
                <div className="dropdown-divider"></div>
                <button
                  className="dropdown-item dropdown-item-danger"
                  onClick={() => { setMenuUsuarioAbierto(false); cerrarSesion(); }}
                >
                  <FiLogOut size={16} /><span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-copyright">
            {sidebarColapsado ? new Date().getFullYear() : `© ${new Date().getFullYear()} NOOVA S.A.C.`}
          </div>
        </div>
      </aside>

      <div className={mainWrapperClase}>
        <header className="topbar">
          <div className="topbar-left">
            {esMobile && (
              <button
                className="topbar-hamburger"
                onClick={() => setSidebarMobileAbierto(true)}
                aria-label="Abrir menú"
              >
                <FiMenu size={20} />
              </button>
            )}
            <span className="topbar-title">ERP NOOVA S.A.C.</span>
            <button
              className="btn-editar-empresa"
              onClick={() => navigate('/configuracion')}
              title="Editar datos de la empresa"
            >
              <FiSettings size={14} /> Editar Empresa
            </button>
          </div>

          <div className="topbar-actions">
            <div className="notification-wrapper" ref={notificacionesRef}>
              <button
                className="notification-btn"
                onClick={() => setNotificacionesAbiertas(p => !p)}
                aria-label="Notificaciones"
              >
                <FiBell size={18} />
                {notificacionesPendientes.length > 0 && (
                  <span className="notification-badge">{notificacionesPendientes.length}</span>
                )}
              </button>
              {notificacionesAbiertas && (
                <div className="notifications-panel">
                  <div className="notifications-header">
                    <span>Notificaciones</span>
                    <span>{notificacionesPendientes.length} pendientes</span>
                  </div>
                  <div className="notifications-list">
                    {notificacionesPendientes.length === 0 ? (
                      <div className="notification-empty">No hay elementos pendientes</div>
                    ) : (
                      notificacionesPendientes.slice(0, 5).map(cot => (
                        <div key={cot.id} className="notification-item">
                          <span>{cot.codigo || 'Sin código'}</span>
                          <span className="notification-status">{cot.estado}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {/* Aviso de cierre de sesión por inactividad */}
      {avisoTimeout && (
        <div className="timeout-aviso-overlay">
          <div className="timeout-aviso-caja">
            <h3>Su sesión expirará pronto</h3>
            <p>Por inactividad, su sesión se cerrará automáticamente en 2 minutos.</p>
            <p className="timeout-aviso-pista">Haga clic en cualquier parte para seguir trabajando.</p>
            <button
              className="btn-principal"
              onClick={() => setAvisoTimeout(false)}
            >
              Continuar trabajando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}