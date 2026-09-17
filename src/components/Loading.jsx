import { useEffect, useRef, useState } from 'react';
import './Loading.css';
import logoSymbol from '../assets/noova-loader-symbol.png';
import logoNoova from '../assets/noova-loader-wordmark.png';
import logoConsulting from '../assets/noova-loader-consulting.png';

const requests = new Map();
const listeners = new Set();

let requestSequence = 0;
let cycleId = 1;
let cycleMessage = 'Preparando ERP...';

function snapshot() {
  const messages = [...requests.values()];

  return {
    active: requests.size > 0,
    message: messages.at(-1) || cycleMessage,
    cycleId
  };
}

function emit() {
  const value = snapshot();
  listeners.forEach((listener) => listener(value));
}

function subscribe(listener) {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

/*
  Se llama después de un login correcto.
  React NO se recarga, por eso necesitamos iniciar explícitamente
  un nuevo ciclo de carga inicial al entrar al ERP desde /login.
*/
export function startInitialLoadingCycle(message = 'Preparando ERP...') {
  cycleId += 1;
  cycleMessage = message;
  emit();
}

/*
  Los módulos existentes pueden seguir usando:
      return <Loading message="..." />

  Este componente YA NO dibuja nada.
  Solo informa al loader inicial que todavía existe trabajo pendiente.

  Cuando el ciclo inicial ya terminó, estos registros se ignoran visualmente:
  al cambiar de módulo NO vuelve a aparecer ningún loader.
*/
export default function Loading({ message = 'Cargando...' }) {
  const idRef = useRef(null);

  if (idRef.current === null) {
    requestSequence += 1;
    idRef.current = `loading-${requestSequence}`;
  }

  useEffect(() => {
    const id = idRef.current;
    requests.set(id, message);
    emit();

    return () => {
      requests.delete(id);
      emit();
    };
  }, []);

  useEffect(() => {
    if (!requests.has(idRef.current)) return;
    requests.set(idRef.current, message);
    emit();
  }, [message]);

  return null;
}

/*
  ÚNICO loader visual del ERP.

  - Aparece en refresh / primera entrada.
  - También se rearma después de un login correcto.
  - Cubre TODO el viewport para que sidebar/topbar nunca aparezcan
    a mitad de la animación ni desplacen visualmente el logo.
  - Cuando desaparece, queda desactivado para el resto de la sesión SPA.
*/
export function InitialLoadingHost({
  minVisible = 1600,
  settleDelay = 120,
  exitDuration = 180
}) {
  const [source, setSource] = useState(snapshot);
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const activeCycleRef = useRef(source.cycleId);
  const finishedCycleRef = useRef(null);
  const shownAtRef = useRef(performance.now());

  const hideTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(() => subscribe(setSource), []);

  // Un refresh crea el primer ciclo. Un login correcto crea otro.
  useEffect(() => {
    if (source.cycleId === activeCycleRef.current) return;

    activeCycleRef.current = source.cycleId;
    finishedCycleRef.current = null;
    shownAtRef.current = performance.now();

    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(exitTimerRef.current);

    setLeaving(false);
    setVisible(true);
  }, [source.cycleId]);

  useEffect(() => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(exitTimerRef.current);

    // El ciclo ya acabó: cargas posteriores de módulos NO muestran nada.
    if (finishedCycleRef.current === activeCycleRef.current) {
      return undefined;
    }

    // Mientras exista al menos una carga inicial, mantenemos el overlay.
    if (source.active) {
      return undefined;
    }

    const elapsed = performance.now() - shownAtRef.current;
    const remainingMinimum = Math.max(0, minVisible - elapsed);
    const wait = Math.max(settleDelay, remainingMinimum);

    hideTimerRef.current = window.setTimeout(() => {
      /*
        Antes del fade forzamos el logo completo.
        Así nunca desaparece a mitad de "isotipo -> NOOVA -> CONSULTING".
      */
      setLeaving(true);

      exitTimerRef.current = window.setTimeout(() => {
        finishedCycleRef.current = activeCycleRef.current;
        setVisible(false);
        setLeaving(false);
      }, exitDuration);
    }, wait);

    return () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(exitTimerRef.current);
    };
  }, [
    source.active,
    source.cycleId,
    minVisible,
    settleDelay,
    exitDuration
  ]);

  useEffect(() => () => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(exitTimerRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`initial-loading-host ${leaving ? 'initial-loading-host-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="initial-loading-loader" aria-hidden="true">
        <span className="initial-loading-track" />
        <span className="initial-loading-arc" />

        <div className="initial-loading-logo">
          <img
            className="initial-loading-layer initial-loading-symbol"
            src={logoSymbol}
            alt=""
            draggable="false"
          />
          <img
            className="initial-loading-layer initial-loading-noova"
            src={logoNoova}
            alt=""
            draggable="false"
          />
          <img
            className="initial-loading-layer initial-loading-consulting"
            src={logoConsulting}
            alt=""
            draggable="false"
          />
        </div>
      </div>

      <p className="initial-loading-message">{source.message}</p>
    </div>
  );
}
