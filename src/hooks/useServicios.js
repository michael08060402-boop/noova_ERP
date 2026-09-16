import { useState, useEffect, useCallback } from 'react';
import {
  getServicios,
  getServicioById,
  searchServicioByCodigo,
  createServicio,
  updateServicio,
  deleteServicio
} from '../services/servicioService';

export function useServicios(enabled = true) {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchServicios = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getServicios();
      setServicios(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching servicios:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchServicios();
  }, [enabled, fetchServicios]);

  const addServicio = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createServicio(data);
      setServicios((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editServicio = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateServicio(id, data);
      setServicios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeServicio = useCallback(async (id) => {
    try {
      setError(null);
      await deleteServicio(id);
      setServicios((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getServicio = useCallback(async (id) => {
    try {
      return await getServicioById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const searchByCodigo = useCallback(async (codigo) => {
    try {
      return await searchServicioByCodigo(codigo);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    servicios,
    loading,
    error,
    fetchServicios,
    addServicio,
    editServicio,
    removeServicio,
    getServicio,
    searchByCodigo
  };
}
