import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FiBarChart2, FiUsers, FiFileText, FiSettings,
  FiMenu, FiLogOut, FiX, FiChevronDown, FiDollarSign, FiBell, FiTool,
  FiWind, FiMessageCircle, FiCloud, FiShoppingCart, FiTruck, FiSearch,
  FiBriefcase, FiClipboard, FiTarget, FiPackage
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCotizaciones } from '../hooks/useCotizaciones';
import useNotificacionesVistas from '../hooks/useNotificacionesVistas';
import { puede, ROLES, normalizarRol, esRolMinas } from '../services/userService';
import { obtenerCalibracionesProximas } from '../utils/calibracion';
import ConfirmDialog from '../components/ConfirmDialog';
import AvatarUsuario from '../components/AvatarUsuario';
import { useAvatares, useRegistrarUsuario } from '../hooks/useAvatares';
import logoBlanco from '../assets/logo-blanco.png';
import '../styles/shared.css';
import './DashboardLayout.css';

const ITEMS_MENU = [
  { path: '/dashboard', label: 'Dashboard', icon: <FiBarChart2 />, key: 'dashboard' },
  { path: '/clientes', label: 'Clientes', icon: <FiUsers />, key: 'clientes' },
  { path: '/cotizaciones', label: 'Cotizaciones', icon: <FiFileText />, key: 'cotizaciones' },
  { path: '/solicitudes', label: 'Solicitud de cotización', icon: <FiClipboard />, key: 'solicitudes' },
  { path: '/facturacion', label: 'Boletas / Facturas', icon: <FiDollarSign />, key: 'facturacion' },
  { path: '/equipos', label: 'Equipos', icon: <FiTool />, key: 'equipos' },
  { path: '/mangas', label: 'Mangas', icon: <FiWind />, key: 'mangas' },
  { path: '/servicios', label: 'Servicios', icon: <FiBriefcase />, key: 'servicios' },
  { path: '/calibraciones', label: 'Calibraciones', icon: <FiTarget />, key: 'calibraciones' },
  { path: '/mensajeria', label: 'Mensajería', icon: <FiMessageCircle />, key: 'mensajeria' },
  { path: '/nube', label: 'Nube', icon: <FiCloud />, key: 'nube' },
  { path: '/proveedores', label: 'Proveedores', icon: <FiTruck />, key: 'proveedores' },
  { path: '/compras', label: 'Órdenes de compra', icon: <FiShoppingCart />, key: 'compras' },
  { path: '/salidas', label: 'Formato de salida', icon: <FiPackage />, key: 'salidas' },
  { path: '/configuracion', label: 'Configuración', icon: <FiSettings />, key: 'configuracion' }
];

const GRUPOS_MENU = [
  { id: 'comercial', label: 'COMERCIAL', keys: ['dashboard', 'clientes', 'cotizaciones', 'facturacion'] },
  { id: 'compras', label: 'COMPRAS', keys: ['solicitudes', 'proveedores', 'compras'] },
  { id: 'logistica', label: 'LOGÍSTICA', keys: ['salidas'] },
  { id: 'catalogo', label: 'CATÁLOGO', keys: ['equipos', 'mangas', 'servicios'] },
  { id: 'postventa', label: 'POSTVENTA', keys: ['calibraciones'] }
];

