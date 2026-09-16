import { useState, useEffect, useCallback } from 'react';
import {
  getCotizaciones,
  getCotizacionById,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion
} from '../services/cotizacionService';

// opciones.soloEpp: filtra en servidor las cotizaciones tipoItem == 'epp'
// (rol Jefe de Proyecto de Mina). Para el resto de roles la llamada sigue
// siendo useCotizaciones() tal cual, sin romper compatibilidad.
export function useCotizaciones(enabled = true, opciones = {}) {
  const { soloEpp = false } = opciones;
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchCotizaciones = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getCotizaciones({ soloEpp });
      setCotizaciones(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cotizaciones:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, soloEpp]);

  useEffect(() => {
    if (enabled) fetchCotizaciones();
  }, [enabled, fetchCotizaciones]);

  const addCotizacion = useCallback(async (data) => {
    try {
      setError(null);
      const result = await createCotizacion(data);
      await fetchCotizaciones();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchCotizaciones]);

  const editCotizacion = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateCotizacion(id, data);
      await fetchCotizaciones();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchCotizaciones]);

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
