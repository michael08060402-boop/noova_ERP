import { useState, useEffect, useCallback } from 'react';
import {
  getCotizaciones,
  getCotizacionById,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion
} from '../services/cotizacionService';

// Opciones:
// - soloEpp: consulta únicamente solicitudes/cotizaciones EPP.
// - excluirEpp: oculta EPP del flujo comercial. Por defecto queda activo
//   cuando no se usa soloEpp, para separar Cotizaciones de Solicitudes.
export function useCotizaciones(enabled = true, opciones = {}) {
  const soloEpp = !!opciones.soloEpp;
  const excluirEpp = opciones.excluirEpp ?? !soloEpp;

  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const perteneceAVista = useCallback((cotizacion) => {
    if (soloEpp) return cotizacion?.tipoItem === 'epp';
    if (excluirEpp) return cotizacion?.tipoItem !== 'epp';
    return true;
  }, [soloEpp, excluirEpp]);

  const fetchCotizaciones = useCallback(async () => {
    if (!enabled) {
      setCotizaciones([]);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getCotizaciones({ soloEpp });
      const visibles = data.filter(perteneceAVista);
      setCotizaciones(visibles);
      return visibles;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cotizaciones:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled, soloEpp, perteneceAVista]);

  useEffect(() => {
    if (enabled) fetchCotizaciones();
    else {
      setCotizaciones([]);
      setLoading(false);
    }
  }, [enabled, fetchCotizaciones]);

  // Ya no se vuelve a descargar toda la colección después de crear/editar.
  // Firestore confirma la operación y el estado local se actualiza en memoria.
  const addCotizacion = useCallback(async (data) => {
    try {
      setError(null);
      const result = await createCotizacion(data);
      const nueva = {
        id: result.id,
        ...(result.codigo ? { codigo: result.codigo } : {}),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (perteneceAVista(nueva)) {
        setCotizaciones((prev) => [nueva, ...prev.filter((c) => c.id !== nueva.id)]);
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [perteneceAVista]);

  const editCotizacion = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateCotizacion(id, data);
      const actualizada = {
        id,
        ...data,
        updatedAt: new Date().toISOString()
      };

      setCotizaciones((prev) => {
        const resto = prev.filter((c) => c.id !== id);
        if (!perteneceAVista(actualizada)) return resto;

        const anterior = prev.find((c) => c.id === id) || {};
        const fusionada = { ...anterior, ...actualizada };
        return [fusionada, ...resto].sort((a, b) => {
          if (soloEpp) {
            return String(b.createdAt || b.fechaEmision || b.updatedAt || '')
              .localeCompare(String(a.createdAt || a.fechaEmision || a.updatedAt || ''));
          }
          return String(b.codigo || '').localeCompare(String(a.codigo || ''));
        });
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [perteneceAVista, soloEpp]);

  const removeCotizacion = useCallback(async (id) => {
    try {
      setError(null);
      await deleteCotizacion(id);
      setCotizaciones((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getCotizacion = useCallback(async (id) => {
    try {
      return await getCotizacionById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    cotizaciones,
    loading,
    error,
    fetchCotizaciones,
    addCotizacion,
    editCotizacion,
    removeCotizacion,
    getCotizacion
  };
}
