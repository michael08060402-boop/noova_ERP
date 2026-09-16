import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FiBarChart2, FiUsers, FiFileText, FiSettings,
  FiMenu, FiLogOut, FiUser, FiX, FiChevronDown, FiDollarSign, FiBell, FiTool,
  FiWind, FiMessageCircle, FiCloud, FiShoppingCart, FiTruck, FiTrendingUp, FiSearch, FiCalendar
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCotizaciones } from '../hooks/useCotizaciones';
import { puede, ROLES, normalizarRol } from '../services/userService';
import { obtenerCalibracionesProximas } from '../utils/calibracion';
import ConfirmDialog from '../components/ConfirmDialog';
import logo from '../assets/noova-logo.png';
import logoBlanco from '../assets/logo-blanco.png';
import '../styles/shared.css';
import './DashboardLayout.css';
import '../styles/paleta-preview.css';

const ITEMS_MENU = [
  { path: '/dashboard', label: 'Dashboard', icon: <FiBarChart2 />, key: 'dashboard' },
  { path: '/clientes', label: 'Clientes', icon: <FiUsers />, key: 'clientes' },
  { path: '/equipos', label: 'Equipos', icon: <FiTool />, key: 'equipos' },
  { path: '/mangas', label: 'Mangas', icon: <FiWind />, key: 'mangas' },
  { path: '/cotizaciones', label: 'Cotizaciones', icon: <FiFileText />, key: 'cotizaciones' },
  { path: '/ventas', label: 'Ventas', icon: <FiTrendingUp />, key: 'ventas' },
  { path: '/mensajeria', label: 'Mensajería', icon: <FiMessageCircle />, key: 'mensajeria' },
  { path: '/proveedores', label: 'Proveedores', icon: <FiTruck />, key: 'proveedores' },
  { path: '/compras', label: 'Órdenes de compra', icon: <FiShoppingCart />, key: 'compras' },
  { path: '/facturacion', label: 'Boletas / Facturas', icon: <FiDollarSign />, key: 'facturacion' },
  { path: '/nube', label: 'Nube', icon: <FiCloud />, key: 'nube' },
  { path: '/configuracion', label: 'Configuración', icon: <FiSettings />, key: 'configuracion' }
];

