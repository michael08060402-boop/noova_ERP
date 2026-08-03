import { useEffect, useRef, useState } from 'react';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, size = 'medium' }) {
  const containerRef = useRef(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') {
        tryClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  function hasUnsavedInput() {
    if (!containerRef.current) return false;
    const inputs = containerRef.current.querySelectorAll('input, textarea');
    for (const el of inputs) {
      if (el.value && el.value.trim() !== '' && el.type !== 'hidden') return true;
    }
    return false;
  }

  function tryClose() {
    if (hasUnsavedInput()) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }

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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={tryClose} aria-label="Cerrar">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>

        {showExitConfirm && (
          <div className="modal-exit-confirm">
            <div className="modal-exit-confirm-box">
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
