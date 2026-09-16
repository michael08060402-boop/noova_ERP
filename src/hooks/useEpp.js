import { useState, useEffect, useCallback } from 'react';
import {
  getEpp,
  getEppById,
  searchEppByCodigo,
  createEpp,
  updateEpp,
  deleteEpp
} from '../services/eppService';

export function useEpp(enabled = true) {
  const [epp, setEpp] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchEpp = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getEpp();
      setEpp(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching epp:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchEpp();
  }, [enabled, fetchEpp]);

  const addEpp = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createEpp(data);
      setEpp((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editEpp = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateEpp(id, data);
      setEpp((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeEpp = useCallback(async (id) => {
    try {
      setError(null);
      await deleteEpp(id);
      setEpp((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getEppItem = useCallback(async (id) => {
    try {
      return await getEppById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const searchByCodigo = useCallback(async (codigo) => {
    try {
      return await searchEppByCodigo(codigo);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    epp,
    loading,
    error,
    fetchEpp,
    addEpp,
    editEpp,
    removeEpp,
    getEppItem,
    searchByCodigo
  };
}