const GRUPOS_MENU = [
  { id: 'comercial', label: 'Comercial y clientes', keys: ['dashboard', 'clientes', 'cotizaciones', 'ventas'] },
  { id: 'operaciones', label: 'Operaciones y servicios', keys: ['equipos', 'mangas'] },
  { id: 'logistica', label: 'Logística y facturación', keys: ['proveedores', 'compras', 'facturacion'] },
  { id: 'sistema', label: 'Comunicación y archivos', keys: ['mensajeria', 'nube'] }
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
  const { currentUser, userProfile, logout } = useAuth();
  const puedeVerCotizaciones = puede(userProfile, 'cotizaciones', 'read');
  const puedeVerPerfil = puede(userProfile, 'perfil', 'read');
  const puedeVerConfiguracion = puede(userProfile, 'configuracion', 'read');
  const { cotizaciones, fetchCotizaciones } = useCotizaciones(puedeVerCotizaciones);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const esDashboard = pathname === '/dashboard' || pathname === '/dashboard/';
  const [busquedaModulo, setBusquedaModulo] = useState('');
  const [gruposCerrados, setGruposCerrados] = useState({});
  const esMobile = useEsMobile();

  const [sidebarMobileAbierto, setSidebarMobileAbierto] = useState(false);

  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [confirmarCierreSesion, setConfirmarCierreSesion] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const menuUsuarioRef = useRef(null);
  const notificacionesRef = useRef(null);

  const itemsMenu = ITEMS_MENU.filter((item) =>
    puede(userProfile, item.key, 'read')
  );

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

  const nombreUsuario =
    userProfile?.nombre ||
    currentUser?.email?.split('@')[0] ||
    'Usuario';
  const rolUsuario = ROLES[normalizarRol(userProfile?.role)]?.label
    || 'Sin rol asignado';

  const cotizacionesPendientes = puedeVerCotizaciones
    ? cotizaciones.filter((c) => c.estado === 'Borrador' || c.estado === 'Enviada')
    : [];

  const calibracionesProximas = puedeVerCotizaciones
    ? obtenerCalibracionesProximas(cotizaciones)
    : [];

  const notificacionesPendientes = [
    ...cotizacionesPendientes.map((cot) => ({
      key: `cot-${cot.id}`,
      tipo: 'cotizacion',
      texto: cot.codigo || 'Sin código',
      subtexto: cot.estado
    })),
    ...calibracionesProximas.map((cal) => ({
      key: `cal-${cal.cotizacionId}-${cal.itemIndex}`,
      tipo: 'calibracion',
      texto: `${cal.cotizacionCodigo} · ${cal.descripcion}`,
      subtexto: cal.dias < 0
        ? `Vencida hace ${Math.abs(cal.dias)} días · ${cal.cliente}`
        : `Vence en ${cal.dias} días · ${cal.cliente}`
    }))
  ];

  const sidebarClase = [
    'sidebar',
    esMobile ? 'sidebar-mobile' : '',
    esMobile && sidebarMobileAbierto ? 'sidebar-open' : ''
  ].filter(Boolean).join(' ');

  const mainWrapperClase = [
    'main-wrapper',
    !esMobile ? 'main-wrapper-expanded' : ''
  ].filter(Boolean).join(' ');

  const renderItemMenu = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
      onClick={() => esMobile && setSidebarMobileAbierto(false)}
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  );
  const normalizarBusqueda = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const resultadosModulos = itemsMenu.filter((item) =>
    normalizarBusqueda(item.label).includes(normalizarBusqueda(busquedaModulo.trim()))
  );

  return (
    <div className={`dashboard-layout paleta-preview ${esDashboard ? 'dashboard-reference' : ''}`}>
      {esMobile && sidebarMobileAbierto && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarMobileAbierto(false)}
        />
      )}

      <aside className={sidebarClase}>
        <div className="sidebar-header">
          {esMobile && (
            <button
              type="button"
              className="sidebar-close"
              onClick={() => setSidebarMobileAbierto(false)}
              aria-label="Cerrar menú"
            >
              <FiX size={18} />
            </button>
          )}

          <div className="sidebar-logo">
            <img className="sidebar-logo-img" src={esDashboard ? logoBlanco : logo} alt="NOOVA Consulting" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {GRUPOS_MENU.map((grupo) => {
            const items = grupo.keys.map((key) => itemsMenu.find((item) => item.key === key)).filter(Boolean);
            const abierto = !gruposCerrados[grupo.id];
            const activo = items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
            return items.length > 0 && (
              <div className="sidebar-nav-group" key={grupo.id}>
                <button
                  type="button"
                  className={`sidebar-group-toggle ${activo ? 'sidebar-group-active' : ''}`}
                  aria-expanded={abierto}
                  aria-controls={`sidebar-group-${grupo.id}`}
                  onClick={() => setGruposCerrados((actual) => ({ ...actual, [grupo.id]: abierto }))}
                >
                  <span>{grupo.label}</span>
                  <FiChevronDown aria-hidden="true" />
                </button>
                <div id={`sidebar-group-${grupo.id}`} hidden={!abierto}>
                  {items.map(renderItemMenu)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => setConfirmarCierreSesion(true)}
          >
            <FiLogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>

          <div className="sidebar-copyright">
            {`© ${new Date().getFullYear()} NOOVA S.A.C.`}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={confirmarCierreSesion}
        onClose={() => setConfirmarCierreSesion(false)}
        onConfirm={cerrarSesion}
        title="¿Cerrar sesión?"
        message="Se cerrará tu sesión actual y tendrás que volver a iniciar sesión para acceder al sistema."
        confirmLabel="Cerrar Sesión"
        busyLabel="Cerrando sesión…"
        icon={<FiLogOut size={42} strokeWidth={1.8} />}
      />

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
            <div className="topbar-brand">
              <span className="topbar-title">ERP NOOVA S.A.C.</span>
            </div>
          </div>

          {esDashboard && (
            <div className="dashboard-module-search" role="search">
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar módulo del ERP"
                placeholder="Buscar módulo del ERP…"
                value={busquedaModulo}
                onChange={(event) => setBusquedaModulo(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setBusquedaModulo(''); }}
              />
              {busquedaModulo.trim() && (
                <div className="dashboard-search-results">
                  {resultadosModulos.length ? resultadosModulos.map((item) => (
                    <NavLink key={item.path} to={item.path} onClick={() => setBusquedaModulo('')}>
                      {item.icon}<span>{item.label}</span>
                    </NavLink>
                  )) : <p role="status">No se encontraron módulos.</p>}
                </div>
              )}
            </div>
          )}

          <div className="topbar-actions">
            {esDashboard && (
              <time className="dashboard-current-month" dateTime={new Date().toISOString().slice(0, 7)}>
                <FiCalendar aria-hidden="true" />
                {new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
              </time>
            )}
            {puedeVerConfiguracion && (
              <NavLink
                to="/configuracion"
                className={({ isActive }) => `topbar-settings ${isActive ? 'topbar-settings-active' : ''}`}
                aria-label="Configuración"
                title="Configuración"
                onClick={() => {
                  setSidebarMobileAbierto(false);
                  setMenuUsuarioAbierto(false);
                  setNotificacionesAbiertas(false);
                }}
              >
                <FiSettings size={19} aria-hidden="true" />
              </NavLink>
            )}
            {puedeVerCotizaciones && (
              <div className="notification-wrapper" ref={notificacionesRef}>
                <button
                  className="notification-btn"
                  onClick={() => {
                    setNotificacionesAbiertas((p) => !p);
                    fetchCotizaciones();
                  }}
                  aria-label="Notificaciones"
                  aria-expanded={notificacionesAbiertas}
                >
                  <FiBell size={18} />
                  {notificacionesPendientes.length > 0 && (
                    <span className="notification-badge">
                      {notificacionesPendientes.length}
                    </span>
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
                        <div className="notification-empty">
                          No hay elementos pendientes
                        </div>
                      ) : (
                        notificacionesPendientes.slice(0, 5).map((n) => (
                          <div key={n.key} className="notification-item">
                            <span className="notification-texto">{n.texto}</span>
                            {n.tipo === 'cotizacion' ? (
                              <span className="notification-status">{n.subtexto}</span>
                            ) : (
                              <span className="notification-detail">{n.subtexto}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="topbar-user-wrapper" ref={menuUsuarioRef}>
              <button
                className="topbar-user-trigger"
                onClick={() => setMenuUsuarioAbierto((p) => !p)}
                title={nombreUsuario}
                aria-label="Menú de usuario"
                aria-expanded={menuUsuarioAbierto}
              >
                <span className="topbar-user-icon">
                  {esDashboard
                    ? nombreUsuario.trim().split(/\s+/).slice(0, 2).map((nombre) => nombre[0]).join('').toUpperCase()
                    : <FiUser size={17} />}
                </span>
                <span className="topbar-user-data">
                  <span className="topbar-user-name">{nombreUsuario}</span>
                  <span className="topbar-user-role">{rolUsuario}</span>
                </span>
                <FiChevronDown
                  className={`topbar-user-chevron ${menuUsuarioAbierto ? 'topbar-user-chevron-open' : ''}`}
                  size={15}
                  aria-hidden="true"
                />
              </button>

              {menuUsuarioAbierto && (
                <div className="user-dropdown topbar-user-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-profile">
                      <div className="dropdown-profile-data">
                        <span className="dropdown-name">{nombreUsuario}</span>
                        <span className="dropdown-email">{currentUser?.email}</span>
                      </div>
                    </div>
                  </div>

                  {puedeVerPerfil && (
                    <>
                      <div className="dropdown-divider" />
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setMenuUsuarioAbierto(false);
                          navigate('/perfil');
                        }}
                      >
                        <FiUser size={16} />
                        <span>Mi Perfil</span>
                      </button>
                    </>
                  )}

                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
