import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import Loading from './components/Loading';
import { useConfig } from './context/ConfigContext';
import { tienePermiso } from './services/userService';
import './App.css';

const Login = lazy(() => import('./pages/Login'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Cotizaciones = lazy(() => import('./pages/Cotizaciones'));
const Equipos = lazy(() => import('./pages/Equipos'));
const Mangas = lazy(() => import('./pages/Mangas'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const Mensajeria = lazy(() => import('./pages/Mensajeria'));
const NubePage = lazy(() => import('./modules/nube/pages/NubePage'));
const Compras = lazy(() => import('./pages/Compras'));
const Proveedores = lazy(() => import('./pages/Proveedores'));

function RutaProtegida({ children }) {
  const { currentUser, userProfile } = useAuth();
  if (!currentUser || !userProfile) return <Navigate to="/login" replace />;
  return children;
}

function RutaPublica({ children }) {
  const { currentUser } = useAuth();
  if (currentUser) return <Navigate to="/dashboard" replace />;
  return children;
}

// Segundo seguro además del sidebar: si el rol del usuario no tiene este
// módulo en su navItems (ej. un colaborador de Marketing intentando entrar
// a /cotizaciones escribiendo la URL directamente), lo manda a Dashboard.
function RutaConPermiso({ moduloKey, moduloKeys, children }) {
  const { userProfile } = useAuth();
  const location = useLocation();
  const permisos = moduloKeys || [moduloKey];
  const autorizado = permisos.some((key) => tienePermiso(userProfile, key));
  if (!autorizado) {
    // Nunca navegar a la misma URL: React Router conserva el layout pero no
    // monta contenido en el Outlet, que era la pantalla blanca reportada.
    if (location.pathname === '/dashboard') {
      return (
        <section className="pagina" role="alert">
          <h1 className="pagina-titulo">Acceso pendiente de configuración</h1>
          <p>Tu cuenta está activa, pero todavía no tiene módulos habilitados. Solicita a un administrador que revise tus permisos.</p>
        </section>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Inyecta los datos de la empresa (desde ConfigContext) a Facturacion.
// Los datos provienen únicamente de la colección configuracion/general.
function FacturacionWrapper() {
  const { config, loadingConfig, configError, refreshConfig } = useConfig();

  if (loadingConfig) {
    return <Loading message="Cargando configuración de la empresa..." />;
  }
  if (configError && !config) {
    return <ErrorConfiguracion onRetry={refreshConfig} />;
  }

  const empresaData = config?.empresa || null;
  return <Facturacion empresaData={empresaData} />;
}

function ComprasWrapper() {
  const { config, loadingConfig, configError, refreshConfig } = useConfig();
  if (loadingConfig) {
    return <Loading message="Cargando configuración de compras..." />;
  }
  if (configError || !config) return <ErrorConfiguracion onRetry={refreshConfig} />;
  return <Compras />;
}

function ErrorConfiguracion({ onRetry }) {
  return (
    <section className="pagina" role="alert">
      <h1 className="pagina-titulo">No se pudo cargar la configuración</h1>
      <p>Comprueba la conexión con Firebase e inténtalo nuevamente.</p>
      <button type="button" className="btn-principal" onClick={onRetry}>Reintentar</button>
    </section>
  );
}

function App() {
  return (
    <div className="app">
      <Suspense fallback={<Loading message="Cargando..." />}>
        <Routes>
          <Route
            path="/login"
            element={
              <RutaPublica>
                <Login />
              </RutaPublica>
            }
          />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <DashboardLayout />
              </RutaProtegida>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<RutaConPermiso moduloKey="dashboard"><Dashboard /></RutaConPermiso>} />
            <Route path="clientes" element={<RutaConPermiso moduloKey="clientes"><Clientes /></RutaConPermiso>} />
            <Route path="cotizaciones" element={<RutaConPermiso moduloKey="cotizaciones"><Cotizaciones /></RutaConPermiso>} />
            <Route path="equipos" element={<RutaConPermiso moduloKey="equipos"><Equipos /></RutaConPermiso>} />
            <Route path="mangas" element={<RutaConPermiso moduloKey="mangas"><Mangas /></RutaConPermiso>} />
            <Route path="mensajeria" element={<RutaConPermiso moduloKey="mensajeria"><Mensajeria /></RutaConPermiso>} />
            <Route path="compras" element={<RutaConPermiso moduloKey="compras"><ComprasWrapper /></RutaConPermiso>} />
            <Route path="proveedores" element={<RutaConPermiso moduloKey="proveedores"><Proveedores /></RutaConPermiso>} />
            <Route path="compras/proveedores" element={<Navigate to="/proveedores" replace />} />
            <Route path="facturacion" element={<RutaConPermiso moduloKey="facturacion"><FacturacionWrapper /></RutaConPermiso>} />
            <Route path="configuracion" element={<RutaConPermiso moduloKeys={['configuracion', 'usuarios']}><Configuracion /></RutaConPermiso>} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="nube" element={<RutaConPermiso moduloKey="nube"><NubePage /></RutaConPermiso>} />
            <Route path="usuarios" element={<RutaConPermiso moduloKey="usuarios"><Navigate to="/configuracion?tab=usuarios" replace /></RutaConPermiso>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
