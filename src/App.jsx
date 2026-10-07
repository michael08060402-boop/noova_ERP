import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Loading from './components/Loading';
import { useConfig } from './context/ConfigContext';
import {
  puede,
  puedeConfiguracion,
  getRutaInicial
} from './services/userService';

import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Cotizaciones from './pages/Cotizaciones';
import SolicitudesCotizacion from './pages/SolicitudesCotizacion';
import Calibraciones from './pages/Calibraciones';
import Equipos from './pages/Equipos';
import Mangas from './pages/Mangas';
import Servicios from './pages/Servicios';
import Configuracion from './pages/Configuracion';
import Perfil from './pages/Perfil';
import Facturacion from './pages/Facturacion';
import Mensajeria from './pages/Mensajeria';
import NubePage from './modules/nube/pages/NubePage';
import Compras from './pages/Compras';
import Proveedores from './pages/Proveedores';

import './App.css';

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

function RutaConPermiso({ modulo, accion = 'read', children }) {
  const { userProfile } = useAuth();
  const location = useLocation();

  if (puede(userProfile, modulo, accion)) {
    return children;
  }

  const destino = getRutaInicial(userProfile);

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

function RutaConfiguracion({ children }) {
  const { userProfile } = useAuth();
  const location = useLocation();

  const tieneAcceso = puede(userProfile, 'configuracion', 'read')
    || puede(userProfile, 'perfil', 'read');

  if (tieneAcceso) return children;

  const destino = getRutaInicial(userProfile);

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

function FacturacionWrapper() {
  const {
    config,
    loadingConfig,
    configError,
    refreshConfig
  } = useConfig();

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
  const {
    config,
    loadingConfig,
    configError,
    refreshConfig
  } = useConfig();

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
      <button
        type="button"
        className="btn-principal"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </section>
  );
}

function App() {
  return (
    <div className="app">
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
            path="solicitudes"
            element={
              <RutaConPermiso modulo="solicitudes">
                <SolicitudesCotizacion />
              </RutaConPermiso>
            }
          />

          <Route
            path="calibraciones"
            element={
              <RutaConPermiso modulo="calibraciones">
                <Calibraciones />
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
            path="servicios"
            element={
              <RutaConPermiso modulo="servicios">
                <Servicios />
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

          <Route
            path="compras/proveedores"
            element={<Navigate to="/proveedores" replace />}
          />

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
              <RutaConfiguracion>
                <Configuracion />
              </RutaConfiguracion>
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
                <Navigate
                  to="/configuracion?tab=usuarios"
                  replace
                />
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
    </div>
  );
}

export default App;
