import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import { InitialLoadingHost } from './components/Loading';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <InitialLoadingHost />

      <BrowserRouter>
        <AuthProvider>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
