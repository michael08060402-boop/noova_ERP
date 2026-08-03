import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import Loading from './components/Loading';
import { useConfig } from './context/ConfigContext';
import { ROLES } from './services/userService';
import './App.css';

const Login = lazy(() => import('./pages/Login'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Cotizaciones = lazy(() => import('./pages/Cotizaciones'));
const Equipos = lazy(() => import('./pages/Equipos'));
const Mangas = lazy(() => import('./pages/Mangas'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const Mensajeria = lazy(() => import('./pages/Mensajeria'));
const NubePage = lazy(() => import('./modules/nube/pages/NubePage'));
const SolicitudesCotizacion = lazy(() => import('./pages/SolicitudesCotizacion'));

function RutaProtegida({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
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
function RutaConPermiso({ moduloKey, children }) {
  const { userProfile } = useAuth();
  const rol = userProfile?.role || 'comercial';
  const config = ROLES[rol] || ROLES.comercial;
  if (!config.navItems.includes(moduloKey)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Inyecta los datos de la empresa (desde ConfigContext) a Facturacion.
// Los datos provienen únicamente de la colección configuracion/general.
function FacturacionWrapper() {
  const { config, loadingConfig } = useConfig();

  if (loadingConfig) {
    return <Loading message="Cargando configuración de la empresa..." />;
  }

  const empresaData = config?.empresa || null;
  return <Facturacion empresaData={empresaData} />;
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
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<RutaConPermiso moduloKey="clientes"><Clientes /></RutaConPermiso>} />
            <Route path="cotizaciones" element={<RutaConPermiso moduloKey="cotizaciones"><Cotizaciones /></RutaConPermiso>} />
            <Route path="equipos" element={<RutaConPermiso moduloKey="equipos"><Equipos /></RutaConPermiso>} />
            <Route path="mangas" element={<RutaConPermiso moduloKey="mangas"><Mangas /></RutaConPermiso>} />
            <Route path="mensajeria" element={<RutaConPermiso moduloKey="mensajeria"><Mensajeria /></RutaConPermiso>} />
            <Route path="compras" element={<RutaConPermiso moduloKey="compras"><SolicitudesCotizacion /></RutaConPermiso>} />
            <Route path="facturacion" element={<RutaConPermiso moduloKey="facturacion"><FacturacionWrapper /></RutaConPermiso>} />
            <Route path="configuracion" element={<RutaConPermiso moduloKey="configuracion"><Configuracion /></RutaConPermiso>} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="nube" element={<RutaConPermiso moduloKey="nube"><NubePage /></RutaConPermiso>} />
            <Route path="usuarios" element={<RutaConPermiso moduloKey="usuarios"><Usuarios /></RutaConPermiso>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
