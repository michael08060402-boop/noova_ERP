import { Component } from 'react';
import './AppErrorBoundary.css';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en la interfaz:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error" role="alert">
        <div className="app-error-panel">
          <p className="app-error-label">ERP NOOVA S.A.C.</p>
          <h1>No pudimos mostrar esta pantalla</h1>
          <p>La sesión sigue protegida. Recarga la aplicación y, si el problema continúa, informa al administrador.</p>
          <button type="button" onClick={() => window.location.reload()}>Recargar ERP</button>
        </div>
      </main>
    );
  }
}
