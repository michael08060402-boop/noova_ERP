import { useEffect, useRef } from 'react';

const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDialogFocus(isOpen, onEscape, externalRef) {
  const internalRef = useRef(null);
  const dialogRef = externalRef || internalRef;
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previous = document.activeElement;
    const focusable = () => [...dialog.querySelectorAll(SELECTOR)]
      .filter((element) => element.getClientRects().length > 0);
    (focusable()[0] || dialog).focus();

    function onKeyDown(event) {
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        escapeRef.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    }
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen, dialogRef]);
  return dialogRef;
}
