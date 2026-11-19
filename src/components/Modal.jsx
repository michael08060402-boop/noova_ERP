import { useCallback, useEffect, useId, useRef, useState } from 'react';
import useDialogFocus from '../hooks/useDialogFocus';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, size = 'medium' }) {
  const titleId = useId();
  const containerRef = useRef(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const hasUnsavedInput = useCallback(() => {
    if (!containerRef.current) return false;
    const inputs = containerRef.current.querySelectorAll('input, textarea');
    for (const el of inputs) {
      if (el.value && el.value.trim() !== '' && el.type !== 'hidden') return true;
    }
    return false;
  }, []);

  const tryClose = useCallback(() => {
    if (hasUnsavedInput()) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedInput, onClose]);

  useDialogFocus(isOpen && !showExitConfirm, tryClose, containerRef);
  const confirmRef = useDialogFocus(isOpen && showExitConfirm, () => setShowExitConfirm(false));

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setShowExitConfirm(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      tryClose();
    }
  }

  function confirmClose() {
    setShowExitConfirm(false);
    onClose();
  }

  function cancelClose() {
    setShowExitConfirm(false);
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={containerRef}
        className={`modal-container modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button className="modal-close" onClick={tryClose} aria-label="Cerrar">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>

        {showExitConfirm && (
          <div className="modal-exit-confirm">
            <div ref={confirmRef} className="modal-exit-confirm-box" role="alertdialog" aria-modal="true" aria-label="Descartar los cambios" tabIndex={-1}>
              <p>¿Descartar los cambios?</p>
              <span>Tienes información ingresada que se perderá si cierras ahora.</span>
              <div className="modal-exit-confirm-actions">
                <button className="btn-exit-cancel" onClick={cancelClose}>
                  Seguir editando
                </button>
                <button className="btn-exit-confirm" onClick={confirmClose}>
                  Sí, descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
