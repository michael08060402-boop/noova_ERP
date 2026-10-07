import { useEffect, useId, useRef, useState } from 'react';
import './Loading.css';
import logoSymbol from '../assets/noova-loader-symbol.png';
import logoNoova from '../assets/noova-loader-wordmark.png';
import logoConsulting from '../assets/noova-loader-consulting.png';

const requests = new Map();
const listeners = new Set();

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

export function startInitialLoadingCycle(message = 'Preparando ERP...') {
  cycleId += 1;
  cycleMessage = message;
  emit();
}

export default function Loading({ message = 'Cargando...' }) {
  const id = useId();
  const initialMessageRef = useRef(message);

  useEffect(() => {
    requests.set(id, initialMessageRef.current);
    emit();

    return () => {
      requests.delete(id);
      emit();
    };
  }, [id]);

  useEffect(() => {
    if (!requests.has(id)) return;
    requests.set(id, message);
    emit();
  }, [id, message]);

  return null;
}

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

    if (finishedCycleRef.current === activeCycleRef.current) {
      return undefined;
    }

    if (source.active) {
      return undefined;
    }

    const elapsed = performance.now() - shownAtRef.current;
    const remainingMinimum = Math.max(0, minVisible - elapsed);
    const wait = Math.max(settleDelay, remainingMinimum);

    hideTimerRef.current = window.setTimeout(() => {
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
