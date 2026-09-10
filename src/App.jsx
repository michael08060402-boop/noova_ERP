import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import Loading from './components/Loading';
import { useConfig } from './context/ConfigContext';
import {
  puede,
  puedeConfiguracion,
  getRutaInicial
} from './services/userService';
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

  if (!currentUser || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RutaPublica({ children }) {
  const { currentUser, userProfile } = useAuth();

  if (currentUser && userProfile) {
    return <Navigate to={getRutaInicial(userProfile)} replace />;
  }

  return children;
}

function InicioPorRol() {
  const { userProfile } = useAuth();
  return <Navigate to={getRutaInicial(userProfile)} replace />;
}

// Segunda capa además del sidebar. Impide entrar escribiendo la URL a mano.
function RutaConPermiso({ modulo, accion = 'read', children }) {
  const { userProfile } = useAuth();
  const location = useLocation();

  if (puede(userProfile, modulo, accion)) {
    return children;
  }

  const destino = getRutaInicial(userProfile);

  // Evita bucles si un perfil está mal configurado.
  if (location.pathname === destino || destino === '/login') {
    return (
      <section className="pagina" role="alert">
        <h1 className="pagina-titulo">Acceso no autorizado</h1>
        <p>Tu rol no tiene permiso para acceder a esta sección.</p>
      </section>
    );
  }

  return <Navigate to={destino} replace />;
}

function RutaSeccionConfiguracion({ seccion, children }) {
  const { userProfile } = useAuth();
  const location = useLocation();

  if (puedeConfiguracion(userProfile, seccion)) {
    return children;
  }

  const destino = getRutaInicial(userProfile);
  if (location.pathname === destino || destino === '/login') {
    return (
      <section className="pagina" role="alert">
        <h1 className="pagina-titulo">Acceso no autorizado</h1>
        <p>Tu rol no tiene permiso para acceder a esta sección de Configuración.</p>
      </section>
    );
  }

  return <Navigate to={destino} replace />;
}

// Inyecta los datos de la empresa (desde ConfigContext) a Facturacion.
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

  if (configError || !config) {
    return <ErrorConfiguracion onRetry={refreshConfig} />;
  }

  return <Compras />;
}

function ErrorConfiguracion({ onRetry }) {
  return (
    <section className="pagina" role="alert">
      <h1 className="pagina-titulo">No se pudo cargar la configuración</h1>
      <p>Comprueba la conexión con Firebase e inténtalo nuevamente.</p>
      <button type="button" className="btn-principal" onClick={onRetry}>
        Reintentar
      </button>
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
            <Route index element={<InicioPorRol />} />

            <Route
              path="dashboard"
              element={
                <RutaConPermiso modulo="dashboard">
                  <Dashboard />
                </RutaConPermiso>
              }
            />

            <Route
              path="clientes"
              element={
                <RutaConPermiso modulo="clientes">
                  <Clientes />
                </RutaConPermiso>
              }
            />

            <Route
              path="cotizaciones"
              element={
                <RutaConPermiso modulo="cotizaciones">
                  <Cotizaciones />
                </RutaConPermiso>
              }
            />

            <Route
              path="equipos"
              element={
                <RutaConPermiso modulo="equipos">
                  <Equipos />
                </RutaConPermiso>
              }
            />

            <Route
              path="mangas"
              element={
                <RutaConPermiso modulo="mangas">
                  <Mangas />
                </RutaConPermiso>
              }
            />

            <Route
              path="mensajeria"
              element={
                <RutaConPermiso modulo="mensajeria">
                  <Mensajeria />
                </RutaConPermiso>
              }
            />

            <Route
              path="compras"
              element={
                <RutaConPermiso modulo="compras">
                  <ComprasWrapper />
                </RutaConPermiso>
              }
            />

            <Route
              path="proveedores"
              element={
                <RutaConPermiso modulo="proveedores">
                  <Proveedores />
                </RutaConPermiso>
              }
            />

            <Route path="compras/proveedores" element={<Navigate to="/proveedores" replace />} />

            <Route
              path="facturacion"
              element={
                <RutaConPermiso modulo="facturacion">
                  <FacturacionWrapper />
                </RutaConPermiso>
              }
            />

            <Route
              path="configuracion"
              element={
                <RutaConPermiso modulo="configuracion">
                  <Configuracion />
                </RutaConPermiso>
              }
            />

            <Route
              path="perfil"
              element={
                <RutaConPermiso modulo="perfil">
                  <Perfil />
                </RutaConPermiso>
              }
            />

            <Route
              path="nube"
              element={
                <RutaConPermiso modulo="nube">
                  <NubePage />
                </RutaConPermiso>
              }
            />

            <Route
              path="usuarios"
              element={
                <RutaSeccionConfiguracion seccion="usuarios">
                  <Navigate to="/configuracion?tab=usuarios" replace />
                </RutaSeccionConfiguracion>
              }
            />
          </Route>

          <Route
            path="*"
            element={
              <RutaProtegida>
                <InicioPorRol />
              </RutaProtegida>
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
