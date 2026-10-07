import { useState } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Eliminar',
  busyLabel = 'Eliminando…',
  icon = null,
  busy = false
}) {
  const [confirmandoInterno, setConfirmandoInterno] = useState(false);
  const ocupado = busy || confirmandoInterno;

  if (!isOpen) return null;

  async function confirmar() {
    if (ocupado) return;
    setConfirmandoInterno(true);
    try {
      const resultado = await onConfirm?.();
      if (resultado !== false) onClose?.();
    } finally {
      setConfirmandoInterno(false);
    }
  }

  return (
    <div className="confirm-overlay" onClick={ocupado ? undefined : onClose}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title || 'Confirmar eliminación'}
        aria-busy={ocupado}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icon">
          {icon || (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h3 className="confirm-title">{title || '¿Está seguro?'}</h3>
        <p className="confirm-message">{message || 'Esta acción no se puede deshacer.'}</p>
        <div className="confirm-actions">
          <button className="btn btn-cancel" onClick={onClose} disabled={ocupado}>Cancelar</button>
          <button className="btn btn-danger" onClick={confirmar} disabled={ocupado}>
            {ocupado ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
