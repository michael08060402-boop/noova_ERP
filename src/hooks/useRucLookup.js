import { useState, useEffect, useRef, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

// Hook para autollenado de datos por RUC.
// Dispara la consulta a la Cloud Function consultarRuc cuando el RUC ingresado
// tiene 11 dígitos válidos, con debounce para no llamar en cada tecla.
const DEBOUNCE_MS = 600;
const RUC_REGEX = /^\d{11}$/;

export function useRucLookup() {
  const [datosRuc, setDatosRuc] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const rucEnProcesoRef = useRef(null);
  const consultarRucFn = useRef(null);

  // Inicializa la Cloud Function perezosamente
  if (!consultarRucFn.current) {
    try {
      consultarRucFn.current = httpsCallable(functions, 'consultarRuc', { timeout: 30000 });
    } catch (err) {
      console.error('useRucLookup: no se pudo inicializar httpsCallable:', err);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const lookupRuc = useCallback((ruc) => {
    setError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const rucLimpio = String(ruc || '').replace(/\D/g, '');

    if (!RUC_REGEX.test(rucLimpio)) {
      setDatosRuc(null);
      return;
    }

    // Evitar consultar el mismo RUC dos veces seguidas
    if (rucEnProcesoRef.current === rucLimpio) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      rucEnProcesoRef.current = rucLimpio;
      setCargando(true);
      try {
        if (!consultarRucFn.current) {
          throw new Error('Cloud Function no inicializada');
        }
        const result = await consultarRucFn.current({ ruc: rucLimpio });
        const data = result.data;
        if (!data || !data.razonSocial) {
          throw new Error('Respuesta vacía del servidor');
        }
        setDatosRuc(data);
      } catch (err) {
        console.error('useRucLookup error:', err);
        setError(err?.message || 'Error consultando RUC');
        setDatosRuc(null);
      } finally {
        setCargando(false);
        rucEnProcesoRef.current = null;
      }
    }, DEBOUNCE_MS);
  }, []);

  const limpiar = useCallback(() => {
    setDatosRuc(null);
    setError(null);
    setCargando(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    rucEnProcesoRef.current = null;
  }, []);

  return { lookupRuc, datosRuc, cargando, error, limpiar };
}

export default useRucLookup;