const GRUPOS_MENU_MINAS = [
  { id: 'minas', label: 'MINAS', keys: ['solicitudes', 'salidas', 'nube'] }
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
  const esMinas = esRolMinas(userProfile);
  const { buscar: buscarAvatar } = useAvatares();
  const miAvatar = buscarAvatar({ uid: currentUser?.uid });
  useRegistrarUsuario(currentUser?.uid, userProfile?.nombre, userProfile?.email || currentUser?.email);
  const puedeVerCotizaciones = puede(userProfile, 'cotizaciones', 'read');
  const puedeVerSolicitudes = puede(userProfile, 'solicitudes', 'read');
  const puedeVerDocumentos = puedeVerCotizaciones || puedeVerSolicitudes;
  const puedeVerPerfil = puede(userProfile, 'perfil', 'read');
  const puedeVerConfiguracion = puede(userProfile, 'configuracion', 'read');

  const soloSolicitudes = esMinas || (!puedeVerCotizaciones && puedeVerSolicitudes);
  const { cotizaciones, fetchCotizaciones } = useCotizaciones(puedeVerDocumentos, { soloSolicitudes });

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const esDashboard = pathname === '/dashboard' || pathname === '/dashboard/';
  const [busquedaModulo, setBusquedaModulo] = useState('');
  const [gruposCerrados, setGruposCerrados] = useState({});
  const esMobile = useEsMobile();

  const [sidebarMobileAbierto, setSidebarMobileAbierto] = useState(false);
  const [confirmarCierreSesion, setConfirmarCierreSesion] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const notificacionesRef = useRef(null);

  const itemsMenu = ITEMS_MENU.filter((item) =>
    puede(userProfile, item.key, 'read')
      || (item.key === 'configuracion' && puedeVerPerfil)
  );

  useEffect(() => {
    function manejarClickFuera(e) {
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
  const rolUsuario = esMinas
    ? 'Área de Minas'
    : (ROLES[normalizarRol(userProfile?.role)]?.label || 'Sin rol asignado');

  const calibracionesProximas = (puedeVerCotizaciones && !esMinas)
    ? obtenerCalibracionesProximas(cotizaciones)
    : [];

  const notificacionesPendientes = calibracionesProximas.map((cal) => ({
    key: `cal-${cal.cotizacionId}-${cal.itemIndex}-${cal.fecha}-${cal.dias < 0 ? 'vencida' : 'proxima'}`,
    tipo: 'calibracion',
    texto: `${cal.cotizacionCodigo} · ${cal.descripcion}`,
    subtexto: cal.dias < 0
      ? `Vencida hace ${Math.abs(cal.dias)} días · ${cal.cliente}`
      : `Vence en ${cal.dias} días · ${cal.cliente}`
  }));

  const notificacionesSinVer = useNotificacionesVistas(
    currentUser?.uid,
    notificacionesPendientes,
    notificacionesAbiertas
  );

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

  const normalizarBusqueda = (texto) => texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
            <img className="sidebar-logo-img" src={logoBlanco} alt="NOOVA Consulting" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {(esMinas ? GRUPOS_MENU_MINAS : GRUPOS_MENU).map((grupo) => {
            const items = grupo.keys
              .map((key) => itemsMenu.find((item) => item.key === key))
              .filter(Boolean);
            const abierto = !gruposCerrados[grupo.id];
            const activo = items.some(
              (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
            );

            return items.length > 0 && (
              <div className="sidebar-nav-group" key={grupo.id}>
                <button
                  type="button"
                  className={`sidebar-group-toggle ${activo ? 'sidebar-group-active' : ''}`}
                  aria-expanded={abierto}
                  aria-controls={`sidebar-group-${grupo.id}`}
                  onClick={() => setGruposCerrados((actual) => ({
                    ...actual,
                    [grupo.id]: abierto
                  }))}
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
            <div
              className="topbar-user-static"
              title={nombreUsuario}
              aria-label="Menú de usuario"
            >
              <AvatarUsuario
                className="topbar-user-icon"
                nombre={nombreUsuario}
                email={userProfile?.email || currentUser?.email}
                foto={miAvatar?.foto}
                tamano={null}
              />
              <span className="topbar-user-data">
                <span className="topbar-user-name">{nombreUsuario}</span>
                <span className="topbar-user-role">{rolUsuario}</span>
              </span>
            </div>
          </div>

          <div className="dashboard-module-search" role="search">
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar módulo del ERP"
              placeholder="Buscar módulo del ERP…"
              value={busquedaModulo}
              onChange={(event) => setBusquedaModulo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setBusquedaModulo('');
              }}
            />
            {busquedaModulo.trim() && (
              <div className="dashboard-search-results">
                {resultadosModulos.length ? resultadosModulos.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setBusquedaModulo('')}
                  >
                    {item.icon}<span>{item.label}</span>
                  </NavLink>
                )) : <p role="status">No se encontraron módulos.</p>}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            {['mensajeria', 'nube'].map((key) => {
              const item = itemsMenu.find((modulo) => modulo.key === key);
              return item && (
                <NavLink
                  key={key}
                  to={item.path}
                  className={({ isActive }) => `topbar-shortcut ${isActive ? 'topbar-shortcut-active' : ''}`}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    setSidebarMobileAbierto(false);
                    setNotificacionesAbiertas(false);
                    setBusquedaModulo('');
                  }}
                >
                  {item.icon}
                </NavLink>
              );
            })}

            {(puedeVerConfiguracion || puedeVerPerfil) && (
              <NavLink
                to="/configuracion"
                className={({ isActive }) => `topbar-settings ${isActive ? 'topbar-settings-active' : ''}`}
                aria-label="Configuración"
                title="Configuración"
                onClick={() => {
                  setSidebarMobileAbierto(false);
                  setNotificacionesAbiertas(false);
                }}
              >
                <FiSettings size={19} aria-hidden="true" />
              </NavLink>
            )}

            {puedeVerDocumentos && (
              <div className="notification-wrapper" ref={notificacionesRef}>
                <button
                  className="notification-btn notification-btn-circular"
                  onClick={() => {
                    setNotificacionesAbiertas((p) => !p);
                    fetchCotizaciones();
                  }}
                  aria-label="Notificaciones"
                  aria-expanded={notificacionesAbiertas}
                >
                  <FiBell size={18} />
                  {notificacionesSinVer > 0 && (
                    <span className="notification-badge">
                      {notificacionesSinVer}
                    </span>
                  )}
                </button>

                {notificacionesAbiertas && (
                  <div className="notifications-panel">
                    <div className="notifications-header">
                      <span>Notificaciones</span>
                    </div>

                    <div className="notifications-list">
                      {notificacionesPendientes.length === 0 ? (
                        <div className="notification-empty">
                          Todo está al día
                        </div>
                      ) : (
                        notificacionesPendientes.map((n) => (
                          <div key={n.key} className="notification-item">
                            <span className="notification-texto">{n.texto}</span>
                            <span className="notification-detail">{n.subtexto}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
